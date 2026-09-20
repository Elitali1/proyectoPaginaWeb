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

async function obtenerConDetalle(id, cliente = pool) {
  const pedido = await cliente.query('SELECT * FROM pedidos WHERE id = $1', [id]);
  if (pedido.rows.length === 0) return null;

  const detalle = await cliente.query(
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
  const insumosRepository = require('./insumos.repository.js');
  const recetasRepository = require('./recetas.repository.js');

  const { cliente, canal, medio_pago, requiere_factura, cliente_id, productos, tipo_entrega, direccion_entrega, cuit_receptor, monto_efectivo, monto_transferencia } = datos;
  if (!Array.isArray(productos) || productos.length === 0) {
    throw new Error('El pedido debe tener al menos un producto');
  }
  if (productos.some(item => !item || !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0)) {
    throw new Error('La cantidad de cada producto debe ser un entero positivo');
  }

  const clienteDb = await pool.connect();
  let pedidoId;

  try {
    await clienteDb.query('BEGIN');

    const cabecera = await clienteDb.query(
      `INSERT INTO pedidos (cliente, canal, medio_pago, requiere_factura, cliente_id, tipo_entrega, direccion_entrega, cuit_receptor, monto_efectivo, monto_transferencia)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [cliente, canal, medio_pago, requiere_factura, cliente_id, tipo_entrega || 'retiro', direccion_entrega || null, cuit_receptor || null, monto_efectivo || null, monto_transferencia || null]
    );

    pedidoId = cabecera.rows[0].id;

    for (const item of productos) {
      let precioFinal;
      if (item.producto_id_2) {
        const p1 = await clienteDb.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id]);
        const p2 = await clienteDb.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id_2]);

        if (!p1.rows[0] || !p2.rows[0]) throw new Error('Producto inexistente');
        if (!p1.rows[0].disponible || !p2.rows[0].disponible) {
          throw new Error('Uno de los productos seleccionados ya no está disponible');
        }

        precioFinal = (Number(p1.rows[0].precio) / 2) + (Number(p2.rows[0].precio) / 2) + 1000;
      } else {
        const p1 = await clienteDb.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id]);

        if (!p1.rows[0]) throw new Error('Producto inexistente');
        if (!p1.rows[0].disponible) {
          throw new Error('El producto seleccionado ya no está disponible');
        }

        precioFinal = Number(p1.rows[0].precio);
      }

      await clienteDb.query(
        `INSERT INTO pedido_detalle (pedido_id, producto_id, producto_id_2, cantidad, precio_unitario, tipo_masa, aclaraciones)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [pedidoId, item.producto_id, item.producto_id_2 || null, item.cantidad, precioFinal, item.tipo_masa || null, item.aclaraciones || null]
      );

      await descontarStockPorVenta(item.producto_id, item.cantidad, recetasRepository, insumosRepository, clienteDb);
      if (item.producto_id_2) {
        await descontarStockPorVenta(item.producto_id_2, item.cantidad, recetasRepository, insumosRepository, clienteDb);
      }
    }

    await clienteDb.query('COMMIT');
  } catch (error) {
    await clienteDb.query('ROLLBACK');
    throw error;
  } finally {
    clienteDb.release();
  }

  return obtenerConDetalle(pedidoId);
}

async function descontarStockPorVenta(productoId, cantidadVendida, recetasRepository, insumosRepository, cliente) {
  if (!cliente || !Number.isInteger(Number(cantidadVendida)) || Number(cantidadVendida) <= 0) {
    throw new Error('La cantidad del producto debe ser un entero positivo');
  }
  const receta = await recetasRepository.obtenerPorProducto(productoId, cliente);

  for (const linea of receta) {
    const cantidadADescontar = Number(linea.cantidad) * cantidadVendida;
    const insumoActualResult = await cliente.query(
      'SELECT * FROM insumos WHERE id = $1 FOR UPDATE',
      [linea.insumo_id]
    );
    const insumoActual = insumoActualResult.rows[0];
    if (!insumoActual) {
      throw new Error(`El insumo ${linea.insumo_id} no existe`);
    }
    const stockResultante = Number(insumoActual.stock_actual) - cantidadADescontar;

    if (stockResultante < 0) {
      throw new Error(`No hay stock suficiente de "${insumoActual.nombre}" (quedan ${insumoActual.stock_actual} ${insumoActual.unidad_medida}, se necesitan ${cantidadADescontar})`);
    }

    await insumosRepository.ajustarStock(linea.insumo_id, -cantidadADescontar, cliente);
  }
}

