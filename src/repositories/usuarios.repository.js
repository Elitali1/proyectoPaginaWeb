const pool = require('../config/db.js');

// Todas las búsquedas por email ignoran mayúsculas/minúsculas (igual que obtenerPorEmail), para que
// el contador de intentos fallidos y el token de reset se guarden aunque el usuario escriba el
// email con otra capitalización.

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

async function contarAdmins() {
  const resultado = await pool.query("SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'admin'");
  return resultado.rows[0].total;
}

async function incrementFailedLogin(email) {
  const resultado = await pool.query(
    `UPDATE usuarios SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1 WHERE LOWER(email) = LOWER($1) RETURNING failed_login_attempts`,
    [email]
  );
  return resultado.rows[0];
}

async function resetFailedLogin(email) {
  const resultado = await pool.query(
    `UPDATE usuarios SET failed_login_attempts = 0, lock_until = NULL WHERE LOWER(email) = LOWER($1) RETURNING id`,
    [email]
  );
  return resultado.rows[0];
}

async function setLockUntil(email, until) {
  const resultado = await pool.query(
    `UPDATE usuarios SET lock_until = $1 WHERE LOWER(email) = LOWER($2) RETURNING lock_until`,
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
      `UPDATE usuarios SET nombre = $1, email = LOWER($2), rol = $3, password_hash = $4
       WHERE id = $5
       RETURNING id, nombre, email, rol, creado_en`,
      [nombre, email, rol, password_hash, id]
    );
    return resultado.rows[0];
  }

  const resultado = await pool.query(
    `UPDATE usuarios SET nombre = $1, email = LOWER($2), rol = $3
     WHERE id = $4
     RETURNING id, nombre, email, rol, creado_en`,
    [nombre, email, rol, id]
  );
  return resultado.rows[0];
}

async function setResetToken(email, tokenHash, vencimiento) {
  const resultado = await pool.query(
    `UPDATE usuarios SET token_reset = $1, token_reset_vencimiento = $2 WHERE LOWER(email) = LOWER($3) RETURNING id, email`,
    [tokenHash, vencimiento, email]
  );
  return resultado.rows[0];
}

// Además de guardar la contraseña nueva, levanta cualquier bloqueo por intentos fallidos.
async function updatePasswordAndClearReset(email, password_hash) {
  const resultado = await pool.query(
    `UPDATE usuarios
     SET password_hash = $1, token_reset = NULL, token_reset_vencimiento = NULL,
         failed_login_attempts = 0, lock_until = NULL
     WHERE LOWER(email) = LOWER($2)
     RETURNING id, email`,
    [password_hash, email]
  );
  return resultado.rows[0];
}

module.exports = { obtenerTodos, obtenerPorId, obtenerPorEmail, contarAdmins, crear, eliminar, actualizar, setResetToken, updatePasswordAndClearReset, incrementFailedLogin, resetFailedLogin, setLockUntil };
