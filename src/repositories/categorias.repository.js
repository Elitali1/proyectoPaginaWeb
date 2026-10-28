const pool = require('../config/db.js');

// Cada categoría trae cuántos productos tiene, para que la pantalla avise antes de borrar.
async function obtenerTodas() {
  const resultado = await pool.query(
    `SELECT c.*, (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id)::int AS cantidad_productos
     FROM categorias c
     ORDER BY c.id`
  );
  return resultado.rows;
}

async function obtenerPorId(id) {
  const resultado = await pool.query(
    `SELECT c.*, (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id)::int AS cantidad_productos
     FROM categorias c WHERE c.id = $1`,
    [id]
  );
  return resultado.rows[0];
}

// ¿Ya existe una categoría con ese nombre (sin distinguir mayúsculas)? excluirId sirve al renombrar.
async function existeNombre(nombre, excluirId = null) {
  const resultado = await pool.query(
    `SELECT 1 FROM categorias WHERE LOWER(nombre) = LOWER($1) AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
    [nombre, excluirId]
  );
  return resultado.rows.length > 0;
}

async function crear(datos) {
  const { nombre, requiere_masa } = datos;
  const resultado = await pool.query(
    `INSERT INTO categorias (nombre, requiere_masa) VALUES ($1, $2) RETURNING *`,
    [nombre, requiere_masa ?? false]
  );
  return resultado.rows[0];
}

async function actualizar(id, datos) {
  const { nombre, requiere_masa } = datos;
  const resultado = await pool.query(
    `UPDATE categorias SET nombre = $1, requiere_masa = $2 WHERE id = $3 RETURNING *`,
    [nombre, requiere_masa ?? false, id]
  );
  return resultado.rows[0];
}

// Borra solo si no tiene productos (el control está en la misma sentencia: no hay carrera entre mirar y borrar).
// Devuelve { borrada: true } o { borrada: false, cantidad } si hay productos, o null si no existe.
async function eliminar(id) {
  const borrado = await pool.query(
    `DELETE FROM categorias
     WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM productos WHERE categoria_id = $1)
     RETURNING id`,
    [id]
  );
  if (borrado.rows.length > 0) return { borrada: true };

  const categoria = await obtenerPorId(id);
  if (!categoria) return null;
  return { borrada: false, cantidad: categoria.cantidad_productos };
}

module.exports = { obtenerTodas, obtenerPorId, existeNombre, crear, actualizar, eliminar };
