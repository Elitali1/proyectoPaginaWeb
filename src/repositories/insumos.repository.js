const pool = require('../config/db.js');
const { conTransaccion } = require('../config/transaccion.js');

// Los insumos (nombre, unidad, activo) son un catálogo compartido entre sucursales.
// El stock, el stock mínimo y el costo unitario son de cada sucursal y viven en insumo_sucursal.
// Si una sucursal todavía no tiene cargado un insumo, se ve con stock 0.
const COLUMNAS = `i.id, i.nombre, i.unidad_medida, i.activo, i.creado_en,
       COALESCE(s.stock_actual, 0) AS stock_actual,
       COALESCE(s.stock_minimo, 0) AS stock_minimo,
       COALESCE(s.costo_unitario, 0) AS costo_unitario`;

// `db` puede ser el pool o un cliente dentro de una transacción.
async function leerInsumo(db, id, sucursalId) {
  const resultado = await db.query(`
    SELECT ${COLUMNAS}
    FROM insumos i
    LEFT JOIN insumo_sucursal s ON s.insumo_id = i.id AND s.sucursal_id = $2
    WHERE i.id = $1
  `, [id, sucursalId]);
  return resultado.rows[0];
}

async function obtenerTodos(sucursalId) {
  const resultado = await pool.query(`
    SELECT ${COLUMNAS}
    FROM insumos i
    LEFT JOIN insumo_sucursal s ON s.insumo_id = i.id AND s.sucursal_id = $1
    ORDER BY i.nombre
  `, [sucursalId]);
  return resultado.rows;
}

async function obtenerPorId(id, sucursalId, cliente = pool) {
  return leerInsumo(cliente, id, sucursalId);
}

async function crear(datos, sucursalId) {
  const { nombre, unidad_medida, stock_minimo } = datos;

  return conTransaccion(async (db) => {
    const nuevo = await db.query(
      'INSERT INTO insumos (nombre, unidad_medida) VALUES ($1, $2) RETURNING id',
      [nombre, unidad_medida]
    );
    const id = nuevo.rows[0].id;

    await db.query(
      'INSERT INTO insumo_sucursal (insumo_id, sucursal_id, stock_minimo) VALUES ($1, $2, $3)',
      [id, sucursalId, stock_minimo || 0]
    );

    return leerInsumo(db, id, sucursalId);
  });
}

// Suma stock y fija el nuevo costo en esa sucursal (se usa al cargar una compra).
// Devuelve undefined si el insumo no existe.
async function actualizarStockYCosto(id, cantidadAgregada, nuevoCostoUnitario, sucursalId, cliente = pool) {
  const existe = await cliente.query('SELECT 1 FROM insumos WHERE id = $1', [id]);
  if (existe.rows.length === 0) return undefined;

  await cliente.query(
    `INSERT INTO insumo_sucursal (insumo_id, sucursal_id, stock_actual, costo_unitario)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (insumo_id, sucursal_id)
     DO UPDATE SET stock_actual = insumo_sucursal.stock_actual + EXCLUDED.stock_actual,
                   costo_unitario = EXCLUDED.costo_unitario`,
    [id, sucursalId, cantidadAgregada, nuevoCostoUnitario]
  );
  return leerInsumo(cliente, id, sucursalId);
}

async function ajustarStock(id, cantidadDelta, sucursalId, cliente = pool) {
  const resultado = await cliente.query(
    `INSERT INTO insumo_sucursal (insumo_id, sucursal_id, stock_actual)
     VALUES ($1, $2, $3)
     ON CONFLICT (insumo_id, sucursal_id)
     DO UPDATE SET stock_actual = insumo_sucursal.stock_actual + EXCLUDED.stock_actual
     RETURNING *`,
    [id, sucursalId, cantidadDelta]
  );
  return resultado.rows[0];
}

// Descuenta stock de forma atómica: la condición `stock_actual >= $1` se evalúa dentro del mismo
// UPDATE, así dos ventas simultáneas no pueden dejar el stock en negativo.
// Devuelve undefined si no había stock suficiente (o la sucursal no tiene ese insumo cargado).
async function descontarStockSiHay(id, cantidad, sucursalId, cliente = pool) {
  const resultado = await cliente.query(
    `UPDATE insumo_sucursal
     SET stock_actual = stock_actual - $1
     WHERE insumo_id = $2 AND sucursal_id = $3 AND stock_actual >= $1
     RETURNING *`,
    [cantidad, id, sucursalId]
  );
  return resultado.rows[0];
}

// Ajuste manual: los descuentos no pueden dejar el stock por debajo de cero.
// Devuelve undefined si el insumo no existe o si el descuento dejaría el stock negativo.
async function ajustarStockManual(id, cantidadDelta, sucursalId) {
  return conTransaccion(async (db) => {
    // Si la sucursal todavía no tenía este insumo cargado, se crea con stock 0.
    await db.query(
      `INSERT INTO insumo_sucursal (insumo_id, sucursal_id)
       SELECT i.id, $2::int FROM insumos i WHERE i.id = $1
       ON CONFLICT (insumo_id, sucursal_id) DO NOTHING`,
      [id, sucursalId]
    );

    const resultado = await db.query(
      `UPDATE insumo_sucursal
       SET stock_actual = stock_actual + $1::numeric
       WHERE insumo_id = $2 AND sucursal_id = $3 AND ($1::numeric > 0 OR stock_actual + $1::numeric >= 0)
       RETURNING insumo_id`,
      [cantidadDelta, id, sucursalId]
    );
    if (resultado.rows.length === 0) return undefined;

    return leerInsumo(db, id, sucursalId);
  });
}

// "Activo" es del catálogo: desactivar un insumo lo desactiva en todas las sucursales.
async function alternarActivo(id, activo, sucursalId) {
  const resultado = await pool.query(
    'UPDATE insumos SET activo = $1 WHERE id = $2 RETURNING id',
    [activo, id]
  );
  if (resultado.rows.length === 0) return undefined;
  return leerInsumo(pool, id, sucursalId);
}

async function actualizarStockMinimo(id, stockMinimo, sucursalId) {
  const existe = await pool.query('SELECT 1 FROM insumos WHERE id = $1', [id]);
  if (existe.rows.length === 0) return undefined;

  await pool.query(
    `INSERT INTO insumo_sucursal (insumo_id, sucursal_id, stock_minimo)
     VALUES ($1, $2, $3)
     ON CONFLICT (insumo_id, sucursal_id)
     DO UPDATE SET stock_minimo = EXCLUDED.stock_minimo`,
    [id, sucursalId, stockMinimo]
  );
  return leerInsumo(pool, id, sucursalId);
}

async function actualizar(id, datos, sucursalId) {
  const { nombre, unidad_medida } = datos;
  const resultado = await pool.query(
    'UPDATE insumos SET nombre = $1, unidad_medida = $2 WHERE id = $3 RETURNING id',
    [nombre, unidad_medida, id]
  );
  if (resultado.rows.length === 0) return undefined;
  return leerInsumo(pool, id, sucursalId);
}

module.exports = { obtenerTodos, obtenerPorId, crear, actualizarStockYCosto, ajustarStock, descontarStockSiHay, ajustarStockManual, alternarActivo, actualizarStockMinimo, actualizar };