const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const usuariosRepository = require('../repositories/usuarios.repository.js');
const crypto = require('crypto');
const emailService = require('../services/email.service.js');
const { ROLES } = require('../config/negocio.js');
const { ErrorNegocio, responderError } = require('../utils/errores.js');
const { esEmail, esTexto } = require('../utils/validaciones.js');

// Security: adjust bcrypt salt rounds
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
const MAX_ATTEMPTS = parseInt(process.env.MAX_FAILED_LOGIN || '5', 10);
const LOCK_MINUTES = parseInt(process.env.LOCK_MINUTES || '15', 10);

const MENSAJE_LOGIN_FALLIDO = 'Email o contraseña incorrectos, o cuenta bloqueada temporalmente';
const MENSAJE_RESET = 'Si existe una cuenta con ese email, se envió un link para resetear la contraseña';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
};

// Hash de mentira para que el login tarde lo mismo exista o no el usuario (evita enumeración por tiempos).
let hashDeRelleno = null;
async function compararContraRelleno(password) {
  if (!hashDeRelleno) hashDeRelleno = await bcrypt.hash('relleno-sin-usuario', BCRYPT_SALT_ROUNDS);
  await bcrypt.compare(password, hashDeRelleno);
}

function isStrongPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 72; // 72 = límite real de bcrypt
}

function validarDatosUsuario({ nombre, email, rol }) {
  if (!esTexto(nombre, { max: 100 })) throw new ErrorNegocio('El nombre es obligatorio');
  if (!esEmail(email)) throw new ErrorNegocio('El email no es válido');
  if (!ROLES.includes(rol)) throw new ErrorNegocio('Rol inválido');
}

async function listar(req, res) {
  try {
    const usuarios = await usuariosRepository.obtenerTodos();
    res.json(usuarios);
  } catch (error) {
    responderError(res, error, 'Error al obtener usuarios');
  }
}

async function crear(req, res) {
  try {
    const { nombre, email, password } = req.body || {};
    const rol = (req.body && req.body.rol) || 'cajero';

    validarDatosUsuario({ nombre, email, rol });
    if (!isStrongPassword(password)) {
      throw new ErrorNegocio('La contraseña debe tener entre 8 y 72 caracteres');
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const nuevoUsuario = await usuariosRepository.crear({ nombre: nombre.trim(), email: email.trim(), password_hash, rol });
    res.status(201).json(nuevoUsuario);
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    responderError(res, error, 'Error al crear usuario');
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;

    if (Number(id) === Number(req.usuario.id)) {
      return res.status(400).json({ error: 'No podés eliminar tu propio usuario' });
    }

    const objetivo = await usuariosRepository.obtenerPorId(id);
    if (!objetivo) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (objetivo.rol === 'admin' && await usuariosRepository.contarAdmins() <= 1) {
      return res.status(400).json({ error: 'No se puede eliminar al último administrador' });
    }

    const usuarioEliminado = await usuariosRepository.eliminar(id);

    if (!usuarioEliminado) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Usuario eliminado', usuario: usuarioEliminado });
  } catch (error) {
    responderError(res, error, 'Error al eliminar usuario');
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    // En el login solo se chequea que lleguen datos con forma razonable: las reglas de
    // contraseña fuerte se aplican al crearla, no al entrar (si no, una contraseña vieja más corta
    // no podría iniciar sesión nunca más).
    if (!esEmail(email) || typeof password !== 'string' || password.length === 0 || password.length > 200) {
      return res.status(400).json({ error: 'Email o contraseña inválidos' });
    }

    const usuario = await usuariosRepository.obtenerPorEmail(email);

    if (!usuario) {
      await compararContraRelleno(password);
      return res.status(401).json({ error: MENSAJE_LOGIN_FALLIDO });
    }

    // Cuenta bloqueada: se responde igual que una contraseña incorrecta (no revela que la cuenta existe).
    if (usuario.lock_until && new Date(usuario.lock_until) > new Date()) {
      await compararContraRelleno(password);
      return res.status(401).json({ error: MENSAJE_LOGIN_FALLIDO });
    }

    // Si el bloqueo ya venció, se empieza de cero (antes el contador quedaba alto y el primer error re-bloqueaba).
    if (usuario.lock_until) {
      await usuariosRepository.resetFailedLogin(usuario.email);
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValida) {
      const inc = await usuariosRepository.incrementFailedLogin(usuario.email);
      const attempts = inc ? inc.failed_login_attempts : null;
      if (attempts && attempts >= MAX_ATTEMPTS) {
        const until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        await usuariosRepository.setLockUntil(usuario.email, until);
      }
      return res.status(401).json({ error: MENSAJE_LOGIN_FALLIDO });
    }

    // success: reset failed attempts
    await usuariosRepository.resetFailedLogin(usuario.email);

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h', algorithm: 'HS256' }
    );

    // Set httpOnly cookie as well
    res.cookie('auth_token', token, { ...COOKIE_OPTIONS, maxAge: 8 * 60 * 60 * 1000 });

    // El token también va en el cuerpo porque el agente de impresión y las pruebas por API lo usan
    // en el header Authorization. El navegador no lo necesita: usa la cookie httpOnly.
    res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } });
  } catch (error) {
    responderError(res, error, 'Error al iniciar sesión');
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, email, rol, password } = req.body || {};

    validarDatosUsuario({ nombre, email, rol });

    let password_hash = null;
    if (password) {
      if (!isStrongPassword(password)) return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' });
      password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    }

    const actual = await usuariosRepository.obtenerPorId(id);
    if (!actual) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // No se puede dejar el sistema sin administradores.
    if (actual.rol === 'admin' && rol !== 'admin') {
      if (Number(id) === Number(req.usuario.id)) {
        return res.status(400).json({ error: 'No podés quitarte a vos mismo el rol de administrador' });
      }
      if (await usuariosRepository.contarAdmins() <= 1) {
        return res.status(400).json({ error: 'No se puede quitar el rol al último administrador' });
      }
    }

    const usuarioActualizado = await usuariosRepository.actualizar(id, { nombre: nombre.trim(), email: email.trim(), rol, password_hash });

    if (!usuarioActualizado) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(usuarioActualizado);
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    responderError(res, error, 'Error al actualizar usuario');
  }
}

