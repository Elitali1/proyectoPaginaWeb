// Armado del texto de la comanda. No depende de ninguna librería de impresión: el servidor en la
// nube usa `armarComanda`, y la impresión real está en impresora.service.js (solo la usa el agente
// que corre en la PC del local).

function formatearFecha(fechaISO) {
  const fechaObj = new Date(fechaISO);
  const opciones = { timeZone: 'America/Argentina/Buenos_Aires' };
  const dia = fechaObj.toLocaleString('es-AR', { ...opciones, day: '2-digit' });
  const mes = fechaObj.toLocaleString('es-AR', { ...opciones, month: '2-digit' });
  const hora = fechaObj.toLocaleString('es-AR', { ...opciones, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia}/${mes} ${hora}`;
}

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

function textoEntrega(pedido) {
  return pedido.tipo_entrega === 'envio'
    ? `Envio - ${pedido.direccion_entrega || 'sin direccion'}`
    : 'Retiro en local';
}

function nombreDelItem(item) {
  return item.nombre_producto_2
    ? `Mitad ${item.nombre_producto} / Mitad ${item.nombre_producto_2}`
    : item.nombre_producto;
}

function textoMasa(item) {
  if (!item.tipo_masa) return '';
  return item.tipo_masa === 'molde' ? 'Al molde' : 'A la piedra';
}

function calcularTotal(pedido) {
  return pedido.productos.reduce((suma, item) => suma + (item.cantidad * Number(item.precio_unitario)), 0);
}

// Qué tiene que hacer el repartidor con la plata en los envíos.
// Devuelve null si no es un envío, o { texto, destacado } (destacado = hay que cobrar algo).
// Antes un envío con pago mixto decía "YA PAGADO" aunque una parte fuera en efectivo.
function instruccionDeCobro(pedido, total) {
  if (pedido.tipo_entrega !== 'envio') return null;

  if (pedido.medio_pago === 'efectivo') {
    return { texto: `COBRAR: $${formatearPrecio(total)}`, destacado: true };
  }

  if (pedido.medio_pago === 'mixto' && Number(pedido.monto_efectivo) > 0) {
    return { texto: `COBRAR EFECTIVO: $${formatearPrecio(pedido.monto_efectivo)}`, destacado: true };
  }

  return { texto: 'YA PAGADO - NO COBRAR', destacado: false };
}

function armarComanda(pedido) {
  const lineas = [];

  lineas.push('====================');
  lineas.push('    DONCHICHOPIZZA');
  lineas.push('====================');

  const fecha = formatearFecha(pedido.creado_en);
  lineas.push(`Pedido #${pedido.id} - ${fecha}`);

  lineas.push('--------------------');
  lineas.push(`Cliente: ${pedido.cliente}`);
  lineas.push(`Canal: ${pedido.canal}`);
  lineas.push(textoEntrega(pedido));

  lineas.push('--------------------');
  lineas.push('PRODUCTOS:');

  pedido.productos.forEach(item => {
    const masa = textoMasa(item);
    const subtotal = item.cantidad * Number(item.precio_unitario);

    lineas.push(`${item.cantidad}x ${nombreDelItem(item)}${masa ? ' - ' + masa : ''}`);
    if (item.aclaraciones) {
      lineas.push(`   (${item.aclaraciones})`);
    }
    lineas.push(`   $${formatearPrecio(subtotal)}`);
  });

  const total = calcularTotal(pedido);

  lineas.push('--------------------');
  lineas.push(`TOTAL: $${formatearPrecio(total)}`);
  lineas.push(`Pago: ${pedido.medio_pago}`);

  const cobro = instruccionDeCobro(pedido, total);
  if (cobro) {
    lineas.push(cobro.destacado ? `>>> ${cobro.texto} <<<` : cobro.texto);
  }

  lineas.push('====================');

  return lineas.join('\n');
}

module.exports = {
  armarComanda,
  instruccionDeCobro,
  formatearFecha,
  formatearPrecio,
  textoEntrega,
  nombreDelItem,
  textoMasa,
  calcularTotal
};
