const emailService = require('../services/email.service.js');
const { responderError } = require('../utils/errores.js');
const { esTexto, esEmail } = require('../utils/validaciones.js');

async function enviarContacto(req, res) {
  try {
    const { nombre, email, mensaje } = req.body || {};

    if (!nombre || !email || !mensaje) {
      return res.status(400).json({ error: 'Faltan datos (nombre, email o mensaje)' });
    }

    if (!esTexto(nombre, { max: 100 }) || !esTexto(mensaje, { max: 3000 })) {
      return res.status(400).json({ error: 'El nombre o el mensaje son demasiado largos' });
    }

    if (!esEmail(email)) {
      return res.status(400).json({ error: 'El email no es válido' });
    }

    await emailService.sendContactEmail(nombre.trim(), email.trim(), mensaje.trim());

    res.json({ mensaje: 'Mensaje enviado correctamente' });
  } catch (error) {
    responderError(res, error, 'Error al enviar el mensaje');
  }
}

module.exports = { enviarContacto };
