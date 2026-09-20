const pool = require('../config/db.js');

async function obtenerTodos() {
  const resultado = await pool.query('SELECT * FROM insumos ORDER BY nombre');
  return resultado.rows;
}

async function obtenerPorId(id, cliente = pool) {
  const resultado = await cliente.query('SELECT * FROM insumos WHERE id = $1', [id]);
  return resultado.rows[0];
}

async function crear(datos) {
  const { nombre, unidad_medida, stock_minimo } = datos;
  const resultado = await pool.query(
    `INSERT INTO insumos (nombre, unidad_medida, stock_minimo) VALUES ($1, $2, $3) RETURNING *`,
    [nombre, unidad_medida, stock_minimo || 0]
  );
  return resultado.rows[0];
}

async function actualizarStockYCosto(id, cantidadAgregada, nuevoCostoUnitario, cliente = pool) {
  const resultado = await cliente.query(
    `UPDATE insumos
     SET stock_actual = stock_actual + $1, costo_unitario = $2
     WHERE id = $3
     RETURNING *`,
    [cantidadAgregada, nuevoCostoUnitario, id]
  );
  return resultado.rows[0];
}

async function ajustarStock(id, cantidadDelta, cliente = pool) {
  const resultado = await cliente.query(
    `UPDATE insumos
     SET stock_actual = stock_actual + $1
     WHERE id = $2
     RETURNING *`,
    [cantidadDelta, id]
  );
  return resultado.rows[0];
}

// Descuenta stock de forma atómica: la condición `stock_actual >= $1` se evalúa dentro del mismo
// UPDATE, así dos ventas simultáneas no pueden dejar el stock en negativo.
// Devuelve undefined si no había stock suficiente (o el insumo no existe).
async function descontarStockSiHay(id, cantidad, cliente = pool) {
  const resultado = await cliente.query(
    `UPDATE insumos
     SET stock_actual = stock_actual - $1
     WHERE id = $2 AND stock_actual >= $1
     RETURNING *`,
    [cantidad, id]
  );
  return resultado.rows[0];
}

// Ajuste manual: los descuentos no pueden dejar el stock por debajo de cero.
async function ajustarStockManual(id, cantidadDelta) {
  const resultado = await pool.query(
    `UPDATE insumos
     SET stock_actual = stock_actual + $1
     WHERE id = $2 AND ($1 > 0 OR stock_actual + $1 >= 0)
     RETURNING *`,
    [cantidadDelta, id]
  );
  return resultado.rows[0];
}

async function alternarActivo(id, activo) {
  const resultado = await pool.query(
    'UPDATE insumos SET activo = $1 WHERE id = $2 RETURNING *',
    [activo, id]
  );
  return resultado.rows[0];
}
async function actualizarStockMinimo(id, stockMinimo) {
  const resultado = await pool.query(
    'UPDATE insumos SET stock_minimo = $1 WHERE id = $2 RETURNING *',
    [stockMinimo, id]
  );
  return resultado.rows[0];
}

async function actualizar(id, datos) {
  const { nombre, unidad_medida } = datos;
  const resultado = await pool.query(
    'UPDATE insumos SET nombre = $1, unidad_medida = $2 WHERE id = $3 RETURNING *',
    [nombre, unidad_medida, id]
  );
  return resultado.rows[0];
}


module.exports = { obtenerTodos, obtenerPorId, crear, actualizarStockYCosto, ajustarStock, descontarStockSiHay, ajustarStockManual, alternarActivo, actualizarStockMinimo, actualizar };
