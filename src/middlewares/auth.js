const jwt = require('jsonwebtoken');

// Un token de agente de impresión (lleva esAgente: true) solo sirve para las dos rutas que usa el agente:
// pedir lo que hay para imprimir y confirmar la impresión. Para cualquier otra ruta se rechaza,
// sin importar el rol que tenga el token: si alguien se lleva el token de la PC del local, no puede
// ver ni tocar nada más del sistema.
const RUTAS_DEL_AGENTE = [
  { metodo: 'GET', ruta: /^\/pedidos\/pendientes-impresion\/?$/ },
  { metodo: 'POST', ruta: /^\/pedidos\/\d+\/confirmar-impresion\/?$/ }
];

function agenteSoloUsaSusRutas(req) {
  const ruta = req.originalUrl.split('?')[0];
  return RUTAS_DEL_AGENTE.some(r => r.metodo === req.method && r.ruta.test(ruta));
}

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

    if (datosUsuario.esAgente === true && !agenteSoloUsaSusRutas(req)) {
      return res.status(403).json({ error: 'Este token solo sirve para el agente de impresión' });
    }

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