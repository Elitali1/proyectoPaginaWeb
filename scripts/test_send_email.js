require('dotenv').config();
const emailService = require('../src/services/email.service.js');

async function test() {
  try {
    const to = process.argv[2] || 'donchichopizza@gmail.com';
    const token = 'test-token-' + Date.now();
    console.log('Enviando email de prueba a', to);
    await emailService.sendResetPasswordEmail(to, token);
    console.log('sendResetPasswordEmail finalizó sin lanzar excepción.');
  } catch (err) {
    console.error('Error en sendResetPasswordEmail:', err?.response?.data || err.message || err);
    process.exitCode = 1;
  }
}

test();
