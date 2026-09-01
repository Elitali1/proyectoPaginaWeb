const pool = require('../config/db.js');

async function obtenerTodos() {
  const resultado = await pool.query(`
    SELECT
      p.*,
      COALESCE(SUM(pd.cantidad * pd.precio_unitario), 0) AS total,
      fv.numero_comprobante,
      fv.cae,
      fv.vencimiento_cae,
      fv.estado AS estado_factura,
      COALESCE(
        json_agg(
          json_build_object(
            'producto_id', pd.producto_id,
            'nombre_producto', p1.nombre,
            'producto_id_2', pd.producto_id_2,
            'nombre_producto_2', p2.nombre,
            'cantidad', pd.cantidad,
            'precio_unitario', pd.precio_unitario,
            'tipo_masa', pd.tipo_masa,
            'aclaraciones', pd.aclaraciones
          )
        ) FILTER (WHERE pd.id IS NOT NULL),
        '[]'
      ) AS productos
    FROM pedidos p
    LEFT JOIN pedido_detalle pd ON pd.pedido_id = p.id
    LEFT JOIN productos p1 ON p1.id = pd.producto_id
    LEFT JOIN productos p2 ON p2.id = pd.producto_id_2
    LEFT JOIN facturas_venta fv ON fv.pedido_id = p.id
    GROUP BY p.id, fv.numero_comprobante, fv.cae, fv.vencimiento_cae, fv.estado
    ORDER BY p.id DESC
  `);

  return resultado.rows.map(pedido => ({
    ...pedido,
    ya_facturado: pedido.estado_factura === 'emitida'
  }));
}

async function obtenerConDetalle(id) {
  const pedido = await pool.query('SELECT * FROM pedidos WHERE id = $1', [id]);
  if (pedido.rows.length === 0) return null;

  const detalle = await pool.query(
    `SELECT pd.producto_id, p1.nombre AS nombre_producto,
            pd.producto_id_2, p2.nombre AS nombre_producto_2,
            pd.cantidad, pd.precio_unitario, pd.tipo_masa, pd.aclaraciones
     FROM pedido_detalle pd
     JOIN productos p1 ON p1.id = pd.producto_id
     LEFT JOIN productos p2 ON p2.id = pd.producto_id_2
     WHERE pd.pedido_id = $1`,
    [id]
  );

  return { ...pedido.rows[0], productos: detalle.rows };
}

async function crear(datos) {
  const { cliente, canal, medio_pago, requiere_factura, cliente_id, productos, tipo_entrega, direccion_entrega, cuit_receptor } = datos;

  const cabecera = await pool.query(
    `INSERT INTO pedidos (cliente, canal, medio_pago, requiere_factura, cliente_id, tipo_entrega, direccion_entrega, cuit_receptor)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [cliente, canal, medio_pago, requiere_factura, cliente_id, tipo_entrega || 'retiro', direccion_entrega || null, cuit_receptor || null]
  );

  const pedidoId = cabecera.rows[0].id;

  for (const item of productos) {
    let precioFinal;
    if (item.producto_id_2) {
      const p1 = await pool.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id]);
      const p2 = await pool.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id_2]);

      if (!p1.rows[0].disponible || !p2.rows[0].disponible) {
        throw new Error('Uno de los productos seleccionados ya no está disponible');
      }

      precioFinal = (Number(p1.rows[0].precio) / 2) + (Number(p2.rows[0].precio) / 2) + 1000;
    } else {
      const p1 = await pool.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id]);

      if (!p1.rows[0].disponible) {
        throw new Error('El producto seleccionado ya no está disponible');
      }

      precioFinal = Number(p1.rows[0].precio);
    }

    await pool.query(
      `INSERT INTO pedido_detalle (pedido_id, producto_id, producto_id_2, cantidad, precio_unitario, tipo_masa, aclaraciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [pedidoId, item.producto_id, item.producto_id_2 || null, item.cantidad, precioFinal, item.tipo_masa || null, item.aclaraciones || null]
    );
  }

  return obtenerConDetalle(pedidoId);
}

async function actualizarEstado(id, estado) {
  const resultado = await pool.query(
    'UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *',
    [estado, id]
  );
  return resultado.rows[0];
}

async function eliminar(id) {
  const resultado = await pool.query(
    'DELETE FROM pedidos WHERE id = $1 RETURNING *',
    [id]
  );
  return resultado.rows[0];
}

async function actualizarProductos(id, productos) {
  await pool.query('DELETE FROM pedido_detalle WHERE pedido_id = $1', [id]);

  for (const item of productos) {
    let precioFinal;

    if (item.producto_id_2) {
      const p1 = await pool.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id]);
      const p2 = await pool.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id_2]);

      if (!p1.rows[0].disponible || !p2.rows[0].disponible) {
        throw new Error('Uno de los productos seleccionados ya no está disponible');
      }

      precioFinal = (Number(p1.rows[0].precio) / 2) + (Number(p2.rows[0].precio) / 2) + 1000;
    } else {
      const p1 = await pool.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id]);

      if (!p1.rows[0].disponible) {
        throw new Error('El producto seleccionado ya no está disponible');
      }

      precioFinal = Number(p1.rows[0].precio);
    }

    await pool.query(
      `INSERT INTO pedido_detalle (pedido_id, producto_id, producto_id_2, cantidad, precio_unitario, tipo_masa, aclaraciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, item.producto_id, item.producto_id_2 || null, item.cantidad, precioFinal, item.tipo_masa || null, item.aclaraciones || null]
    );
  }

  return obtenerConDetalle(id);
}

async function marcarPendienteImpresion(id) {
  const resultado = await pool.query(
    'UPDATE pedidos SET pendiente_impresion = true WHERE id = $1 RETURNING *',
    [id]
  );
  return resultado.rows[0];
}

async function obtenerPendientesImpresion() {
  const pedidos = await pool.query(
    'SELECT id FROM pedidos WHERE pendiente_impresion = true ORDER BY id ASC'
  );

  const resultados = [];
  for (const fila of pedidos.rows) {
    const pedidoCompleto = await obtenerConDetalle(fila.id);
    resultados.push(pedidoCompleto);
  }
  return resultados;
}

async function marcarImpresionCompleta(id) {
  const resultado = await pool.query(
    'UPDATE pedidos SET pendiente_impresion = false WHERE id = $1 RETURNING *',
    [id]
  );
  return resultado.rows[0];
}
module.exports = { obtenerTodos, obtenerConDetalle, crear, actualizarEstado, eliminar, actualizarProductos, marcarPendienteImpresion, obtenerPendientesImpresion, marcarImpresionCompleta };