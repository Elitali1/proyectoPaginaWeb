require('dotenv').config();
const crypto = require('crypto');
const usuariosRepository = require('../src/repositories/usuarios.repository.js');
const pool = require('../src/config/db.js');
const axios = require('axios');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'; // for requests against local server

async function run() {
  try {
    const adminsRes = await pool.query("SELECT id, email FROM usuarios WHERE rol = 'admin'");
    const admins = adminsRes.rows;
    if (!admins || admins.length === 0) {
      console.log('No hay administradores para probar.');
      return;
    }

    for (const a of admins) {
      const email = a.email;
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const vencimiento = new Date(Date.now() + 60 * 60 * 1000);

      await usuariosRepository.setResetToken(email, tokenHash, vencimiento);
      const resetLink = `${FRONTEND_URL}/resetear-password.html?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
      console.log('\n--- Generado reset para:', email);
      console.log('Reset link (usar en navegador):', resetLink);

      // Now call confirmar-reset endpoint to simulate user clicking link and choosing new password
      const newPassword = 'PruebaReset2026!';
      console.log('Confirmando reset con nueva contraseña:', newPassword);
      try {
        const resp = await axios.post(`${BASE_URL}/usuarios/confirmar-reset`, { email, token, password: newPassword }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
        console.log('confirmar-reset response:', resp.data);
      } catch (err) {
        console.error('Error al llamar confirmar-reset:', err.response?.data || err.message || err);
        continue;
      }

      // Verify DB: token_reset should be null
      const verify = await pool.query('SELECT id, email, token_reset, token_reset_vencimiento FROM usuarios WHERE email = $1', [email]);
      console.log('DB after confirm:', verify.rows[0]);
    }
  } catch (err) {
    console.error('Error en full reset test:', err.message || err);
  } finally {
    await pool.end();
  }
}

run();
