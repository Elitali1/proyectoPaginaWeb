const pool = require('../config/db.js');

// Los gastos son por sucursal: cada local ve y carga solo los suyos.
async function obtenerTodos(sucursalId) {
  const resultado = await pool.query('SELECT * FROM gastos WHERE sucursal_id = $1 ORDER BY fecha DESC', [sucursalId]);
  return resultado.rows;
}

async function obtenerPorRangoFechas(desde, hasta, sucursalId) {
  const resultado = await pool.query(
    'SELECT * FROM gastos WHERE fecha BETWEEN $1 AND $2 AND sucursal_id = $3 ORDER BY fecha',
    [desde, hasta, sucursalId]
  );
  return resultado.rows;
}

async function crear(datos, sucursalId) {
  const { concepto, categoria, monto, fecha } = datos;
  const resultado = await pool.query(
    `INSERT INTO gastos (concepto, categoria, monto, fecha, sucursal_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [concepto, categoria || null, monto, fecha, sucursalId]
  );
  return resultado.rows[0];
}

async function eliminar(id, sucursalId) {
  const resultado = await pool.query(
    'DELETE FROM gastos WHERE id = $1 AND sucursal_id = $2 RETURNING *',
    [id, sucursalId]
  );
  return resultado.rows[0];
}

module.exports = { obtenerTodos, obtenerPorRangoFechas, crear, eliminar };