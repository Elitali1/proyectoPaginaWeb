const pool = require('../config/db.js');

async function obtenerPorProducto(productoId) {
  const resultado = await pool.query(
    `SELECT rd.*, i.nombre AS insumo_nombre, i.unidad_medida, i.costo_unitario
     FROM receta_detalle rd
     JOIN insumos i ON i.id = rd.insumo_id
     WHERE rd.producto_id = $1`,
    [productoId]
  );
  return resultado.rows;
}

async function reemplazarReceta(productoId, items) {
  await pool.query('DELETE FROM receta_detalle WHERE producto_id = $1', [productoId]);

  for (const item of items) {
    await pool.query(
      `INSERT INTO receta_detalle (producto_id, insumo_id, cantidad)
       VALUES ($1, $2, $3)`,
      [productoId, item.insumo_id, item.cantidad]
    );
  }

  return obtenerPorProducto(productoId);
}

async function calcularCostoProducto(productoId) {
  const resultado = await pool.query(
    `SELECT COALESCE(SUM(rd.cantidad * i.costo_unitario), 0) AS costo_total
     FROM receta_detalle rd
     JOIN insumos i ON i.id = rd.insumo_id
     WHERE rd.producto_id = $1`,
    [productoId]
  );
  return Number(resultado.rows[0].costo_total);
}
async function obtenerMejoresMargenes(limite = 10) {
  const resultado = await pool.query(
    `SELECT
       p.id,
       p.nombre,
       p.precio AS precio_venta,
       COALESCE(SUM(rd.cantidad * i.costo_unitario), 0) AS costo
     FROM productos p
     LEFT JOIN receta_detalle rd ON rd.producto_id = p.id
     LEFT JOIN insumos i ON i.id = rd.insumo_id
     WHERE p.disponible = true
     GROUP BY p.id, p.nombre, p.precio
     HAVING COALESCE(SUM(rd.cantidad * i.costo_unitario), 0) > 0
     ORDER BY (p.precio - COALESCE(SUM(rd.cantidad * i.costo_unitario), 0)) / p.precio DESC
     LIMIT $1`,
    [limite]
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