const pool = require('../config/db.js');

async function obtenerTodos() {
  const resultado = await pool.query('SELECT * FROM clientes ORDER BY id');
  return resultado.rows;
}

async function obtenerPorId(id) {
  const resultado = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
  return resultado.rows[0];
}

async function crear(datos) {
  const { nombre, telefono, direccion } = datos;
  const resultado = await pool.query(
    `INSERT INTO clientes (nombre, telefono, direccion)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [nombre, telefono, direccion]
  );
  return resultado.rows[0];
}

async function actualizar(id, datos) {
  const { nombre, telefono, direccion } = datos;
  const resultado = await pool.query(
    `UPDATE clientes SET nombre = $1, telefono = $2, direccion = $3
     WHERE id = $4
     RETURNING *`,
    [nombre, telefono, direccion, id]
  );
  return resultado.rows[0];
}

async function eliminar(id) {
  const resultado = await pool.query(
    'DELETE FROM clientes WHERE id = $1 RETURNING *',
    [id]
  );
  return resultado.rows[0];
}

module.exports = { obtenerTodos, obtenerPorId, crear, actualizar, eliminar };