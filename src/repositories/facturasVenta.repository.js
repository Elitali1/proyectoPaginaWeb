const pool = require('../config/db.js');

async function obtenerTodas() {
  const resultado = await pool.query('SELECT * FROM facturas_venta ORDER BY id DESC');
  return resultado.rows;
}

async function obtenerPorId(id) {
  const resultado = await pool.query('SELECT * FROM facturas_venta WHERE id = $1', [id]);
  return resultado.rows[0];
}

async function obtenerPorPedido(pedido_id) {
  const resultado = await pool.query('SELECT * FROM facturas_venta WHERE pedido_id = $1', [pedido_id]);
  return resultado.rows[0];
}

async function crear(datos) {
  const { pedido_id, tipo_comprobante, monto } = datos;
  const resultado = await pool.query(
    `INSERT INTO facturas_venta (pedido_id, tipo_comprobante, monto, estado)
     VALUES ($1, $2, $3, 'pendiente')
     RETURNING *`,
    [pedido_id, tipo_comprobante, monto]
  );
  return resultado.rows[0];
}

async function marcarEmitida(id, numero_comprobante, cae, vencimiento_cae) {
  const resultado = await pool.query(
    `UPDATE facturas_venta
     SET estado = 'emitida', numero_comprobante = $1, cae = $2, vencimiento_cae = $3
     WHERE id = $4
     RETURNING *`,
    [numero_comprobante, cae, vencimiento_cae, id]
  );
  return resultado.rows[0];
}

async function marcarError(id) {
  const resultado = await pool.query(
    `UPDATE facturas_venta SET estado = 'error' WHERE id = $1 RETURNING *`,
    [id]
  );
  return resultado.rows[0];
}

module.exports = { obtenerTodas, obtenerPorId, obtenerPorPedido, crear, marcarEmitida, marcarError };