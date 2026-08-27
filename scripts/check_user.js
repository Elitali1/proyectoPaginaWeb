require('dotenv').config();
const pool = require('../src/config/db.js');

async function checkUser(email) {
  try {
    const res = await pool.query('SELECT id, nombre, email, token_reset, token_reset_vencimiento FROM usuarios WHERE email = $1', [email]);
    console.log(JSON.stringify(res.rows[0] || null, null, 2));
  } catch (err) {
    console.error('Error querying DB:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

const email = process.argv[2] || 'donchichopizza@gmail.com';
checkUser(email);
