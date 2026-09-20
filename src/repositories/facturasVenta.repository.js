const pool = require('../config/db.js');
const { conTransaccion } = require('../config/transaccion.js');
const { ErrorNegocio } = require('../utils/errores.js');

// Una factura "pendiente" con más de estos minutos se considera abandonada (por ejemplo, el
// servidor se reinició a mitad de la emisión) y se puede reintentar.
const MINUTOS_PENDIENTE_VIGENTE = 5;

async function obtenerTodas() {
  const resultado = await pool.query('SELECT * FROM facturas_venta ORDER BY id DESC');
  return resultado.rows;
}

async function obtenerPorId(id) {
  const resultado = await pool.query('SELECT * FROM facturas_venta WHERE id = $1', [id]);
  return resultado.rows[0];
}

async function obtenerPorPedido(pedido_id) {
  const resultado = await pool.query('SELECT * FROM facturas_venta WHERE pedido_id = $1', [pedido_id]);
  return resultado.rows[0];
}

async function crear(datos) {
  const { pedido_id, tipo_comprobante, monto } = datos;
  const resultado = await pool.query(
    `INSERT INTO facturas_venta (pedido_id, tipo_comprobante, monto, estado)
     VALUES ($1, $2, $3, 'pendiente')
     RETURNING *`,
    [pedido_id, tipo_comprobante, monto]
  );
  return resultado.rows[0];
}

// Reserva atómica del derecho a emitir la factura de un pedido. Un lock por pedido serializa
// los pedidos simultáneos (doble clic, dos cajeros): el segundo ve la factura "pendiente" y
// recibe un error en lugar de emitir un duplicado.
//  - ya emitida            -> error
//  - pendiente y vigente   -> error (hay otra emisión en curso)
//  - en error / abandonada -> se reutiliza la misma fila para reintentar
//  - no existe             -> se crea
async function reservarEmision({ pedido_id, tipo_comprobante, monto }) {
  return conTransaccion(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(1001, $1::int)', [pedido_id]);

    const existente = await db.query(
      `SELECT *, (creado_en < NOW() - INTERVAL '${MINUTOS_PENDIENTE_VIGENTE} minutes') AS abandonada
       FROM facturas_venta WHERE pedido_id = $1 ORDER BY id DESC LIMIT 1`,
      [pedido_id]
    );

    if (existente.rows.length > 0) {
      const factura = existente.rows[0];

      if (factura.estado === 'emitida') {
        throw new ErrorNegocio('Este pedido ya tiene una factura asociada');
      }
      if (factura.estado === 'pendiente' && !factura.abandonada) {
        throw new ErrorNegocio('Ya hay una factura en proceso para este pedido. Esperá unos segundos y actualizá.', 409);
      }

      const reintento = await db.query(
        `UPDATE facturas_venta
         SET estado = 'pendiente', tipo_comprobante = $1, monto = $2, creado_en = NOW()
         WHERE id = $3
         RETURNING *`,
        [tipo_comprobante, monto, factura.id]
      );
      return reintento.rows[0];
    }

    const nueva = await db.query(
      `INSERT INTO facturas_venta (pedido_id, tipo_comprobante, monto, estado)
       VALUES ($1, $2, $3, 'pendiente')
       RETURNING *`,
      [pedido_id, tipo_comprobante, monto]
    );
    return nueva.rows[0];
  });
}

async function marcarEmitida(id, numero_comprobante, cae, vencimiento_cae) {
  const resultado = await pool.query(
    `UPDATE facturas_venta
     SET estado = 'emitida', numero_comprobante = $1, cae = $2, vencimiento_cae = $3
     WHERE id = $4
     RETURNING *`,
    [numero_comprobante, cae, vencimiento_cae, id]
  );
  return resultado.rows[0];
}

async function marcarError(id) {
  const resultado = await pool.query(
    `UPDATE facturas_venta SET estado = 'error' WHERE id = $1 RETURNING *`,
    [id]
  );
  return resultado.rows[0];
}

module.exports = { obtenerTodas, obtenerPorId, obtenerPorPedido, crear, reservarEmision, marcarEmitida, marcarError };
