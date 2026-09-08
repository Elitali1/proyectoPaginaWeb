const pool = require('../config/db.js');

async function calcularTotalesDelDia(fecha) {
  const resultado = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN medio_pago = 'efectivo' THEN total ELSE 0 END), 0) AS total_efectivo,
       COALESCE(SUM(CASE WHEN medio_pago = 'transferencia' THEN total ELSE 0 END), 0) AS total_transferencia
     FROM (
       SELECT p.id, p.medio_pago, SUM(pd.cantidad * pd.precio_unitario) AS total
       FROM pedidos p
       JOIN pedido_detalle pd ON pd.pedido_id = p.id
       WHERE DATE((p.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires') - INTERVAL '6 hours') = $1
         AND p.estado != 'cancelado'
       GROUP BY p.id, p.medio_pago
     ) AS totales_por_pedido`,
    [fecha]
  );
  return resultado.rows[0];
}
async function calcularVentasPorProducto(fecha) {
  const resultado = await pool.query(
    `SELECT
       c.nombre AS categoria_nombre,
       CASE WHEN c.nombre = 'Pizzas' THEN 'Pizzas' ELSE p.nombre END AS producto_nombre,
       SUM(pd.cantidad) AS cantidad_vendida
     FROM pedido_detalle pd
     JOIN pedidos ped ON ped.id = pd.pedido_id
     JOIN productos p ON p.id = pd.producto_id
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE DATE((ped.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires') - INTERVAL '6 hours') = $1
       AND ped.estado != 'cancelado'
     GROUP BY c.nombre, CASE WHEN c.nombre = 'Pizzas' THEN 'Pizzas' ELSE p.nombre END
     ORDER BY c.nombre, producto_nombre`,
    [fecha]
  );
  return resultado.rows;
}

async function crear(fecha, cerrado_por) {
  const totales = await calcularTotalesDelDia(fecha);
  const total_general = Number(totales.total_efectivo) + Number(totales.total_transferencia);

  const resultado = await pool.query(
    `INSERT INTO cierre_caja (fecha, total_efectivo, total_transferencia, total_general, cerrado_por)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [fecha, totales.total_efectivo, totales.total_transferencia, total_general, cerrado_por]
  );
  return resultado.rows[0];
}

async function obtenerTodos() {
  const resultado = await pool.query('SELECT * FROM cierre_caja ORDER BY fecha DESC');
  return resultado.rows;
}

async function obtenerPorFecha(fecha) {
  const resultado = await pool.query('SELECT * FROM cierre_caja WHERE fecha = $1', [fecha]);
  return resultado.rows[0];
}

async function actualizar(fecha, cerrado_por) {
  const totales = await calcularTotalesDelDia(fecha);
  const total_general = Number(totales.total_efectivo) + Number(totales.total_transferencia);

  const resultado = await pool.query(
    `UPDATE cierre_caja
     SET total_efectivo = $1, total_transferencia = $2, total_general = $3, cerrado_por = $4, creado_en = NOW()
     WHERE fecha = $5
     RETURNING *`,
    [totales.total_efectivo, totales.total_transferencia, total_general, cerrado_por, fecha]
  );
  return resultado.rows[0];
}
async function obtenerPorRangoFechas(desde, hasta) {
  const resultado = await pool.query(
    'SELECT * FROM cierre_caja WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha DESC',
    [desde, hasta]
  );
  return resultado.rows;
}
module.exports = { calcularTotalesDelDia, calcularVentasPorProducto, crear, obtenerTodos, obtenerPorFecha, actualizar, obtenerPorRangoFechas };