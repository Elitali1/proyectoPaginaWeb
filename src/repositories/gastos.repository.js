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
  const { concepto, categoria, monto, fecha, tipo } = datos;
  const resultado = await pool.query(
    `INSERT INTO gastos (concepto, categoria, monto, fecha, tipo, sucursal_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [concepto, categoria || null, monto, fecha, tipo, sucursalId]
  );
  return resultado.rows[0];
}

// Marca un gasto como fijo o variable (y opcionalmente su categoría). Exige la sucursal para que un
// local no toque los gastos del otro.
async function clasificar(id, { tipo, categoria }, sucursalId) {
  const resultado = await pool.query(
    `UPDATE gastos
        SET tipo = $1, categoria = COALESCE($2, categoria)
      WHERE id = $3 AND sucursal_id = $4
      RETURNING *`,
    [tipo, categoria, id, sucursalId]
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

module.exports = { obtenerTodos, obtenerPorRangoFechas, crear, clasificar, eliminar };
