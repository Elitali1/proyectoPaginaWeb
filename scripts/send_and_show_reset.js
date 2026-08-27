require('dotenv').config();
const crypto = require('crypto');
const usuariosRepository = require('../src/repositories/usuarios.repository.js');
const emailService = require('../src/services/email.service.js');

async function send(email) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const venc = new Date(Date.now() + 60*60*1000);
  await usuariosRepository.setResetToken(email, tokenHash, venc);
  // send email
  try {
    const res = await emailService.sendResetPasswordEmail(email, token);
    console.log('Enviado (Brevo response):', res || 'no response body');
  } catch (err) {
    console.error('Error enviando email (pero token guardado):', err?.response?.data || err.message || err);
  }
  const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/resetear-password.html?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  console.log('Reset link (usar o pegar en navegador):', link);
}

const email = process.argv[2];
if (!email) { console.error('Uso: node send_and_show_reset.js email'); process.exit(1); }
send(email).then(()=>process.exit(0)).catch(e=>{console.error(e); process.exit(1);});