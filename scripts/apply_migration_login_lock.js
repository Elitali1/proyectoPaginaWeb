require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db.js');

async function apply() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', '002_add_login_lock.sql'), 'utf8');
    console.log('Applying migration 002_add_login_lock.sql');
    await pool.query(sql);
    console.log('Migration applied');
  } catch (err) {
    console.error('Migration error:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
apply();
