const pedidosRepository = require('../repositories/pedidos.repository.js');
const arcaService = require('../services/arca.service.js');
const facturasVentaRepository = require('../repositories/facturasVenta.repository.js');
const clientesRepository = require('../repositories/clientes.repository.js');
const { InvoicePdfGenerator } = require('@arcasdk/pdf');
const comandaService = require('../services/comanda.service.js');
const notasCreditoRepository = require('../repositories/notasCredito.repository.js');

async function listar(req, res) {
  try {
    const pedidos = await pedidosRepository.obtenerTodos();
    res.json(pedidos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
}

async function obtenerUno(req, res) {
  try {
    const { id } = req.params;
    const pedido = await pedidosRepository.obtenerConDetalle(id);

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json(pedido);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
}

async function crear(req, res) {
  try {
    const { cliente, canal, medio_pago, cliente_id, productos, tipo_entrega, direccion_entrega, cuit_receptor } = req.body;
    const requiere_factura = medio_pago === 'transferencia';

    const nuevoPedido = await pedidosRepository.crear({
      cliente, canal, medio_pago, requiere_factura, cliente_id, productos, tipo_entrega, direccion_entrega, cuit_receptor
    });

    res.status(201).json(nuevoPedido);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Error al crear pedido' });
  }
}

async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const pedidoActualizado = await pedidosRepository.actualizarEstado(id, estado);

    if (!pedidoActualizado) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json(pedidoActualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar pedido' });
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;

    const pedidoEliminado = await pedidosRepository.eliminar(id);

    if (!pedidoEliminado) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json({ mensaje: 'Pedido eliminado', pedido: pedidoEliminado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar pedido' });
  }
}

async function facturar(req, res) {
  try {
    const { id } = req.params;

    const pedido = await pedidosRepository.obtenerConDetalle(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (!pedido.requiere_factura) {
      return res.status(400).json({ error: 'Este pedido no requiere factura (no fue pagado por transferencia)' });
    }

    const facturaExistente = await facturasVentaRepository.obtenerPorPedido(id);
    if (facturaExistente) {
      return res.status(400).json({ error: 'Este pedido ya tiene una factura asociada' });
    }

    const total = pedido.productos.reduce((suma, item) => suma + (item.cantidad * Number(item.precio_unitario)), 0);

    const cuitReceptor = pedido.cuit_receptor ? Number(pedido.cuit_receptor) : null;

    const facturaNueva = await facturasVentaRepository.crear({
      pedido_id: id,
      tipo_comprobante: 'Factura C',
      monto: total
    });

    try {
      const resultadoArca = await arcaService.emitirFactura({ monto: total, cuitReceptor });

      const facturaEmitida = await facturasVentaRepository.marcarEmitida(
        facturaNueva.id,
        resultadoArca.numeroComprobante,
        resultadoArca.cae,
        resultadoArca.caeFchVto
      );

      res.json(facturaEmitida);
    } catch (errorArca) {
      console.error('Error al emitir en ARCA:', errorArca);
      await facturasVentaRepository.marcarError(facturaNueva.id);
      res.status(500).json({ error: 'Error al emitir la factura en ARCA' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al facturar el pedido' });
  }
}

async function generarPdf(req, res) {
  try {
    const { id } = req.params;

    const pedido = await pedidosRepository.obtenerConDetalle(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const factura = await facturasVentaRepository.obtenerPorPedido(id);
    if (!factura || factura.estado !== 'emitida') {
      return res.status(400).json({ error: 'Este pedido no tiene una factura emitida' });
    }

    const cuitReceptor = pedido.cuit_receptor ? Number(pedido.cuit_receptor) : null;
    const nombreReceptor = pedido.cliente || 'Consumidor Final';

    const items = pedido.productos.map(item => {
      const subtotal = item.cantidad * Number(item.precio_unitario);
      const nombre = item.nombre_producto_2
        ? `Mitad ${item.nombre_producto} / Mitad ${item.nombre_producto_2}`
        : item.nombre_producto;
      return {
        descripcion: nombre,
        cantidad: item.cantidad,
        unidadMedida: 'unidad',
        precioUnitario: Number(item.precio_unitario),
        subtotal
      };
    });

    const importeTotal = Number(factura.monto);
    const fechaComprobante = new Date(factura.creado_en).toISOString().split('T')[0];
    const fechaVtoCae = factura.vencimiento_cae
      ? new Date(factura.vencimiento_cae).toISOString().split('T')[0]
      : '';

    const generator = new InvoicePdfGenerator();
    const pdfBuffer = await generator.generate({
      emisor: {
        razonSocial: 'Donchichopizza',
        domicilioComercial: 'General Villegas 4446,Lanús Buenos Aires',
        condicionIva: 'Responsable Monotributo',
        cuit: String(process.env.ARCA_CUIT),
        iibb: String(process.env.ARCA_CUIT),
        fechaInicioActividades: '2023-07-02'
      },
      receptor: {
        razonSocial: nombreReceptor,
        condicionIva: cuitReceptor ? 'Responsable Inscripto' : 'Consumidor Final',
        documentoTipo: cuitReceptor ? 'CUIT' : 'DNI',
        documentoNro: cuitReceptor ? String(cuitReceptor) : '0'
      },
      cbteTipo: Number(process.env.ARCA_CBTE_TIPO),
      cbteLetra: 'C',
      puntoVenta: Number(process.env.ARCA_PTO_VTA),
      cbteDesde: Number(factura.numero_comprobante),
      cbteHasta: Number(factura.numero_comprobante),
      cbteFecha: fechaComprobante,
      concepto: 1,
      items,
      importeNetoGravado: importeTotal,
      importeIva: 0,
      importeTotal,
      cae: factura.cae,
      caeFechaVencimiento: fechaVtoCae
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=factura-${factura.numero_comprobante}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ error: 'Error al generar el PDF de la factura' });
  }
}

async function verComanda(req, res) {
  try {
    const { id } = req.params;
    const pedido = await pedidosRepository.obtenerConDetalle(id);

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const texto = comandaService.armarComanda(pedido);
    res.setHeader('Content-Type', 'text/plain');
    res.send(texto);
  } catch (error) {
    console.error('Error al generar comanda:', error);
    res.status(500).json({ error: 'Error al generar la comanda' });
  }
}
async function imprimirComandaFisica(req, res) {
  try {
    const { id } = req.params;
    const pedido = await pedidosRepository.obtenerConDetalle(id);

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    await pedidosRepository.marcarPendienteImpresion(id);
    res.json({ mensaje: 'Comanda enviada a la cola de impresión' });
  } catch (error) {
    console.error('Error al encolar impresión:', error);
    res.status(500).json({ error: 'Error al encolar la comanda para imprimir' });
  }
}
async function modificarProductos(req, res) {
  try {
    const { id } = req.params;
    const { cliente, canal, medio_pago, tipo_entrega, direccion_entrega, cuit_receptor, productos } = req.body;

    const pedidoExistente = await pedidosRepository.obtenerConDetalle(id);
    if (!pedidoExistente) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (!productos || productos.length === 0) {
      return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });
    }

    const pedidoActualizado = await pedidosRepository.actualizarProductos(id, {
      cliente, canal, medio_pago, tipo_entrega, direccion_entrega, cuit_receptor, productos
    });
    res.json(pedidoActualizado);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Error al modificar el pedido' });
  }
}
async function obtenerPendientesImpresion(req, res) {
  try {
    const pedidos = await pedidosRepository.obtenerPendientesImpresion();
    res.json(pedidos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pendientes de impresión' });
  }
}

async function confirmarImpresion(req, res) {
  try {
    const { id } = req.params;
    await pedidosRepository.marcarImpresionCompleta(id);
    res.json({ mensaje: 'Impresión confirmada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al confirmar impresión' });
  }
}
async function listarPorFecha(req, res) {
  try {
    const { fecha } = req.query;

    if (!fecha) {
      return res.status(400).json({ error: 'Falta indicar la fecha' });
    }

    const pedidos = await pedidosRepository.obtenerPorFecha(fecha);
    res.json(pedidos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedidos por fecha' });
  }
}
async function anularFactura(req, res) {
  try {
    const { id } = req.params;
    const { monto, motivo } = req.body;

    const factura = await facturasVentaRepository.obtenerPorPedido(id);

    if (!factura || factura.estado !== 'emitida') {
      return res.status(400).json({ error: 'Este pedido no tiene una factura emitida para anular' });
    }

    const notasExistentes = await notasCreditoRepository.obtenerPorFactura(factura.id);
    const totalYaAcreditado = notasExistentes.reduce((suma, nc) => suma + Number(nc.monto), 0);

    if (totalYaAcreditado + Number(monto) > Number(factura.monto)) {
      return res.status(400).json({ error: 'El monto a acreditar supera el total de la factura' });
    }

    const pedido = await pedidosRepository.obtenerConDetalle(id);
    const cuitReceptor = pedido.cuit_receptor ? Number(pedido.cuit_receptor) : null;

    const fechaFactura = new Date(factura.creado_en).toISOString().split('T')[0].replace(/-/g, '');

    const resultadoArca = await arcaService.emitirNotaCredito({
      monto: Number(monto),
      cuitReceptor,
      facturaAsociada: {
        tipoComprobante: 11,
        numeroComprobante: factura.numero_comprobante,
        fecha: fechaFactura
      }
    });

    const notaCredito = await notasCreditoRepository.crear({
      factura_id: factura.id,
      numero_comprobante: resultadoArca.numeroComprobante,
      cae: resultadoArca.cae,
      vencimiento_cae: resultadoArca.caeFchVto,
      monto: Number(monto),
      motivo
    });

    res.json(notaCredito);
  } catch (error) {
    console.error('Error al anular factura:', error);
    res.status(500).json({ error: 'Error al emitir la nota de crédito' });
  }
}
module.exports = { listar, obtenerUno, crear, actualizarEstado, eliminar, facturar, generarPdf, verComanda, modificarProductos, imprimirComandaFisica, obtenerPendientesImpresion, confirmarImpresion, listarPorFecha, anularFactura };