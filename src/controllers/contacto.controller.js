const emailService = require('../services/email.service.js');

async function enviarContacto(req, res) {
  try {
    const { nombre, email, mensaje } = req.body;

    if (
      typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.length > 100 ||
      typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
      typeof mensaje !== 'string' || mensaje.trim().length < 1 || mensaje.length > 5000
    ) {
      return res.status(400).json({ error: 'Faltan datos (nombre, email o mensaje)' });
    }

    await emailService.sendContactEmail(nombre.trim(), email.trim().toLowerCase(), mensaje.trim());

    res.json({ mensaje: 'Mensaje enviado correctamente' });
  } catch (error) {
    console.error('Error al enviar mensaje de contacto:', error);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
}

module.exports = { enviarContacto };