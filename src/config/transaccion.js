const pool = require('./db.js');

// Ejecuta `funcion(db)` dentro de una transacción: COMMIT si termina bien, ROLLBACK si lanza.
async function conTransaccion(funcion) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const resultado = await funcion(db);
    await db.query('COMMIT');
    return resultado;
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch (errorRollback) {
      console.error('Error al hacer ROLLBACK:', errorRollback);
    }
    throw error;
  } finally {
    db.release();
  }
}

module.exports = { conTransaccion };
