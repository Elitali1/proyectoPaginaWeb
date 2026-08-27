const axios = require('axios');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'no-reply@example.com';
const SENDER_NAME = process.env.SENDER_NAME || 'Mi App';

async function sendResetPasswordEmail(toEmail, token) {
  const resetLink = `${FRONTEND_URL}/resetear-password.html?token=${encodeURIComponent(token)}&email=${encodeURIComponent(
    toEmail
  )}`;

  const htmlContent = `
  <html>
    <body>
      <p>Se solicitó restablecer la contraseña de tu cuenta.</p>
      <p>Hacé click en el siguiente enlace para cargar una nueva contraseña. El enlace expira en 1 hora.</p>
      <p><a href="${resetLink}">Restablecer contraseña</a></p>
      <p>Si no solicitaste esto, podés ignorar este correo.</p>
    </body>
  </html>`;

  if (!BREVO_API_KEY) {
    // Para desarrollo: loguear el link en lugar de enviar el email, así podés probar sin clave
    console.warn('BREVO_API_KEY no configurada — no se enviará email. Link de reset (dev):', resetLink);
    return;
  }

  const payload = {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: toEmail }],
    subject: 'Restablecer contraseña',
    htmlContent,
  };

  try {
    const res = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    // Loguear y devolver la respuesta de Brevo para diagnóstico
    // Return Brevo response for callers but avoid logging sensitive details in production
    return res.data;
  } catch (error) {
    console.error('Error enviando email de reset:', error?.response?.data || error.message || error);
    throw error;
  }
}

module.exports = { sendResetPasswordEmail };