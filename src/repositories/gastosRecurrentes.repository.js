const pool = require('../config/db.js');
const { conTransaccion } = require('../config/transaccion.js');

// Gastos que se repiten todos los meses (alquiler, luz, internet, sueldos fijos...), por sucursal.

async function listar(sucursalId) {
  const resultado = await pool.query(
    'SELECT * FROM gastos_recurrentes WHERE sucursal_id = $1 AND activo ORDER BY concepto',
    [sucursalId]
  );
  return resultado.rows;
}

async function crear({ concepto, categoria, tipo, monto }, sucursalId) {
  const resultado = await pool.query(
    `INSERT INTO gastos_recurrentes (sucursal_id, concepto, categoria, tipo, monto)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [sucursalId, concepto, categoria || null, tipo, monto]
  );
  return resultado.rows[0];
}

async function eliminar(id, sucursalId) {
  const resultado = await pool.query(
    'DELETE FROM gastos_recurrentes WHERE id = $1 AND sucursal_id = $2 RETURNING *',
    [id, sucursalId]
  );
  return resultado.rows[0];
}

// Convierte los recurrentes en gastos con la fecha elegida. No duplica: si en ese mismo mes ya hay un
// gasto con el mismo concepto en esa sucursal, lo saltea (así apretar el botón dos veces no carga todo doble).
async function cargarDelMes(fecha, sucursalId) {
  return conTransaccion(async (db) => {
    const recurrentes = await db.query(
      'SELECT * FROM gastos_recurrentes WHERE sucursal_id = $1 AND activo ORDER BY id',
      [sucursalId]
    );

    let creados = 0;
    let omitidos = 0;

    for (const r of recurrentes.rows) {
      const yaCargado = await db.query(
        `SELECT 1 FROM gastos
          WHERE sucursal_id = $1
            AND concepto = $2
            AND date_trunc('month', fecha) = date_trunc('month', $3::date)
          LIMIT 1`,
        [sucursalId, r.concepto, fecha]
      );
      if (yaCargado.rows.length > 0) {
        omitidos += 1;
        continue;
      }
      await db.query(
        `INSERT INTO gastos (concepto, categoria, monto, fecha, tipo, sucursal_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [r.concepto, r.categoria, r.monto, fecha, r.tipo, sucursalId]
      );
      creados += 1;
    }

    return { creados, omitidos };
  });
}

module.exports = { listar, crear, eliminar, cargarDelMes };
