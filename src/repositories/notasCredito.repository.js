const pool = require('../config/db.js');

async function crear(datos) {
  const { factura_id, numero_comprobante, cae, vencimiento_cae, monto, motivo, pto_vta } = datos;
  const resultado = await pool.query(
    `INSERT INTO notas_credito (factura_id, numero_comprobante, cae, vencimiento_cae, monto, motivo, pto_vta)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [factura_id, numero_comprobante, cae, vencimiento_cae, monto, motivo || null, pto_vta]
  );
  return resultado.rows[0];
}

async function obtenerPorFactura(factura_id) {
  const resultado = await pool.query(
    'SELECT * FROM notas_credito WHERE factura_id = $1',
    [factura_id]
  );
  return resultado.rows;
}

module.exports = { crear, obtenerPorFactura };