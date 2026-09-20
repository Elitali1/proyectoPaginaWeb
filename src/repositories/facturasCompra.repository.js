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
async function agregarDetalle(facturaCompraId, items) {
  const insumosRepository = require('./insumos.repository.js');
  const detallesCreados = [];

  for (const item of items) {
    const { insumo_id, cantidad, precio_unitario } = item;

    const resultado = await pool.query(
      `INSERT INTO compra_detalle (factura_compra_id, insumo_id, cantidad, precio_unitario)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [facturaCompraId, insumo_id, cantidad, precio_unitario]
    );

    await insumosRepository.actualizarStockYCosto(insumo_id, cantidad, precio_unitario);

    detallesCreados.push(resultado.rows[0]);
  }

  return detallesCreados;
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
  const insumosRepository = require('./insumos.repository.js');

  const detalle = await pool.query(
    'SELECT insumo_id, cantidad FROM compra_detalle WHERE factura_compra_id = $1',
    [facturaCompraId]
  );

  for (const linea of detalle.rows) {
    await insumosRepository.ajustarStock(linea.insumo_id, -Number(linea.cantidad));
  }
}
module.exports = { obtenerTodas, obtenerPorId, obtenerPorRangoFechas, crear, eliminar, agregarDetalle, obtenerDetallePorFactura, obtenerUltimoPrecioInsumo, revertirStockPorFactura };