const pool = require('../config/db.js');

async function obtenerTodas() {
  const resultado = await pool.query('SELECT * FROM categorias ORDER BY id');
  return resultado.rows;
}

async function crear(datos) {
  const { nombre, requiere_masa } = datos;
  const resultado = await pool.query(
    `INSERT INTO categorias (nombre, requiere_masa) VALUES ($1, $2) RETURNING *`,
    [nombre, requiere_masa ?? false]
  );
  return resultado.rows[0];
}

module.exports = { obtenerTodas, crear };