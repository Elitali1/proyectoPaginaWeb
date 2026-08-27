const pool = require('../config/db.js');

async function obtenerTodas() {
  const resultado = await pool.query('SELECT * FROM facturas_compra ORDER BY fecha DESC');
  return resultado.rows;
}

async function obtenerPorId(id) {
  const resultado = await pool.query('SELECT * FROM facturas_compra WHERE id = $1', [id]);
  return resultado.rows[0];
}

async function obtenerPorRangoFechas(desde, hasta) {
  const resultado = await pool.query(
    'SELECT * FROM facturas_compra WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha',
    [desde, hasta]
  );
  return resultado.rows;
}

async function crear(datos) {
  const { proveedor, concepto, monto, fecha, archivo_url, subido_por } = datos;
  const resultado = await pool.query(
    `INSERT INTO facturas_compra (proveedor, concepto, monto, fecha, archivo_url, subido_por)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [proveedor, concepto, monto, fecha, archivo_url, subido_por]
  );
  return resultado.rows[0];
}

async function eliminar(id) {
  const resultado = await pool.query(
    'DELETE FROM facturas_compra WHERE id = $1 RETURNING *',
    [id]
  );
  return resultado.rows[0];
}

module.exports = { obtenerTodas, obtenerPorId, obtenerPorRangoFechas, crear, eliminar };