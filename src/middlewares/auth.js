const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  // Prioriza la cookie httpOnly (más segura); si no existe, acepta el header
  // Authorization como respaldo, para no romper nada mientras migramos el frontend.
  const tokenDesdeCookie = req.cookies ? req.cookies.auth_token : null;

  const authHeader = req.headers['authorization'];
  const tokenDesdeHeader = authHeader ? authHeader.split(' ')[1] : null;

  const token = tokenDesdeCookie || tokenDesdeHeader;

  if (!token) {
    return res.status(401).json({ error: 'No se proporcionó token' });
  }

  try {
    const datosUsuario = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = datosUsuario;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = verificarToken;