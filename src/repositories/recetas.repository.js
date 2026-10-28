const pool = require('../config/db.js');
const { conTransaccion } = require('../config/transaccion.js');

// Las recetas son compartidas entre sucursales. Lo que cambia por sucursal es el costo de cada
// insumo (insumo_sucursal), por eso el costo y el margen se calculan con la sucursal indicada.

async function obtenerPorProducto(productoId, sucursalId, cliente = pool) {
  const resultado = await cliente.query(
    `SELECT rd.*, i.nombre AS insumo_nombre, i.unidad_medida,
            COALESCE(s.costo_unitario, 0) AS costo_unitario
     FROM receta_detalle rd
     JOIN insumos i ON i.id = rd.insumo_id
     LEFT JOIN insumo_sucursal s ON s.insumo_id = i.id AND s.sucursal_id = $2
     WHERE rd.producto_id = $1`,
    [productoId, sucursalId]
  );
  return resultado.rows;
}

// Borrar e insertar va en una transacción: si algo falla a mitad, la receta anterior queda intacta
// (antes podía quedar vacía o incompleta y el producto dejaba de descontar stock sin avisar).
async function reemplazarReceta(productoId, items, sucursalId) {
  await conTransaccion(async (db) => {
    await db.query('DELETE FROM receta_detalle WHERE producto_id = $1', [productoId]);

    for (const item of items) {
      await db.query(
        `INSERT INTO receta_detalle (producto_id, insumo_id, cantidad)
         VALUES ($1, $2, $3)`,
        [productoId, item.insumo_id, item.cantidad]
      );
    }
  });

  return obtenerPorProducto(productoId, sucursalId);
}

async function calcularCostoProducto(productoId, sucursalId) {
  const resultado = await pool.query(
    `SELECT COALESCE(SUM(rd.cantidad * COALESCE(s.costo_unitario, 0)), 0) AS costo_total
     FROM receta_detalle rd
     LEFT JOIN insumo_sucursal s ON s.insumo_id = rd.insumo_id AND s.sucursal_id = $2
     WHERE rd.producto_id = $1`,
    [productoId, sucursalId]
  );
  return Number(resultado.rows[0].costo_total);
}

async function obtenerMejoresMargenes(limite = 10, sucursalId) {
  const resultado = await pool.query(
    `SELECT
       p.id,
       p.nombre,
       ps.precio AS precio_venta,
       COALESCE(SUM(rd.cantidad * COALESCE(s.costo_unitario, 0)), 0) AS costo
     FROM productos p
     JOIN productos_sucursal ps ON ps.producto_id = p.id AND ps.sucursal_id = $2
     LEFT JOIN receta_detalle rd ON rd.producto_id = p.id
     LEFT JOIN insumo_sucursal s ON s.insumo_id = rd.insumo_id AND s.sucursal_id = $2
     WHERE ps.disponible = true
     GROUP BY p.id, p.nombre, ps.precio
     HAVING COALESCE(SUM(rd.cantidad * COALESCE(s.costo_unitario, 0)), 0) > 0
     ORDER BY (ps.precio - COALESCE(SUM(rd.cantidad * COALESCE(s.costo_unitario, 0)), 0)) / ps.precio DESC
     LIMIT $1`,
    [limite, sucursalId]
  );

  return resultado.rows.map(fila => {
    const precioVenta = Number(fila.precio_venta);
    const costo = Number(fila.costo);
    const margenPorcentual = ((precioVenta - costo) / precioVenta) * 100;
    return {
      id: fila.id,
      nombre: fila.nombre,
      precioVenta,
      costo,
      margenPorcentual: Number(margenPorcentual.toFixed(1))
    };
  });
}

module.exports = { obtenerPorProducto, reemplazarReceta, calcularCostoProducto, obtenerMejoresMargenes };