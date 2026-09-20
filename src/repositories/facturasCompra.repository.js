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
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const factura = await cliente.query('SELECT * FROM facturas_compra WHERE id = $1 FOR UPDATE', [id]);
    if (!factura.rows[0]) {
      await cliente.query('ROLLBACK');
      return null;
    }
    const detalle = await cliente.query(
      'SELECT insumo_id, cantidad FROM compra_detalle WHERE factura_compra_id = $1',
      [id]
    );
    for (const linea of detalle.rows) {
      await cliente.query(
        'UPDATE insumos SET stock_actual = stock_actual - $1 WHERE id = $2',
        [linea.cantidad, linea.insumo_id]
      );
    }
    await cliente.query('DELETE FROM compra_detalle WHERE factura_compra_id = $1', [id]);
    const resultado = await cliente.query(
      'DELETE FROM facturas_compra WHERE id = $1 RETURNING *',
      [id]
    );
    await cliente.query('COMMIT');
    return resultado.rows[0];
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
async function agregarDetalle(facturaCompraId, items) {
  const insumosRepository = require('./insumos.repository.js');
  const detallesCreados = [];
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');
    const factura = await cliente.query('SELECT id FROM facturas_compra WHERE id = $1 FOR UPDATE', [facturaCompraId]);
    if (!factura.rows[0]) throw new Error('Factura de compra no encontrada');

    for (const item of items) {
      const { insumo_id, cantidad, precio_unitario } = item;
      const insumo = await cliente.query('SELECT id FROM insumos WHERE id = $1 FOR UPDATE', [insumo_id]);
      if (!insumo.rows[0]) throw new Error('Insumo no encontrado');

      const resultado = await cliente.query(
        `INSERT INTO compra_detalle (factura_compra_id, insumo_id, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [facturaCompraId, insumo_id, cantidad, precio_unitario]
      );

      await cliente.query(
        `UPDATE insumos SET stock_actual = stock_actual + $1, costo_unitario = $2 WHERE id = $3`,
        [cantidad, precio_unitario, insumo_id]
      );
      detallesCreados.push(resultado.rows[0]);
    }

    await cliente.query('COMMIT');
    return detallesCreados;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

async function obtenerDetallePorFactura(facturaCompraId) {
  const resultado = await pool.query(
    `SELECT cd.*, i.nombre AS insumo_nombre, i.unidad_medida
     FROM compra_detalle cd
     JOIN insumos i ON i.id = cd.insumo_id
     WHERE cd.factura_compra_id = $1`,
    [facturaCompraId]
  );
  return resultado.rows;
}

async function obtenerUltimoPrecioInsumo(insumoId) {
  const resultado = await pool.query(
    `SELECT precio_unitario, creado_en
     FROM compra_detalle
     WHERE insumo_id = $1
     ORDER BY creado_en DESC
     LIMIT 1`,
    [insumoId]
  );
  return resultado.rows[0];
}
async function revertirStockPorFactura(facturaCompraId) {
  return eliminar(facturaCompraId);
}
module.exports = { obtenerTodas, obtenerPorId, obtenerPorRangoFechas, crear, eliminar, agregarDetalle, obtenerDetallePorFactura, obtenerUltimoPrecioInsumo, revertirStockPorFactura };