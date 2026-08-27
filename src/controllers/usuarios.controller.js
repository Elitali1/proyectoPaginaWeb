const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const usuariosRepository = require('../repositories/usuarios.repository.js');
const crypto = require('crypto');
const emailService = require('../services/email.service.js');

// Security: adjust bcrypt salt rounds
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

function isValidEmail(email) {
  // Basic RFC-5322-ish check; enough for server-side sanity
  return typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function isStrongPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8; // recommend stronger rules in prod
}

async function listar(req, res) {
  try {
    const usuarios = await usuariosRepository.obtenerTodos();
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
}

async function crear(req, res) {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!isValidEmail(email) || !isStrongPassword(password)) {
      return res.status(400).json({ error: 'Email o contraseña inválidos / débiles' });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const nuevoUsuario = await usuariosRepository.crear({ nombre, email, password_hash, rol });
    res.status(201).json(nuevoUsuario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const usuarioEliminado = await usuariosRepository.eliminar(id);

    if (!usuarioEliminado) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Usuario eliminado', usuario: usuarioEliminado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!isValidEmail(email) || !isStrongPassword(password)) {
      return res.status(400).json({ error: 'Email o contraseña inválidos' });
    }

    const usuario = await usuariosRepository.obtenerPorEmail(email);

    if (!usuario) {
      // avoid user enumeration
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    // check lock
    if (usuario.lock_until && new Date(usuario.lock_until) > new Date()) {
      return res.status(423).json({ error: 'Cuenta temporalmente bloqueada. Intentá más tarde.' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValida) {
      // increment failed attempts
      const inc = await usuariosRepository.incrementFailedLogin(email);
      const attempts = inc ? inc.failed_login_attempts : null;
      const MAX_ATTEMPTS = parseInt(process.env.MAX_FAILED_LOGIN || '5', 10);
      const LOCK_MINUTES = parseInt(process.env.LOCK_MINUTES || '15', 10);
      if (attempts && attempts >= MAX_ATTEMPTS) {
        const until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        await usuariosRepository.setLockUntil(email, until);
        return res.status(423).json({ error: 'Cuenta bloqueada temporalmente por demasiados intentos. Intentá en 15 minutos.' });
      }
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    // success: reset failed attempts
    await usuariosRepository.resetFailedLogin(email);

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Set httpOnly cookie as well
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    };
    res.cookie('auth_token', token, cookieOptions);

    res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, email, rol, password } = req.body;

    let password_hash = null;
    if (password) {
      if (!isStrongPassword(password)) return res.status(400).json({ error: 'Contraseña demasiado débil' });
      password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    }

    const usuarioActualizado = await usuariosRepository.actualizar(id, { nombre, email, rol, password_hash });

    if (!usuarioActualizado) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(usuarioActualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
}

async function solicitarReset(req, res) {
  try {
    const { email } = req.body;
    if (!isValidEmail(email)) return res.json({ mensaje: 'Si existe una cuenta con ese email, se envió un link para resetear la contraseña' });

    // Responder siempre igual para evitar enumeración de usuarios
    const usuario = await usuariosRepository.obtenerPorEmail(email);
    if (!usuario) {
      return res.json({ mensaje: 'Si existe una cuenta con ese email, se envió un link para resetear la contraseña' });
    }

    // Generar token (valor enviado por email) y guardar su hash en la BD
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const vencimiento = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await usuariosRepository.setResetToken(email, tokenHash, vencimiento);

    // Enviar email con link que incluye el token (no el hash)
    try {
      await emailService.sendResetPasswordEmail(email, token);
    } catch (sendErr) {
      // En caso de fallo al enviar, loguear y continuar para no filtrar información sobre existencia del usuario
      console.error('Error enviando email de reset (no bloqueante):', sendErr?.response?.data || sendErr.message || sendErr);
    }

    // Always respond generic message (do not return links in production)
    return res.json({ mensaje: 'Si existe una cuenta con ese email, se envió un link para resetear la contraseña' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la solicitud de reset' });
  }
}

async function confirmarReset(req, res) {
  try {
    const { email, token, password } = req.body;
    if (!isValidEmail(email) || !token || !isStrongPassword(password)) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const usuario = await usuariosRepository.obtenerPorEmail(email);
    if (!usuario || !usuario.token_reset || !usuario.token_reset_vencimiento) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    if (new Date(usuario.token_reset_vencimiento) < new Date()) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (tokenHash !== usuario.token_reset) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    await usuariosRepository.updatePasswordAndClearReset(email, password_hash);

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al confirmar reset' });
  }
}

async function logout(req, res) {
  res.clearCookie('auth_token');
  res.json({ mensaje: 'Sesión finalizada' });
}

module.exports = { listar, crear, eliminar, login, actualizar, solicitarReset, confirmarReset, logout };