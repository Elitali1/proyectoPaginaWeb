const crypto = require('crypto');

function verificarAgente(req, res, next) {
  const configuredToken = process.env.AGENTE_TOKEN;
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (!configuredToken || scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Agente no autorizado' });
  }

  const provided = Buffer.from(token);
  const expected = Buffer.from(configuredToken);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Agente no autorizado' });
  }

  next();
}

module.exports = verificarAgente;
