const pool = require('../config/db.js');

async function obtenerTodos() {
  const resultado = await pool.query('SELECT * FROM gastos ORDER BY fecha DESC');
  return resultado.rows;
}

async function obtenerPorRangoFechas(desde, hasta) {
  const resultado = await pool.query(
    'SELECT * FROM gastos WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha',
    [desde, hasta]
  );
  return resultado.rows;
}

async function crear(datos) {
  const { concepto, categoria, monto, fecha } = datos;
  const resultado = await pool.query(
    `INSERT INTO gastos (concepto, categoria, monto, fecha)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [concepto, categoria || null, monto, fecha]
  );
  return resultado.rows[0];
}

async function eliminar(id) {
  const resultado = await pool.query(
    'DELETE FROM gastos WHERE id = $1 RETURNING *',
    [id]
  );
  return resultado.rows[0];
}

module.exports = { obtenerTodos, obtenerPorRangoFechas, crear, eliminar };