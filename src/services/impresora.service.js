// Impresión física de la comanda por USB (ESC/POS). Solo la usa el agente que corre en la PC del
// local: el servidor en la nube NO debe requerir este archivo, porque carga librerías nativas de USB.
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
const {
  formatearFecha, formatearPrecio, textoEntrega, nombreDelItem, textoMasa, calcularTotal, instruccionDeCobro
} = require('./comanda.service.js');

function imprimirTicketUnico(printer, pedido) {
  printer.align('CT').style('B').text('DONCHICHOPIZZA').style('NORMAL');

  printer.text(`Pedido #${pedido.id} - ${formatearFecha(pedido.creado_en)}`);
  printer.drawLine();

  printer.align('LT');
  printer.text(`Cliente: ${pedido.cliente}`);
  printer.text(`Canal: ${pedido.canal}`);
  printer.text(textoEntrega(pedido));
  printer.drawLine();

  pedido.productos.forEach(item => {
    const masa = textoMasa(item);
    const subtotal = item.cantidad * Number(item.precio_unitario);

    printer.text(`${item.cantidad}x ${nombreDelItem(item)}${masa ? ' - ' + masa : ''}`);
    if (item.aclaraciones) {
      printer.text(`   (${item.aclaraciones})`);
    }
    printer.text(`   $${formatearPrecio(subtotal)}`);
  });

  const total = calcularTotal(pedido);

  printer.drawLine();
  printer.style('B').text(`TOTAL: $${formatearPrecio(total)}`).style('NORMAL');
  printer.text(`Pago: ${pedido.medio_pago}`);

  const cobro = instruccionDeCobro(pedido, total);
  if (cobro) {
    if (cobro.destacado) {
      printer.style('B').text(cobro.texto).style('NORMAL');
    } else {
      printer.text(cobro.texto);
    }
  }

  printer.text('').text('').text('');
  printer.cut();
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

    device.open((error) => {
      if (error) return reject(error);

      try {
        // Dos copias: una para la cocina y otra para el repartidor/mostrador.
        imprimirTicketUnico(printer, pedido);
        imprimirTicketUnico(printer, pedido);
        printer.close(() => resolve());
      } catch (errorImpresion) {
        reject(errorImpresion);
      }
    });
  });
}

module.exports = { imprimirComanda };
