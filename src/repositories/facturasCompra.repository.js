const pool = require('../config/db.js');
const { conTransaccion } = require('../config/transaccion.js');
const insumosRepository = require('./insumos.repository.js');
const { ErrorNegocio } = require('../utils/errores.js');

// Cada compra pertenece a una sucursal: suma el stock y fija el costo de los insumos en esa sucursal.
// Las consultas por id también exigen la sucursal, para que un local no toque las compras del otro.

async function obtenerTodas(sucursalId) {
  const resultado = await pool.query(
    'SELECT * FROM facturas_compra WHERE sucursal_id = $1 ORDER BY fecha DESC',
    [sucursalId]
  );
  return resultado.rows;
}

async function obtenerPorId(id, sucursalId) {
  const resultado = await pool.query(
    'SELECT * FROM facturas_compra WHERE id = $1 AND sucursal_id = $2',
    [id, sucursalId]
  );
  return resultado.rows[0];
}

async function obtenerPorRangoFechas(desde, hasta, sucursalId) {
  const resultado = await pool.query(
    'SELECT * FROM facturas_compra WHERE fecha BETWEEN $1 AND $2 AND sucursal_id = $3 ORDER BY fecha',
    [desde, hasta, sucursalId]
  );
  return resultado.rows;
}

async function crear(datos) {
  const { proveedor, concepto, monto, fecha, archivo_url, subido_por, sucursal_id } = datos;
  const resultado = await pool.query(
    `INSERT INTO facturas_compra (proveedor, concepto, monto, fecha, archivo_url, subido_por, sucursal_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [proveedor, concepto, monto, fecha, archivo_url, subido_por, sucursal_id]
  );
  return resultado.rows[0];
}

// Borra la factura y revierte el stock que había sumado, todo junto: si algo falla no queda a medias.
// Devuelve undefined si la factura no existe (o es de otra sucursal).
async function eliminarConReversion(id, sucursalId) {
  return conTransaccion(async (db) => {
    const existe = await db.query(
      'SELECT id FROM facturas_compra WHERE id = $1 AND sucursal_id = $2 FOR UPDATE',
      [id, sucursalId]
    );
    if (existe.rows.length === 0) return undefined;

    const detalle = await db.query(
      'SELECT insumo_id, cantidad FROM compra_detalle WHERE factura_compra_id = $1',
      [id]
    );
    for (const linea of detalle.rows) {
      await insumosRepository.ajustarStock(linea.insumo_id, -Number(linea.cantidad), sucursalId, db);
    }

    const resultado = await db.query('DELETE FROM facturas_compra WHERE id = $1 RETURNING *', [id]);
    return resultado.rows[0];
  });
}

// Carga el detalle y suma el stock en una transacción: o entra todo o no entra nada.
async function agregarDetalle(facturaCompraId, items, sucursalId) {
  return conTransaccion(async (db) => {
    const factura = await db.query(
      'SELECT id FROM facturas_compra WHERE id = $1 AND sucursal_id = $2 FOR UPDATE',
      [facturaCompraId, sucursalId]
    );
    if (factura.rows.length === 0) {
      throw new ErrorNegocio('Factura de compra no encontrada', 404);
    }

    const detallesCreados = [];

    for (const item of items) {
      const { insumo_id, cantidad, precio_unitario } = item;

      const insumo = await insumosRepository.actualizarStockYCosto(insumo_id, cantidad, precio_unitario, sucursalId, db);
      if (!insumo) {
        throw new ErrorNegocio(`El insumo #${insumo_id} no existe`);
      }

      const resultado = await db.query(
        `INSERT INTO compra_detalle (factura_compra_id, insumo_id, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [facturaCompraId, insumo_id, cantidad, precio_unitario]
      );

      detallesCreados.push(resultado.rows[0]);
    }

    return detallesCreados;
  });
}

async function obtenerDetallePorFactura(facturaCompraId, sucursalId) {
  const resultado = await pool.query(
    `SELECT cd.*, i.nombre AS insumo_nombre, i.unidad_medida
     FROM compra_detalle cd
     JOIN facturas_compra fc ON fc.id = cd.factura_compra_id AND fc.sucursal_id = $2
     JOIN insumos i ON i.id = cd.insumo_id
     WHERE cd.factura_compra_id = $1`,
    [facturaCompraId, sucursalId]
  );
  return resultado.rows;
}

// Último precio pagado por ese insumo en esa sucursal (para avisar si cambió mucho).
async function obtenerUltimoPrecioInsumo(insumoId, sucursalId) {
  const resultado = await pool.query(
    `SELECT cd.precio_unitario, cd.creado_en
     FROM compra_detalle cd
     JOIN facturas_compra fc ON fc.id = cd.factura_compra_id
     WHERE cd.insumo_id = $1 AND fc.sucursal_id = $2
     ORDER BY cd.creado_en DESC
     LIMIT 1`,
    [insumoId, sucursalId]
  );
  return resultado.rows[0];
}

module.exports = { obtenerTodas, obtenerPorId, obtenerPorRangoFechas, crear, eliminarConReversion, agregarDetalle, obtenerDetallePorFactura, obtenerUltimoPrecioInsumo };