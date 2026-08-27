const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'No se proporcionó token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const datosUsuario = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = datosUsuario;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = verificarToken;