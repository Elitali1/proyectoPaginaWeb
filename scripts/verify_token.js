require('dotenv').config();
const crypto = require('crypto');
const pool = require('../src/config/db.js');

async function verify(token, email) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  console.log('Computed token SHA256:', tokenHash);

  try {
    const res = await pool.query('SELECT token_reset, token_reset_vencimiento FROM usuarios WHERE email = $1', [email]);
    const row = res.rows[0];
    console.log('DB token_reset:', row ? row.token_reset : null);
    console.log('DB token_reset_vencimiento:', row ? row.token_reset_vencimiento : null);

    if (!row || !row.token_reset) {
      console.log('Result: No token present in DB (already used or not set)');
      return;
    }

    if (row.token_reset === tokenHash) {
      console.log('Result: MATCH — token correcto y válido (por hash).');
    } else {
      console.log('Result: NOT MATCH — token inválido (hash no coincide).');
    }
  } catch (err) {
    console.error('DB error:', err.message || err);
  } finally {
    await pool.end();
  }
}

const token = process.argv[2];
const email = process.argv[3];
if (!token || !email) { console.error('Usage: node verify_token.js <token> <email>'); process.exit(1); }
verify(token, decodeURIComponent(email));