async function revertirStockPorCancelacion(pedidoId) {
  const insumosRepository = require('./insumos.repository.js');
  const recetasRepository = require('./recetas.repository.js');

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const pedidoResult = await cliente.query('SELECT estado FROM pedidos WHERE id = $1 FOR UPDATE', [pedidoId]);
    if (!pedidoResult.rows[0] || pedidoResult.rows[0].estado === 'cancelado') {
      await cliente.query('ROLLBACK');
      return;
    }
    const pedido = await obtenerConDetalle(pedidoId, cliente);
    await revertirDetalle(pedido, recetasRepository, insumosRepository, cliente);
    await cliente.query('UPDATE pedidos SET estado = $1 WHERE id = $2', ['cancelado', pedidoId]);
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

async function revertirDetalle(pedido, recetasRepository, insumosRepository, cliente) {
  if (!pedido) return;

  for (const item of pedido.productos) {
    await revertirStockDeUnProducto(item.producto_id, item.cantidad, recetasRepository, insumosRepository, cliente);
    if (item.producto_id_2) {
      await revertirStockDeUnProducto(item.producto_id_2, item.cantidad, recetasRepository, insumosRepository, cliente);
    }
  }
}

async function revertirStockDeUnProducto(productoId, cantidadVendida, recetasRepository, insumosRepository, cliente) {
  const receta = await recetasRepository.obtenerPorProducto(productoId, cliente);

  for (const linea of receta) {
    const cantidadADevolver = Number(linea.cantidad) * cantidadVendida;
    await insumosRepository.ajustarStock(linea.insumo_id, cantidadADevolver, cliente);
  }
}

async function actualizarEstado(id, estado) {
  const insumosRepository = require('./insumos.repository.js');
  const recetasRepository = require('./recetas.repository.js');
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const pedidoActual = await cliente.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [id]);
    if (pedidoActual.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return null;
    }
    const pedido = pedidoActual.rows[0];
    if (pedido.estado === 'cancelado' && estado !== 'cancelado') {
      throw new Error('No se puede reactivar un pedido cancelado');
    }
    if (estado === 'cancelado' && pedido.estado !== 'cancelado') {
      const pedidoConDetalle = await obtenerConDetalle(id, cliente);
      await revertirDetalle(pedidoConDetalle, recetasRepository, insumosRepository, cliente);
    }
    const resultado = await cliente.query(
      'UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    );
    await cliente.query('COMMIT');
    return resultado.rows[0];
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

async function eliminar(id) {
  const insumosRepository = require('./insumos.repository.js');
  const recetasRepository = require('./recetas.repository.js');
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const pedidoResult = await cliente.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [id]);
    if (!pedidoResult.rows[0]) {
      await cliente.query('ROLLBACK');
      return null;
    }
    const pedido = await obtenerConDetalle(id, cliente);
    if (pedido.estado !== 'cancelado') {
      await revertirDetalle(pedido, recetasRepository, insumosRepository, cliente);
    }
    const resultado = await cliente.query('DELETE FROM pedidos WHERE id = $1 RETURNING *', [id]);
    await cliente.query('COMMIT');
    return resultado.rows[0];
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

async function actualizarProductos(id, datos) {
  const insumosRepository = require('./insumos.repository.js');
  const recetasRepository = require('./recetas.repository.js');

  const { cliente, canal, medio_pago, tipo_entrega, direccion_entrega, cuit_receptor, productos, monto_efectivo, monto_transferencia } = datos;
  if (!Array.isArray(productos) || productos.length === 0 ||
      productos.some(item => !item || !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0)) {
    throw new Error('El pedido debe tener productos con cantidades válidas');
  }

  const requiere_factura = medio_pago === 'transferencia' || (medio_pago === 'mixto' && Number(monto_transferencia) > 0);

  const clienteDb = await pool.connect();

  try {
    await clienteDb.query('BEGIN');

    // Traemos el detalle viejo para poder revertir su stock antes de borrarlo
    const detalleViejo = await clienteDb.query(
      'SELECT producto_id, producto_id_2, cantidad FROM pedido_detalle WHERE pedido_id = $1',
      [id]
    );
    const pedidoActual = await clienteDb.query('SELECT estado FROM pedidos WHERE id = $1 FOR UPDATE', [id]);
    if (!pedidoActual.rows[0]) throw new Error('Pedido no encontrado');
    if (pedidoActual.rows[0].estado === 'cancelado') throw new Error('No se puede modificar un pedido cancelado');

    for (const item of detalleViejo.rows) {
      await revertirStockDeUnProducto(item.producto_id, item.cantidad, recetasRepository, insumosRepository, clienteDb);
      if (item.producto_id_2) {
        await revertirStockDeUnProducto(item.producto_id_2, item.cantidad, recetasRepository, insumosRepository, clienteDb);
      }
    }

    await clienteDb.query(
      `UPDATE pedidos
       SET cliente = $1, canal = $2, medio_pago = $3, requiere_factura = $4,
           tipo_entrega = $5, direccion_entrega = $6, cuit_receptor = $7,
           monto_efectivo = $8, monto_transferencia = $9
       WHERE id = $10`,
      [cliente, canal, medio_pago, requiere_factura, tipo_entrega || 'retiro', direccion_entrega || null, cuit_receptor || null, monto_efectivo || null, monto_transferencia || null, id]
    );

    await clienteDb.query('DELETE FROM pedido_detalle WHERE pedido_id = $1', [id]);

    for (const item of productos) {
      let precioFinal;

      if (item.producto_id_2) {
        const p1 = await clienteDb.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id]);
        const p2 = await clienteDb.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id_2]);

        if (!p1.rows[0] || !p2.rows[0]) throw new Error('Producto inexistente');
        if (!p1.rows[0].disponible || !p2.rows[0].disponible) {
          throw new Error('Uno de los productos seleccionados ya no está disponible');
        }

        precioFinal = (Number(p1.rows[0].precio) / 2) + (Number(p2.rows[0].precio) / 2) + 1000;
      } else {
        const p1 = await clienteDb.query('SELECT precio, disponible FROM productos WHERE id = $1', [item.producto_id]);

        if (!p1.rows[0]) throw new Error('Producto inexistente');
        if (!p1.rows[0].disponible) {
          throw new Error('El producto seleccionado ya no está disponible');
        }

        precioFinal = Number(p1.rows[0].precio);
      }

      await clienteDb.query(
        `INSERT INTO pedido_detalle (pedido_id, producto_id, producto_id_2, cantidad, precio_unitario, tipo_masa, aclaraciones)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, item.producto_id, item.producto_id_2 || null, item.cantidad, precioFinal, item.tipo_masa || null, item.aclaraciones || null]
      );

      await descontarStockPorVenta(item.producto_id, item.cantidad, recetasRepository, insumosRepository, clienteDb);
      if (item.producto_id_2) {
        await descontarStockPorVenta(item.producto_id_2, item.cantidad, recetasRepository, insumosRepository, clienteDb);
      }
    }

    await clienteDb.query('COMMIT');
  } catch (error) {
    await clienteDb.query('ROLLBACK');
    throw error;
  } finally {
    clienteDb.release();
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
async function obtenerPorFecha(fecha) {
  const resultado = await pool.query(`
    SELECT
      p.*,
      COALESCE(SUM(pd.cantidad * pd.precio_unitario), 0) AS total,
      fv.numero_comprobante,
      fv.cae,
      fv.vencimiento_cae,
      fv.estado AS estado_factura,
      EXISTS (
        SELECT 1 FROM notas_credito nc WHERE nc.factura_id = fv.id
      ) AS tiene_nota_credito,
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
    WHERE DATE((p.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires') - INTERVAL '6 hours') = $1
    GROUP BY p.id, fv.id, fv.numero_comprobante, fv.cae, fv.vencimiento_cae, fv.estado
    ORDER BY p.id DESC
  `, [fecha]);

  return resultado.rows.map(pedido => ({
    ...pedido,
    ya_facturado: pedido.estado_factura === 'emitida'
  }));
}
module.exports = { obtenerTodos, obtenerConDetalle, crear, actualizarEstado, eliminar, actualizarProductos, marcarPendienteImpresion, obtenerPendientesImpresion, marcarImpresionCompleta, obtenerPorFecha };