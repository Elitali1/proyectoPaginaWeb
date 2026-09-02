const escpos = require('escpos');
escpos.USB = require('escpos-usb');

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

  const entrega = pedido.tipo_entrega === 'envio'
    ? `Envio - ${pedido.direccion_entrega || 'sin direccion'}`
    : 'Retiro en local';
  lineas.push(entrega);

  lineas.push('--------------------');
  lineas.push('PRODUCTOS:');

  let total = 0;
  pedido.productos.forEach(item => {
    const nombre = item.nombre_producto_2
      ? `Mitad ${item.nombre_producto} / Mitad ${item.nombre_producto_2}`
      : item.nombre_producto;
    const masaTexto = item.tipo_masa ? (item.tipo_masa === 'molde' ? 'Al molde' : 'A la piedra') : '';
    const subtotal = item.cantidad * Number(item.precio_unitario);
    total += subtotal;

    lineas.push(`${item.cantidad}x ${nombre}${masaTexto ? ' - ' + masaTexto : ''}`);
    if (item.aclaraciones) {
      lineas.push(`   (${item.aclaraciones})`);
    }
    lineas.push(`   $${formatearPrecio(subtotal)}`);
  });

  lineas.push('--------------------');
  lineas.push(`TOTAL: $${formatearPrecio(total)}`);
  lineas.push(`Pago: ${pedido.medio_pago}`);

  if (pedido.tipo_entrega === 'envio' && pedido.medio_pago === 'efectivo') {
    lineas.push(`>>> COBRAR: $${formatearPrecio(total)} <<<`);
  } else if (pedido.tipo_entrega === 'envio') {
    lineas.push('YA PAGADO - NO COBRAR');
  }

  lineas.push('====================');

  return lineas.join('\n');
}

function imprimirTicketUnico(printer, pedido) {
  return new Promise((resolve) => {
    printer.align('CT').style('B').text('DONCHICHOPIZZA').style('NORMAL');

    const fecha = formatearFecha(pedido.creado_en);
    printer.text(`Pedido #${pedido.id} - ${fecha}`);
    printer.drawLine();

    printer.align('LT');
    printer.text(`Cliente: ${pedido.cliente}`);
    printer.text(`Canal: ${pedido.canal}`);

    const entrega = pedido.tipo_entrega === 'envio'
      ? `Envio - ${pedido.direccion_entrega || 'sin direccion'}`
      : 'Retiro en local';
    printer.text(entrega);
    printer.drawLine();

    let total = 0;
    pedido.productos.forEach(item => {
      const nombre = item.nombre_producto_2
        ? `Mitad ${item.nombre_producto} / Mitad ${item.nombre_producto_2}`
        : item.nombre_producto;
      const masaTexto = item.tipo_masa ? (item.tipo_masa === 'molde' ? 'Al molde' : 'A la piedra') : '';
      const subtotal = item.cantidad * Number(item.precio_unitario);
      total += subtotal;

      printer.text(`${item.cantidad}x ${nombre}${masaTexto ? ' - ' + masaTexto : ''}`);
      if (item.aclaraciones) {
        printer.text(`   (${item.aclaraciones})`);
      }
      printer.text(`   $${formatearPrecio(subtotal)}`);
    });

    printer.drawLine();
    printer.style('B').text(`TOTAL: $${formatearPrecio(total)}`).style('NORMAL');
    printer.text(`Pago: ${pedido.medio_pago}`);

    if (pedido.tipo_entrega === 'envio' && pedido.medio_pago === 'efectivo') {
      printer.style('B').text(`COBRAR: $${formatearPrecio(total)}`).style('NORMAL');
    } else if (pedido.tipo_entrega === 'envio') {
      printer.text('YA PAGADO - NO COBRAR');
    }

    printer.text('').text('').text('');
    printer.cut();
    resolve();
  });
}

function imprimirComanda(pedido) {
  return new Promise((resolve, reject) => {
    let device;
    try {
      device = new escpos.USB(0x1fc9, 0x2016);
    } catch (error) {
      return reject(new Error('No se encontró la impresora USB conectada'));
    }

    const printer = new escpos.Printer(device);

    device.open(async (error) => {
      if (error) return reject(error);

      try {
        await imprimirTicketUnico(printer, pedido);
        await imprimirTicketUnico(printer, pedido);
        printer.close(() => resolve());
      } catch (errorImpresion) {
        reject(errorImpresion);
      }
    });
  });
}

module.exports = { armarComanda, imprimirComanda };