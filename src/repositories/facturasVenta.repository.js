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
  const resultado = await pool.query('SELECT * FROM facturas_venta WHERE pedido_id = $1 ORDER BY id DESC LIMIT 1', [pedido_id]);
  return resultado.rows[0];
}

async function crear(datos) {
  const { pedido_id, tipo_comprobante, monto } = datos;
  if (!Number.isInteger(Number(pedido_id)) || Number(pedido_id) <= 0) {
    throw new Error('pedido_id inválido');
  }
  if (!Number.isFinite(Number(monto)) || Number(monto) <= 0) {
    throw new Error('El monto de la factura debe ser positivo');
  }
  const resultado = await pool.query(
    `INSERT INTO facturas_venta (pedido_id, tipo_comprobante, monto, estado)
     VALUES ($1, $2, $3, 'pendiente')
     RETURNING *`,
    [pedido_id, tipo_comprobante, monto]
  );
  return resultado.rows[0];
}

async function iniciarFacturacion(pedidoId, monto, tipoComprobante = 'Factura C') {
  if (!Number.isInteger(Number(pedidoId)) || Number(pedidoId) <= 0) {
    throw new Error('pedido_id inválido');
  }
  if (!Number.isFinite(Number(monto)) || Number(monto) <= 0) {
    throw new Error('El monto de la factura debe ser positivo');
  }
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock($1::bigint)', [Number(pedidoId)]);
    const existente = await cliente.query(
      'SELECT * FROM facturas_venta WHERE pedido_id = $1 ORDER BY id DESC LIMIT 1',
      [pedidoId]
    );
    if (existente.rows[0]) {
      await cliente.query('COMMIT');
      cliente.release();
      return { cliente: null, factura: existente.rows[0] };
    }
    const creada = await cliente.query(
      `INSERT INTO facturas_venta (pedido_id, tipo_comprobante, monto, estado)
       VALUES ($1, $2, $3, 'pendiente')
       RETURNING *`,
      [pedidoId, tipoComprobante, monto]
    );
    return { cliente, factura: creada.rows[0] };
  } catch (error) {
    await cliente.query('ROLLBACK');
    cliente.release();
    throw error;
  }
}

async function completarFacturacion(cliente, id, numeroComprobante, cae, vencimientoCae) {
  const resultado = await cliente.query(
    `UPDATE facturas_venta
     SET estado = 'emitida', numero_comprobante = $1, cae = $2, vencimiento_cae = $3
     WHERE id = $4 AND estado = 'pendiente'
     RETURNING *`,
    [numeroComprobante, cae, vencimientoCae, id]
  );
  if (!resultado.rows[0]) throw new Error('La factura ya no está pendiente');
  await cliente.query('COMMIT');
  cliente.release();
  return resultado.rows[0];
}

async function fallarFacturacion(cliente, id) {
  try {
    await cliente.query('UPDATE facturas_venta SET estado = $1 WHERE id = $2 AND estado = $3', ['error', id, 'pendiente']);
    await cliente.query('COMMIT');
  } finally {
    cliente.release();
  }
}

async function marcarEmitida(id, numero_comprobante, cae, vencimiento_cae) {
  const resultado = await pool.query(
    `UPDATE facturas_venta
     SET estado = 'emitida', numero_comprobante = $1, cae = $2, vencimiento_cae = $3
     WHERE id = $4 AND estado = 'pendiente'
     RETURNING *`,
    [numero_comprobante, cae, vencimiento_cae, id]
  );
  return resultado.rows[0];
}

async function marcarError(id) {
  const resultado = await pool.query(
    `UPDATE facturas_venta SET estado = 'error' WHERE id = $1 AND estado = 'pendiente' RETURNING *`,
    [id]
  );
  return resultado.rows[0];
}

module.exports = {
  obtenerTodas,
  obtenerPorId,
  obtenerPorPedido,
  crear,
  iniciarFacturacion,
  completarFacturacion,
  fallarFacturacion,
  marcarEmitida,
  marcarError
};