async function solicitarReset(req, res) {
  try {
    const { email } = req.body || {};
    if (!esEmail(email)) return res.json({ mensaje: MENSAJE_RESET });

    // Responder siempre igual para evitar enumeración de usuarios
    const usuario = await usuariosRepository.obtenerPorEmail(email);
    if (!usuario) {
      return res.json({ mensaje: MENSAJE_RESET });
    }

    // Generar token (valor enviado por email) y guardar su hash en la BD
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const vencimiento = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Se usa el email tal como está guardado (no el que tipeó la persona) para que coincida siempre.
    await usuariosRepository.setResetToken(usuario.email, tokenHash, vencimiento);

    // Enviar email con link que incluye el token (no el hash)
    try {
      await emailService.sendResetPasswordEmail(usuario.email, token);
    } catch (sendErr) {
      // En caso de fallo al enviar, loguear y continuar para no filtrar información sobre existencia del usuario
      console.error('Error enviando email de reset (no bloqueante):', sendErr?.response?.data || sendErr.message || sendErr);
    }

    // Always respond generic message (do not return links in production)
    return res.json({ mensaje: MENSAJE_RESET });
  } catch (error) {
    responderError(res, error, 'Error al procesar la solicitud de reset');
  }
}

async function confirmarReset(req, res) {
  try {
    const { email, token, password } = req.body || {};
    if (!esEmail(email) || typeof token !== 'string' || !token || !isStrongPassword(password)) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const usuario = await usuariosRepository.obtenerPorEmail(email);
    if (!usuario || !usuario.token_reset || !usuario.token_reset_vencimiento) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    if (new Date(usuario.token_reset_vencimiento) < new Date()) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    const tokenHash = Buffer.from(crypto.createHash('sha256').update(token).digest('hex'));
    const tokenGuardado = Buffer.from(String(usuario.token_reset));
    if (tokenHash.length !== tokenGuardado.length || !crypto.timingSafeEqual(tokenHash, tokenGuardado)) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    await usuariosRepository.updatePasswordAndClearReset(usuario.email, password_hash);

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    responderError(res, error, 'Error al confirmar reset');
  }
}

async function logout(req, res) {
  res.clearCookie('auth_token', COOKIE_OPTIONS);
  res.json({ mensaje: 'Sesión finalizada' });
}

module.exports = { listar, crear, eliminar, login, actualizar, solicitarReset, confirmarReset, logout };
