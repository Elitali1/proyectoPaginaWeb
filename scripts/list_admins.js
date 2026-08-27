require('dotenv').config();
const pool = require('../src/config/db.js');

async function listAdmins() {
  try {
    const res = await pool.query("SELECT id, nombre, email FROM usuarios WHERE rol = 'admin'");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error querying DB:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

listAdmins();
