require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db.js');

async function applyMigration() {
  try {
    const sqlPath = path.join(__dirname, '..', '001_add_reset_tokens.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Ejecutando migración: 001_add_reset_tokens.sql');
    await pool.query(sql);
    console.log('Migración aplicada correctamente.');
  } catch (err) {
    console.error('Error aplicando migración:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

applyMigration();
