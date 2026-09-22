const pool = require('../config/db.js');
const { conTransaccion } = require('../config/transaccion.js');
const insumosRepository = require('./insumos.repository.js');
const recetasRepository = require('./recetas.repository.js');
const pedidosService = require('../services/pedidos.service.js');
const { ErrorNegocio } = require('../utils/errores.js');
const { normalizarCuit, redondear2 } = require('../utils/validaciones.js');
const { diaComercial } = require('./sqlFechas.js');

async function obtenerTodos({ soloActivos = false } = {}) {
  const filtro = soloActivos ? "WHERE p.estado NOT IN ('entregado', 'cancelado')" : '';

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
    ${filtro}
    GROUP BY p.id, fv.numero_comprobante, fv.cae, fv.vencimiento_cae, fv.estado
    ORDER BY p.id DESC
  `);

  return resultado.rows.map(pedido => ({
    ...pedido,
    ya_facturado: pedido.estado_factura === 'emitida',
    ya_impreso: pedido.impreso_en !== null
  }));
}

const COLUMNAS_DETALLE = `pd.pedido_id, pd.producto_id, p1.nombre AS nombre_producto,
            pd.producto_id_2, p2.nombre AS nombre_producto_2,
            pd.cantidad, pd.precio_unitario, pd.tipo_masa, pd.aclaraciones`;

async function obtenerConDetalle(id) {
  const pedido = await pool.query('SELECT * FROM pedidos WHERE id = $1', [id]);
  if (pedido.rows.length === 0) return null;

  const detalle = await pool.query(
    `SELECT ${COLUMNAS_DETALLE}
     FROM pedido_detalle pd
     JOIN productos p1 ON p1.id = pd.producto_id
     LEFT JOIN productos p2 ON p2.id = pd.producto_id_2
     WHERE pd.pedido_id = $1
     ORDER BY pd.id`,
    [id]
  );

  const productos = detalle.rows.map(({ pedido_id, ...resto }) => resto);
  return { ...pedido.rows[0], productos, ya_impreso: pedido.rows[0].impreso_en !== null };
}

// Igual que obtenerConDetalle pero para varios pedidos con solo 2 consultas (antes era 1 por pedido).
async function obtenerVariosConDetalle(ids) {
  if (ids.length === 0) return [];

  const pedidos = await pool.query(
    'SELECT * FROM pedidos WHERE id = ANY($1::bigint[]) ORDER BY id ASC',
    [ids]
  );
  const detalle = await pool.query(
    `SELECT ${COLUMNAS_DETALLE}
     FROM pedido_detalle pd
     JOIN productos p1 ON p1.id = pd.producto_id
     LEFT JOIN productos p2 ON p2.id = pd.producto_id_2
     WHERE pd.pedido_id = ANY($1::bigint[])
     ORDER BY pd.id`,
    [ids]
  );

  return pedidos.rows.map(pedido => ({
    ...pedido,
    productos: detalle.rows
      .filter(fila => Number(fila.pedido_id) === Number(pedido.id))
      .map(({ pedido_id, ...resto }) => resto)
  }));
}

async function descontarStockPorVenta(productoId, cantidadVendida, db) {
  const receta = await recetasRepository.obtenerPorProducto(productoId, db);

  for (const linea of receta) {
    const cantidadADescontar = Number((Number(linea.cantidad) * cantidadVendida).toFixed(6));
    if (!(cantidadADescontar > 0)) continue;

    // El chequeo de stock y el descuento son una única operación atómica en la base.
    const actualizado = await insumosRepository.descontarStockSiHay(linea.insumo_id, cantidadADescontar, db);

    if (!actualizado) {
      const insumo = await insumosRepository.obtenerPorId(linea.insumo_id, db);
      const nombre = insumo ? insumo.nombre : `#${linea.insumo_id}`;
      const quedan = insumo ? `${insumo.stock_actual} ${insumo.unidad_medida}` : '0';
      throw new ErrorNegocio(`No hay stock suficiente de "${nombre}" (quedan ${quedan}, se necesitan ${cantidadADescontar})`);
    }
  }
}

async function devolverStockDeUnProducto(productoId, cantidadVendida, db) {
  const receta = await recetasRepository.obtenerPorProducto(productoId, db);

  for (const linea of receta) {
    const cantidadADevolver = Number((Number(linea.cantidad) * cantidadVendida).toFixed(6));
    if (!(cantidadADevolver > 0)) continue;
    await insumosRepository.ajustarStock(linea.insumo_id, cantidadADevolver, db);
  }
}

