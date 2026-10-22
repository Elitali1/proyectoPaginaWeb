const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  // Prioriza la cookie httpOnly (más segura). El header Authorization se sigue aceptando porque
  // lo usa el agente de impresión de la PC del local (y las pruebas por API).
  const tokenDesdeCookie = req.cookies ? req.cookies.auth_token : null;

  const authHeader = req.headers['authorization'];
  const tokenDesdeHeader = authHeader ? authHeader.split(' ')[1] : null;

  const token = tokenDesdeCookie || tokenDesdeHeader;

  if (!token) {
    return res.status(401).json({ error: 'No se proporcionó token' });
  }

  try {
    const datosUsuario = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.usuario = datosUsuario;
        // Sucursal del usuario, tomada del token firmado (no de lo que mande el navegador).
    // Los tokens emitidos antes de este cambio no la traen: se asume la sucursal 1.
    req.sucursalId = Number.isInteger(datosUsuario.sucursal_id) ? datosUsuario.sucursal_id : 1;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = verificarToken;