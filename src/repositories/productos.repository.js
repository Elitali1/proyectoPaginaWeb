const pool = require('../config/db.js');

async function obtenerTodos() {
  const resultado = await pool.query(`
    SELECT p.*, c.nombre AS categoria_nombre, c.requiere_masa
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    ORDER BY p.id
  `);
  return resultado.rows;
}

async function obtenerPorId(id) {
  const resultado = await pool.query(`
    SELECT p.*, c.nombre AS categoria_nombre, c.requiere_masa
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.id = $1
  `, [id]);
  return resultado.rows[0];
}

async function crear(datos) {
  const { nombre, precio, disponible, imagen, categoria_id } = datos;
  const resultado = await pool.query(
    `INSERT INTO productos (nombre, precio, disponible, imagen, categoria_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [nombre, precio, disponible ?? true, imagen || null, categoria_id || null]
  );
  return resultado.rows[0];
}

async function actualizar(id, datos) {
  const { nombre, precio, disponible, imagen, categoria_id } = datos;
  const resultado = await pool.query(
    `UPDATE productos SET nombre = $1, precio = $2, disponible = $3, imagen = $4, categoria_id = $5
     WHERE id = $6
     RETURNING *`,
    [nombre, precio, disponible, imagen || null, categoria_id || null, id]
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