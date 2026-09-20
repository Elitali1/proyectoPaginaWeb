const pool = require('../config/db.js');

async function obtenerTodos() {
  const resultado = await pool.query('SELECT id, nombre, email, rol, creado_en FROM usuarios ORDER BY id');
  return resultado.rows;
}

async function obtenerPorId(id) {
  const resultado = await pool.query('SELECT id, nombre, email, rol, creado_en FROM usuarios WHERE id = $1', [id]);
  return resultado.rows[0];
}

async function obtenerPorEmail(email) {
  const resultado = await pool.query('SELECT * FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);
  return resultado.rows[0];
}

async function incrementFailedLogin(email) {
  const resultado = await pool.query(
    `UPDATE usuarios SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1 WHERE email = $1 RETURNING failed_login_attempts`,
    [email]
  );
  return resultado.rows[0];
}

async function resetFailedLogin(email) {
  const resultado = await pool.query(
    `UPDATE usuarios SET failed_login_attempts = 0, lock_until = NULL WHERE email = $1 RETURNING id`,
    [email]
  );
  return resultado.rows[0];
}

async function setLockUntil(email, until) {
  const resultado = await pool.query(
    `UPDATE usuarios SET lock_until = $1 WHERE email = $2 RETURNING lock_until`,
    [until, email]
  );
  return resultado.rows[0];
}


async function crear(datos) {
  const { nombre, email, password_hash, rol } = datos;
  const resultado = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ($1, LOWER($2), $3, $4)
     RETURNING id, nombre, email, rol, creado_en`,
    [nombre, email, password_hash, rol ?? 'cajero']
  );
  return resultado.rows[0];
}

async function eliminar(id) {
  const resultado = await pool.query(
    'DELETE FROM usuarios WHERE id = $1 RETURNING id, nombre, email, rol',
    [id]
  );
  return resultado.rows[0];
}

async function actualizar(id, datos) {
  const { nombre, email, rol, password_hash } = datos;

  if (password_hash) {
    const resultado = await pool.query(
      `UPDATE usuarios SET nombre = $1, email = $2, rol = $3, password_hash = $4
       WHERE id = $5
       RETURNING id, nombre, email, rol, creado_en`,
      [nombre, email, rol, password_hash, id]
    );
    return resultado.rows[0];
  }

  const resultado = await pool.query(
    `UPDATE usuarios SET nombre = $1, email = $2, rol = $3
     WHERE id = $4
     RETURNING id, nombre, email, rol, creado_en`,
    [nombre, email, rol, id]
  );
  return resultado.rows[0];
}

async function setResetToken(email, tokenHash, vencimiento) {
  const resultado = await pool.query(
    `UPDATE usuarios SET token_reset = $1, token_reset_vencimiento = $2 WHERE email = $3 RETURNING id, email`,
    [tokenHash, vencimiento, email]
  );
  return resultado.rows[0];
}

async function updatePasswordAndClearReset(email, password_hash) {
  const resultado = await pool.query(
    `UPDATE usuarios SET password_hash = $1, token_reset = NULL, token_reset_vencimiento = NULL WHERE email = $2 RETURNING id, email`,
    [password_hash, email]
  );
  return resultado.rows[0];
}

module.exports = { obtenerTodos, obtenerPorId, obtenerPorEmail, crear, eliminar, actualizar, setResetToken, updatePasswordAndClearReset, incrementFailedLogin, resetFailedLogin, setLockUntil };