// `items` puede ser el detalle de un pedido o los ítems nuevos: ambos tienen producto_id, producto_id_2 y cantidad.
async function devolverStockDeItems(items, db) {
  for (const item of items) {
    await devolverStockDeUnProducto(item.producto_id, item.cantidad, db);
    if (item.producto_id_2) {
      await devolverStockDeUnProducto(item.producto_id_2, item.cantidad, db);
    }
  }
}

async function descontarStockDeItems(items, db) {
  for (const item of items) {
    await descontarStockPorVenta(item.producto_id, item.cantidad, db);
    if (item.producto_id_2) {
      await descontarStockPorVenta(item.producto_id_2, item.cantidad, db);
    }
  }
}

async function insertarDetalle(db, pedidoId, items) {
  for (const item of items) {
    await db.query(
      `INSERT INTO pedido_detalle (pedido_id, producto_id, producto_id_2, cantidad, precio_unitario, tipo_masa, aclaraciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [pedidoId, item.producto_id, item.producto_id_2 || null, item.cantidad, item.precio_unitario, item.tipo_masa || null, item.aclaraciones || null]
    );
  }
}

// `datos` ya viene validado y normalizado por pedidosService.normalizarPedido.
async function crear(datos) {
  const { cliente, canal, medio_pago, requiere_factura, cliente_id, tipo_entrega, direccion_entrega, cuit_receptor, monto_efectivo, monto_transferencia } = datos;

  const pedidoId = await conTransaccion(async (db) => {
    const items = await pedidosService.resolverItems(db, datos.productos);
    pedidosService.validarPago(datos, pedidosService.calcularTotal(items));

    const cabecera = await db.query(
      `INSERT INTO pedidos (cliente, canal, medio_pago, requiere_factura, cliente_id, tipo_entrega, direccion_entrega, cuit_receptor, monto_efectivo, monto_transferencia)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [cliente, canal, medio_pago, requiere_factura, cliente_id ?? null, tipo_entrega, direccion_entrega, cuit_receptor, monto_efectivo, monto_transferencia]
    );
    const id = cabecera.rows[0].id;

    await insertarDetalle(db, id, items);
    await descontarStockDeItems(items, db);

    return id;
  });

  return obtenerConDetalle(pedidoId);
}

