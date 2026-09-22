const pool = require('../config/db.js');
const { diaComercial } = require('./sqlFechas.js');

async function calcularTotalesDelDia(fecha) {
  const resultado = await pool.query(
    `SELECT
       COALESCE(SUM(
         CASE
           WHEN medio_pago = 'efectivo' THEN total
           WHEN medio_pago = 'mixto' THEN monto_efectivo
           ELSE 0
         END
       ), 0) AS total_efectivo,
       COALESCE(SUM(
         CASE
           WHEN medio_pago = 'transferencia' THEN total
           WHEN medio_pago = 'mixto' THEN monto_transferencia
           ELSE 0
         END
       ), 0) AS total_transferencia
     FROM (
       SELECT p.id, p.medio_pago, p.monto_efectivo, p.monto_transferencia,
              SUM(pd.cantidad * pd.precio_unitario) AS total
       FROM pedidos p
       JOIN pedido_detalle pd ON pd.pedido_id = p.id
       WHERE ${diaComercial('p.creado_en')} = $1
         AND p.estado != 'cancelado'
       GROUP BY p.id, p.medio_pago, p.monto_efectivo, p.monto_transferencia
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
     WHERE ${diaComercial('ped.creado_en')} = $1
       AND ped.estado != 'cancelado'
     GROUP BY c.nombre, CASE WHEN c.nombre = 'Pizzas' THEN 'Pizzas' ELSE p.nombre END
     ORDER BY c.nombre, producto_nombre`,
    [fecha]
  );
  return resultado.rows;
}

// Ventas por producto de todos los días de un rango con UNA sola consulta (antes se hacía una por día).
// Devuelve un objeto { 'AAAA-MM-DD': [filas...] }.
async function calcularVentasPorProductoEnRango(desde, hasta) {
  const resultado = await pool.query(
    `SELECT
       to_char(${diaComercial('ped.creado_en')}, 'YYYY-MM-DD') AS dia,
       c.nombre AS categoria_nombre,
       CASE WHEN c.nombre = 'Pizzas' THEN 'Pizzas' ELSE p.nombre END AS producto_nombre,
       SUM(pd.cantidad) AS cantidad_vendida
     FROM pedido_detalle pd
     JOIN pedidos ped ON ped.id = pd.pedido_id
     JOIN productos p ON p.id = pd.producto_id
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE ${diaComercial('ped.creado_en')} BETWEEN $1 AND $2
       AND ped.estado != 'cancelado'
     GROUP BY dia, c.nombre, CASE WHEN c.nombre = 'Pizzas' THEN 'Pizzas' ELSE p.nombre END
     ORDER BY c.nombre, producto_nombre`,
    [desde, hasta]
  );

  const porDia = {};
  for (const { dia, ...fila } of resultado.rows) {
    if (!porDia[dia]) porDia[dia] = [];
    porDia[dia].push(fila);
  }
  return porDia;
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
async function calcularResumenPeriodo(desde, hasta) {
  const resumen = await pool.query(
    `SELECT
       COUNT(DISTINCT p.id) AS cantidad_pedidos,
       COALESCE(SUM(pd.cantidad * pd.precio_unitario), 0) AS ventas_totales
     FROM pedidos p
     JOIN pedido_detalle pd ON pd.pedido_id = p.id
     WHERE ${diaComercial('p.creado_en')} BETWEEN $1 AND $2
       AND p.estado != 'cancelado'`,
    [desde, hasta]
  );

  // A diferencia de calcularVentasPorProducto/calcularVentasPorProductoEnRango (que se usan en el
  // cierre de caja diario y agrupan todas las pizzas en un solo total), acá se muestra cada
  // producto por separado — el dashboard lo organiza por categoría en el frontend.
  const productos = await pool.query(
    `SELECT
       c.nombre AS categoria_nombre,
       p.nombre AS producto_nombre,
       SUM(pd.cantidad) AS cantidad_vendida
     FROM pedido_detalle pd
     JOIN pedidos ped ON ped.id = pd.pedido_id
     JOIN productos p ON p.id = pd.producto_id
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE ${diaComercial('ped.creado_en')} BETWEEN $1 AND $2
       AND ped.estado != 'cancelado'
     GROUP BY c.nombre, p.nombre
     ORDER BY c.nombre, cantidad_vendida DESC`,
    [desde, hasta]
  );

  const cantidadPedidos = Number(resumen.rows[0].cantidad_pedidos);
  const ventasTotales = Number(resumen.rows[0].ventas_totales);

  return {
    cantidadPedidos,
    ventasTotales,
    ticketPromedio: cantidadPedidos > 0 ? ventasTotales / cantidadPedidos : 0,
    topProductos: productos.rows
  };
}

// Total cobrado en efectivo vs. transferencia/MercadoPago en todo el período (no depende de que
// cada día tenga un cierre de caja cargado, a diferencia de sumar filas de cierre_caja).
async function calcularTotalesPorMedioPago(desde, hasta) {
  const resultado = await pool.query(
    `SELECT
       COALESCE(SUM(
         CASE
           WHEN medio_pago = 'efectivo' THEN total
           WHEN medio_pago = 'mixto' THEN monto_efectivo
           ELSE 0
         END
       ), 0) AS total_efectivo,
       COALESCE(SUM(
         CASE
           WHEN medio_pago = 'transferencia' THEN total
           WHEN medio_pago = 'mixto' THEN monto_transferencia
           ELSE 0
         END
       ), 0) AS total_transferencia
     FROM (
       SELECT p.id, p.medio_pago, p.monto_efectivo, p.monto_transferencia,
              SUM(pd.cantidad * pd.precio_unitario) AS total
       FROM pedidos p
       JOIN pedido_detalle pd ON pd.pedido_id = p.id
       WHERE ${diaComercial('p.creado_en')} BETWEEN $1 AND $2
         AND p.estado != 'cancelado'
       GROUP BY p.id, p.medio_pago, p.monto_efectivo, p.monto_transferencia
     ) AS totales_por_pedido`,
    [desde, hasta]
  );
  return resultado.rows[0];
}
module.exports = { calcularTotalesDelDia, calcularVentasPorProducto, calcularVentasPorProductoEnRango, crear, obtenerTodos, obtenerPorFecha, actualizar, obtenerPorRangoFechas, calcularResumenPeriodo, calcularTotalesPorMedioPago };
