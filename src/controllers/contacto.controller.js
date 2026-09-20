const emailService = require('../services/email.service.js');

async function enviarContacto(req, res) {
  try {
    const { nombre, email, mensaje } = req.body;

    if (!nombre || !email || !mensaje) {
      return res.status(400).json({ error: 'Faltan datos (nombre, email o mensaje)' });
    }

    await emailService.sendContactEmail(nombre, email, mensaje);

    res.json({ mensaje: 'Mensaje enviado correctamente' });
  } catch (error) {
    console.error('Error al enviar mensaje de contacto:', error);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
}

module.exports = { enviarContacto };