// Cambia el estado y, si se cancela, devuelve el stock: todo en una sola transacción y con el
// pedido bloqueado, para que dos cancelaciones simultáneas no devuelvan el stock dos veces.
async function actualizarEstado(id, estado) {
  return conTransaccion(async (db) => {
    const actual = await db.query('SELECT estado FROM pedidos WHERE id = $1 FOR UPDATE', [id]);
    if (actual.rows.length === 0) return null;

    const estadoAnterior = actual.rows[0].estado;

    if (estadoAnterior === 'cancelado' && estado !== 'cancelado') {
      throw new ErrorNegocio('Un pedido cancelado no se puede reactivar. Cargá uno nuevo.', 409);
    }

    const resultado = await db.query(
      'UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    );

    if (estado === 'cancelado' && estadoAnterior !== 'cancelado') {
      const detalle = await db.query(
        'SELECT producto_id, producto_id_2, cantidad FROM pedido_detalle WHERE pedido_id = $1',
        [id]
      );
      await devolverStockDeItems(detalle.rows, db);
    }

    return resultado.rows[0];
  });
}

async function eliminar(id) {
  return conTransaccion(async (db) => {
    const actual = await db.query('SELECT estado FROM pedidos WHERE id = $1 FOR UPDATE', [id]);
    if (actual.rows.length === 0) return null;

    const factura = await db.query(
      "SELECT 1 FROM facturas_venta WHERE pedido_id = $1 AND estado = 'emitida' LIMIT 1",
      [id]
    );
    if (factura.rows.length > 0) {
      throw new ErrorNegocio('No se puede eliminar un pedido con factura emitida. Anulá la factura y cancelá el pedido.', 409);
    }

    // Un pedido que no estaba cancelado todavía tiene su stock descontado: se devuelve antes de borrarlo.
    if (actual.rows[0].estado !== 'cancelado') {
      const detalle = await db.query(
        'SELECT producto_id, producto_id_2, cantidad FROM pedido_detalle WHERE pedido_id = $1',
        [id]
      );
      await devolverStockDeItems(detalle.rows, db);
    }

    const resultado = await db.query('DELETE FROM pedidos WHERE id = $1 RETURNING *', [id]);
    return resultado.rows[0];
  });
}

// `datos` ya viene validado y normalizado por pedidosService.normalizarPedido.
// Devuelve null si el pedido no existe.
async function actualizarProductos(id, datos) {
  const { cliente, canal, medio_pago, requiere_factura, tipo_entrega, direccion_entrega, cuit_receptor, monto_efectivo, monto_transferencia } = datos;

  const existe = await conTransaccion(async (db) => {
    const cabeceraActual = await db.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [id]);
    if (cabeceraActual.rows.length === 0) return false;
    const pedidoActual = cabeceraActual.rows[0];

    if (pedidoActual.estado === 'cancelado') {
      throw new ErrorNegocio('No se puede modificar un pedido cancelado', 409);
    }

    // Detalle viejo: se necesita para devolver su stock y para comparar contra la factura.
    const detalleViejo = await db.query(
      'SELECT producto_id, producto_id_2, cantidad, precio_unitario FROM pedido_detalle WHERE pedido_id = $1',
      [id]
    );

    const items = await pedidosService.resolverItems(db, datos.productos);
    const total = pedidosService.calcularTotal(items);
    pedidosService.validarPago(datos, total);

    // Con factura emitida no se puede cambiar lo que la factura ampara (total, medio de pago, CUIT).
    const facturaEmitida = await db.query(
      "SELECT 1 FROM facturas_venta WHERE pedido_id = $1 AND estado = 'emitida' LIMIT 1",
      [id]
    );
    if (facturaEmitida.rows.length > 0) {
      const cambioFiscal = pedidoActual.medio_pago !== medio_pago
        || pedidosService.calcularTotal(detalleViejo.rows) !== total
        || redondear2(pedidoActual.monto_transferencia || 0) !== redondear2(monto_transferencia || 0)
        || (normalizarCuit(pedidoActual.cuit_receptor) || null) !== (cuit_receptor || null);

      if (cambioFiscal) {
        throw new ErrorNegocio('Este pedido ya está facturado: no se puede cambiar el total, el medio de pago ni el CUIT. Anulá la factura desde el Historial primero.', 409);
      }
    }

    await devolverStockDeItems(detalleViejo.rows, db);

    await db.query(
      `UPDATE pedidos
       SET cliente = $1, canal = $2, medio_pago = $3, requiere_factura = $4,
           tipo_entrega = $5, direccion_entrega = $6, cuit_receptor = $7,
           monto_efectivo = $8, monto_transferencia = $9,
           impreso_en = NULL
       WHERE id = $10`,
      [cliente, canal, medio_pago, requiere_factura, tipo_entrega, direccion_entrega, cuit_receptor, monto_efectivo, monto_transferencia, id]
    );

    await db.query('DELETE FROM pedido_detalle WHERE pedido_id = $1', [id]);
    await insertarDetalle(db, id, items);
    await descontarStockDeItems(items, db);

    return true;
  });

  if (!existe) return null;
  return obtenerConDetalle(id);
}

// Encola la comanda para imprimir, pero solo si nunca se imprimió (impreso_en IS NULL). Una vez
// impresa, la única forma de volver a encolarla es modificar el pedido (actualizarProductos la
// resetea a NULL). Esto evita que un doble clic, o volver a apretar el botón después de imprimida,
// mande la misma comanda dos veces a la impresora.
// Devuelve undefined si el pedido no existe o si ya estaba impresa.
async function marcarPendienteImpresion(id) {
  const resultado = await pool.query(
    'UPDATE pedidos SET pendiente_impresion = true WHERE id = $1 AND impreso_en IS NULL RETURNING *',
    [id]
  );
  return resultado.rows[0];
}

async function obtenerPendientesImpresion() {
  const pedidos = await pool.query(
    'SELECT id FROM pedidos WHERE pendiente_impresion = true ORDER BY id ASC'
  );
  return obtenerVariosConDetalle(pedidos.rows.map(fila => fila.id));
}

async function marcarImpresionCompleta(id) {
  const resultado = await pool.query(
    'UPDATE pedidos SET pendiente_impresion = false, impreso_en = NOW() WHERE id = $1 RETURNING *',
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
    WHERE ${diaComercial('p.creado_en')} = $1
    GROUP BY p.id, fv.id, fv.numero_comprobante, fv.cae, fv.vencimiento_cae, fv.estado
    ORDER BY p.id DESC
  `, [fecha]);

  return resultado.rows.map(pedido => ({
    ...pedido,
    ya_facturado: pedido.estado_factura === 'emitida',
    ya_impreso: pedido.impreso_en !== null
  }));
}
module.exports = { obtenerTodos, obtenerConDetalle, crear, actualizarEstado, eliminar, actualizarProductos, marcarPendienteImpresion, obtenerPendientesImpresion, marcarImpresionCompleta, obtenerPorFecha };
