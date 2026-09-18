const pool = require('../config/db.js');

async function obtenerTodos() {
  const resultado = await pool.query('SELECT * FROM insumos ORDER BY nombre');
  return resultado.rows;
}

async function obtenerPorId(id) {
  const resultado = await pool.query('SELECT * FROM insumos WHERE id = $1', [id]);
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

async function actualizarStockYCosto(id, cantidadAgregada, nuevoCostoUnitario) {
  const resultado = await pool.query(
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


module.exports = { obtenerTodos, obtenerPorId, crear, actualizarStockYCosto, ajustarStock, alternarActivo , actualizarStockMinimo, actualizar}; 