const pool = require('../config/db.js');

async function obtenerTodos() {
  const resultado = await pool.query('SELECT * FROM productos ORDER BY id');
  return resultado.rows;
}

async function obtenerPorId(id) {
  const resultado = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
  return resultado.rows[0];
}

async function crear(datos) {
  const { nombre, precio, disponible, imagen } = datos;
  const resultado = await pool.query(
    `INSERT INTO productos (nombre, precio, disponible, imagen)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nombre, precio, disponible ?? true, imagen || null]
  );
  return resultado.rows[0];
}

async function actualizar(id, datos) {
  const { nombre, precio, disponible, imagen } = datos;
  const resultado = await pool.query(
    `UPDATE productos SET nombre = $1, precio = $2, disponible = $3, imagen = $4
     WHERE id = $5
     RETURNING *`,
    [nombre, precio, disponible, imagen || null, id]
  );
  return resultado.rows[0];
}

async function eliminar(id) {
  const resultado = await pool.query(
    'DELETE FROM productos WHERE id = $1 RETURNING *',
    [id]
  );
  return resultado.rows[0];
}

async function actualizarImagen(id, imagen) {
  const resultado = await pool.query(
    'UPDATE productos SET imagen = $1 WHERE id = $2 RETURNING *',
    [imagen, id]
  );
  return resultado.rows[0];
}

module.exports = { obtenerTodos, obtenerPorId, crear, actualizar, eliminar, actualizarImagen };