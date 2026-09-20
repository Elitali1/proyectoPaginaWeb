// Validación y cálculo de pedidos. Sin acceso directo a la base: recibe el cliente/pool de
// consultas por parámetro, así se puede probar con una base falsa.
const { ErrorNegocio } = require('../utils/errores.js');
const { RECARGO_MITAD_Y_MITAD, MEDIOS_PAGO, TIPOS_ENTREGA, TIPOS_MASA } = require('../config/negocio.js');
const {
  esTexto, esNumero, esEnteroPositivo, textoOpcional, normalizarCuit, esCuitValido, redondear2
} = require('../utils/validaciones.js');

const MAX_CANTIDAD_POR_ITEM = 999;
const MAX_ITEMS_POR_PEDIDO = 100;

function normalizarItem(item) {
  if (!item || !esEnteroPositivo(item.producto_id)) {
    throw new ErrorNegocio('Hay un producto inválido en el pedido');
  }

  const tieneSegundo = item.producto_id_2 !== undefined && item.producto_id_2 !== null && item.producto_id_2 !== '';
  if (tieneSegundo && !esEnteroPositivo(item.producto_id_2)) {
    throw new ErrorNegocio('Hay un producto inválido en el pedido');
  }

  if (!esEnteroPositivo(item.cantidad) || Number(item.cantidad) > MAX_CANTIDAD_POR_ITEM) {
    throw new ErrorNegocio(`La cantidad debe ser un número entero entre 1 y ${MAX_CANTIDAD_POR_ITEM}`);
  }

  if (item.tipo_masa && !TIPOS_MASA.includes(item.tipo_masa)) {
    throw new ErrorNegocio('Tipo de masa inválido');
  }

  return {
    producto_id: Number(item.producto_id),
    producto_id_2: tieneSegundo ? Number(item.producto_id_2) : null,
    cantidad: Number(item.cantidad),
    tipo_masa: item.tipo_masa || null,
    aclaraciones: textoOpcional(item.aclaraciones, 300)
  };
}

// Valida el cuerpo recibido y devuelve los datos limpios. Lanza ErrorNegocio si algo no cierra.
function normalizarPedido(body) {
  const datos = body || {};

  if (!esTexto(datos.cliente, { max: 120 })) throw new ErrorNegocio('El nombre del cliente es obligatorio');
  if (!esTexto(datos.canal, { max: 50 })) throw new ErrorNegocio('El canal es obligatorio');
  if (!MEDIOS_PAGO.includes(datos.medio_pago)) throw new ErrorNegocio('Medio de pago inválido');

  const tipo_entrega = datos.tipo_entrega || 'retiro';
  if (!TIPOS_ENTREGA.includes(tipo_entrega)) throw new ErrorNegocio('Tipo de entrega inválido');

  const cuit_receptor = normalizarCuit(datos.cuit_receptor);
  if (cuit_receptor && !esCuitValido(cuit_receptor)) {
    throw new ErrorNegocio('El CUIT del receptor no es válido');
  }

  let monto_efectivo = null;
  let monto_transferencia = null;
  if (datos.medio_pago === 'mixto') {
    if (!esNumero(datos.monto_efectivo) || !esNumero(datos.monto_transferencia)
      || Number(datos.monto_efectivo) < 0 || Number(datos.monto_transferencia) < 0) {
      throw new ErrorNegocio('En un pago mixto hay que indicar los montos de efectivo y transferencia');
    }
    monto_efectivo = Number(datos.monto_efectivo);
    monto_transferencia = Number(datos.monto_transferencia);
  }

  if (!Array.isArray(datos.productos) || datos.productos.length === 0) {
    throw new ErrorNegocio('El pedido debe tener al menos un producto');
  }
  if (datos.productos.length > MAX_ITEMS_POR_PEDIDO) {
    throw new ErrorNegocio('El pedido tiene demasiados productos');
  }

  return {
    cliente: datos.cliente.trim(),
    canal: datos.canal.trim(),
    medio_pago: datos.medio_pago,
    tipo_entrega,
    direccion_entrega: textoOpcional(datos.direccion_entrega, 200),
    cuit_receptor,
    monto_efectivo,
    monto_transferencia,
    requiere_factura: datos.medio_pago === 'transferencia'
      || (datos.medio_pago === 'mixto' && monto_transferencia > 0),
    productos: datos.productos.map(normalizarItem)
  };
}

// Busca los productos en la base y calcula el precio de cada línea. Nunca se confía en el
// precio que manda el navegador.
async function resolverItems(db, items) {
  const ids = [...new Set(items.flatMap(item => (item.producto_id_2 ? [item.producto_id, item.producto_id_2] : [item.producto_id])))];
  const resultado = await db.query(
    'SELECT id, precio, disponible FROM productos WHERE id = ANY($1::bigint[])',
    [ids]
  );
  const porId = new Map(resultado.rows.map(fila => [Number(fila.id), fila]));

  return items.map(item => {
    const p1 = porId.get(item.producto_id);
    if (!p1) throw new ErrorNegocio('Uno de los productos del pedido no existe');

    let precio_unitario;
    if (item.producto_id_2) {
      const p2 = porId.get(item.producto_id_2);
      if (!p2) throw new ErrorNegocio('Uno de los productos del pedido no existe');
      if (!p1.disponible || !p2.disponible) {
        throw new ErrorNegocio('Uno de los productos seleccionados ya no está disponible');
      }
      precio_unitario = (Number(p1.precio) / 2) + (Number(p2.precio) / 2) + RECARGO_MITAD_Y_MITAD;
    } else {
      if (!p1.disponible) throw new ErrorNegocio('El producto seleccionado ya no está disponible');
      precio_unitario = Number(p1.precio);
    }

    return { ...item, precio_unitario };
  });
}

function calcularTotal(items) {
  return redondear2(items.reduce((suma, item) => suma + (item.cantidad * Number(item.precio_unitario)), 0));
}

// En un pago mixto, efectivo + transferencia tiene que ser exactamente el total del pedido.
function validarPago({ medio_pago, monto_efectivo, monto_transferencia }, total) {
  if (medio_pago !== 'mixto') return;

  const suma = redondear2(Number(monto_efectivo) + Number(monto_transferencia));
  if (suma !== redondear2(total)) {
    throw new ErrorNegocio(`La suma de efectivo y transferencia ($${suma}) no coincide con el total del pedido ($${redondear2(total)})`);
  }
}

module.exports = { normalizarPedido, resolverItems, calcularTotal, validarPago };
