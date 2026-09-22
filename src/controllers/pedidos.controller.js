const pedidosRepository = require('../repositories/pedidos.repository.js');
const arcaService = require('../services/arca.service.js');
const pedidosService = require('../services/pedidos.service.js');
const facturasVentaRepository = require('../repositories/facturasVenta.repository.js');
const clientesRepository = require('../repositories/clientes.repository.js');
const { InvoicePdfGenerator } = require('@arcasdk/pdf');
const comandaService = require('../services/comanda.service.js');
const notasCreditoRepository = require('../repositories/notasCredito.repository.js');
const { ESTADOS_PEDIDO } = require('../config/negocio.js');
const { responderError } = require('../utils/errores.js');
const { esNumero, esFechaISO, textoOpcional, redondear2 } = require('../utils/validaciones.js');
const { fechaDeComprobante } = require('../utils/fechas.js');

// Datos fijos del emisor que van en los PDF de facturas y notas de crédito.
function datosEmisor() {
  return {
    razonSocial: 'Donchichopizza',
    domicilioComercial: 'General Villegas 4446,Lanús Buenos Aires',
    condicionIva: 'Responsable Monotributo',
    cuit: String(process.env.ARCA_CUIT),
    iibb: String(process.env.ARCA_CUIT),
    fechaInicioActividades: '2023-07-02'
  };
}

// Emisiones en curso en este proceso (evita doble clic / dos pestañas emitiendo lo mismo a la vez).
const notasCreditoEnCurso = new Set();

// Reintenta una operación de base de datos: se usa después de que ARCA ya emitió el comprobante,
// donde perder el registro sería grave.
async function conReintentos(operacion, intentos = 3) {
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    try {
      return await operacion();
    } catch (error) {
      ultimoError = error;
      await new Promise(resolver => setTimeout(resolver, 500 * (i + 1)));
    }
  }
  throw ultimoError;
}

async function listar(req, res) {
  try {
    const soloActivos = req.query.activos === '1' || req.query.activos === 'true';
    const pedidos = await pedidosRepository.obtenerTodos({ soloActivos });
    res.json(pedidos);
  } catch (error) {
    responderError(res, error, 'Error al obtener pedidos');
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
    responderError(res, error, 'Error al obtener pedido');
  }
}

async function crear(req, res) {
  try {
    const datos = pedidosService.normalizarPedido(req.body);

    let clienteId = null;
    const telefono = textoOpcional(req.body.telefono, 30);
    if (telefono) {
      const clienteVinculado = await clientesRepository.buscarOCrear(telefono, datos.cliente, datos.direccion_entrega);
      clienteId = clienteVinculado.id;
    }

    const nuevoPedido = await pedidosRepository.crear({ ...datos, cliente_id: clienteId });

    res.status(201).json(nuevoPedido);
  } catch (error) {
    responderError(res, error, 'Error al crear pedido');
  }
}

async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!ESTADOS_PEDIDO.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const pedidoActualizado = await pedidosRepository.actualizarEstado(id, estado);

    if (!pedidoActualizado) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json(pedidoActualizado);
  } catch (error) {
    responderError(res, error, 'Error al actualizar pedido');
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
    responderError(res, error, 'Error al eliminar pedido');
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

    if (pedido.estado === 'cancelado') {
      return res.status(400).json({ error: 'No se puede facturar un pedido cancelado' });
    }

    // Si es mixto, se factura solo la parte de transferencia; si no, el total del pedido
    const esMixto = pedido.medio_pago === 'mixto';
    const total = redondear2(esMixto
      ? Number(pedido.monto_transferencia)
      : pedido.productos.reduce((suma, item) => suma + (item.cantidad * Number(item.precio_unitario)), 0));

    if (!(total > 0)) {
      return res.status(400).json({ error: 'El monto a facturar debe ser mayor a cero' });
    }

    const cuitReceptor = pedido.cuit_receptor ? Number(pedido.cuit_receptor) : null;

    // Reserva atómica: si ya hay una factura emitida o en proceso lanza ErrorNegocio;
    // si quedó una anterior en error, la reutiliza para reintentar.
    const facturaNueva = await facturasVentaRepository.reservarEmision({
      pedido_id: id,
      tipo_comprobante: 'Factura C',
      monto: total
    });

    let resultadoArca;
    try {
      resultadoArca = await arcaService.emitirFactura({ monto: total, cuitReceptor });
    } catch (errorArca) {
      console.error('Error al emitir en ARCA:', errorArca);
      try {
        await facturasVentaRepository.marcarError(facturaNueva.id);
      } catch (errorMarcado) {
        console.error('No se pudo marcar la factura como error:', errorMarcado);
      }
      return res.status(500).json({ error: 'Error al emitir la factura en ARCA' });
    }

    // ARCA ya emitió el comprobante: a partir de acá NO se marca error, porque el CAE es válido.
    try {
      const facturaEmitida = await conReintentos(() => facturasVentaRepository.marcarEmitida(
        facturaNueva.id,
        resultadoArca.numeroComprobante,
        resultadoArca.cae,
        resultadoArca.caeFchVto
      ));
      return res.json(facturaEmitida);
    } catch (errorGuardado) {
      console.error('CRÍTICO: factura emitida en ARCA pero no guardada en la base', {
        factura_id: facturaNueva.id,
        pedido_id: id,
        numeroComprobante: resultadoArca.numeroComprobante,
        cae: resultadoArca.cae,
        caeFchVto: resultadoArca.caeFchVto
      }, errorGuardado);
      return res.status(500).json({
        error: `La factura se emitió en ARCA (N° ${resultadoArca.numeroComprobante}, CAE ${resultadoArca.cae}) pero no se pudo guardar en el sistema. NO la vuelvas a emitir: avisá al administrador.`
      });
    }
  } catch (error) {
    responderError(res, error, 'Error al facturar el pedido');
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
    const esMixto = pedido.medio_pago === 'mixto';

    const items = esMixto
      ? [
          {
            descripcion: `Pago parcial - Pedido #${pedido.id}`,
            cantidad: 1,
            unidadMedida: 'unidad',
            precioUnitario: Number(factura.monto),
            subtotal: Number(factura.monto)
          }
        ]
      : pedido.productos.map(item => {
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
    const fechaComprobante = fechaDeComprobante(factura.creado_en);
    const fechaVtoCae = factura.vencimiento_cae
      ? new Date(factura.vencimiento_cae).toISOString().split('T')[0]
      : '';

    const generator = new InvoicePdfGenerator();
    const pdfBuffer = await generator.generate({
      emisor: datosEmisor(),
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
    responderError(res, error, 'Error al generar el PDF de la factura');
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
    responderError(res, error, 'Error al generar la comanda');
  }
}
async function imprimirComandaFisica(req, res) {
  try {
    const { id } = req.params;
    const pedido = await pedidosRepository.obtenerConDetalle(id);

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Si ya se había impreso y el pedido no se modificó desde entonces, no se vuelve a encolar
    // (evita mandar la misma comanda dos veces a la impresora).
    const encolado = await pedidosRepository.marcarPendienteImpresion(id);
    if (!encolado) {
      return res.status(409).json({ error: 'Esta comanda ya se imprimió. Si necesitás otra copia, modificá el pedido (aunque sea sin cambios reales) y volvé a intentar.' });
    }

    res.json({ mensaje: 'Comanda enviada a la cola de impresión' });
  } catch (error) {
    responderError(res, error, 'Error al encolar la comanda para imprimir');
  }
}
async function modificarProductos(req, res) {
  try {
    const { id } = req.params;

    // Ahora sí se leen también monto_efectivo y monto_transferencia (antes se perdían al editar un pago mixto).
    const datos = pedidosService.normalizarPedido(req.body);

    const pedidoActualizado = await pedidosRepository.actualizarProductos(id, datos);
    if (!pedidoActualizado) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json(pedidoActualizado);
  } catch (error) {
    responderError(res, error, 'Error al modificar el pedido');
  }
}
async function obtenerPendientesImpresion(req, res) {
  try {
    const pedidos = await pedidosRepository.obtenerPendientesImpresion();
    res.json(pedidos);
  } catch (error) {
    responderError(res, error, 'Error al obtener pendientes de impresión');
  }
}

async function confirmarImpresion(req, res) {
  try {
    const { id } = req.params;
    const pedido = await pedidosRepository.marcarImpresionCompleta(id);

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json({ mensaje: 'Impresión confirmada' });
  } catch (error) {
    responderError(res, error, 'Error al confirmar impresión');
  }
}
async function listarPorFecha(req, res) {
  try {
    const { fecha } = req.query;

    if (!fecha) {
      return res.status(400).json({ error: 'Falta indicar la fecha' });
    }

    if (!esFechaISO(fecha)) {
      return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD' });
    }

    const pedidos = await pedidosRepository.obtenerPorFecha(fecha);
    res.json(pedidos);
  } catch (error) {
    responderError(res, error, 'Error al obtener pedidos por fecha');
  }
}
async function anularFactura(req, res) {
  let claveEnCurso = null;

  try {
    const { id } = req.params;
    const { monto: montoRecibido, motivo } = req.body || {};

    if (!esNumero(montoRecibido) || Number(montoRecibido) <= 0) {
      return res.status(400).json({ error: 'El monto a acreditar debe ser un número mayor a cero' });
    }
    const monto = redondear2(montoRecibido);

    const factura = await facturasVentaRepository.obtenerPorPedido(id);

    if (!factura || factura.estado !== 'emitida') {
      return res.status(400).json({ error: 'Este pedido no tiene una factura emitida para anular' });
    }

    claveEnCurso = factura.id;
    if (notasCreditoEnCurso.has(claveEnCurso)) {
      claveEnCurso = null;
      return res.status(409).json({ error: 'Ya hay una nota de crédito en proceso para esta factura. Esperá unos segundos.' });
    }
    notasCreditoEnCurso.add(claveEnCurso);

    const notasExistentes = await notasCreditoRepository.obtenerPorFactura(factura.id);
    const totalYaAcreditado = notasExistentes.reduce((suma, nc) => suma + Number(nc.monto), 0);

    if (redondear2(totalYaAcreditado + monto) > redondear2(Number(factura.monto))) {
      return res.status(400).json({ error: 'El monto a acreditar supera el total de la factura' });
    }

    const pedido = await pedidosRepository.obtenerConDetalle(id);
    const cuitReceptor = pedido.cuit_receptor ? Number(pedido.cuit_receptor) : null;

    const fechaFactura = fechaDeComprobante(factura.creado_en).replace(/-/g, '');

    const resultadoArca = await arcaService.emitirNotaCredito({
      monto,
      cuitReceptor,
      facturaAsociada: {
        tipoComprobante: Number(process.env.ARCA_CBTE_TIPO) || 11,
        numeroComprobante: factura.numero_comprobante,
        fecha: fechaFactura
      }
    });

    // ARCA ya emitió la nota de crédito: hay que guardarla sí o sí.
    try {
      const notaCredito = await conReintentos(() => notasCreditoRepository.crear({
        factura_id: factura.id,
        numero_comprobante: resultadoArca.numeroComprobante,
        cae: resultadoArca.cae,
        vencimiento_cae: resultadoArca.caeFchVto,
        monto,
        motivo: textoOpcional(motivo, 200)
      }));
      res.json(notaCredito);
    } catch (errorGuardado) {
      console.error('CRÍTICO: nota de crédito emitida en ARCA pero no guardada en la base', {
        factura_id: factura.id,
        numeroComprobante: resultadoArca.numeroComprobante,
        cae: resultadoArca.cae,
        caeFchVto: resultadoArca.caeFchVto,
        monto
      }, errorGuardado);
      res.status(500).json({
        error: `La nota de crédito se emitió en ARCA (N° ${resultadoArca.numeroComprobante}, CAE ${resultadoArca.cae}) pero no se pudo guardar en el sistema. NO la vuelvas a emitir: avisá al administrador.`
      });
    }
  } catch (error) {
    responderError(res, error, 'Error al emitir la nota de crédito');
  } finally {
    if (claveEnCurso !== null) notasCreditoEnCurso.delete(claveEnCurso);
  }
}
async function generarPdfNotaCredito(req, res) {
  try {
    const { id } = req.params;

    const pedido = await pedidosRepository.obtenerConDetalle(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const factura = await facturasVentaRepository.obtenerPorPedido(id);
    if (!factura) {
      return res.status(400).json({ error: 'Este pedido no tiene factura asociada' });
    }

    const notasCredito = await notasCreditoRepository.obtenerPorFactura(factura.id);
    if (notasCredito.length === 0) {
      return res.status(400).json({ error: 'Este pedido no tiene ninguna nota de crédito emitida' });
    }

    const notaCredito = notasCredito[notasCredito.length - 1]; // la más reciente

    const cuitReceptor = pedido.cuit_receptor ? Number(pedido.cuit_receptor) : null;
    const nombreReceptor = pedido.cliente || 'Consumidor Final';

    const importeTotal = Number(notaCredito.monto);
    const fechaComprobante = fechaDeComprobante(notaCredito.creado_en);
    const fechaVtoCae = notaCredito.vencimiento_cae
      ? new Date(notaCredito.vencimiento_cae).toISOString().split('T')[0]
      : '';

    const generator = new InvoicePdfGenerator();
    const pdfBuffer = await generator.generate({
      emisor: datosEmisor(),
      receptor: {
        razonSocial: nombreReceptor,
        condicionIva: cuitReceptor ? 'Responsable Inscripto' : 'Consumidor Final',
        documentoTipo: cuitReceptor ? 'CUIT' : 'DNI',
        documentoNro: cuitReceptor ? String(cuitReceptor) : '0'
      },
      cbteTipo: 13,
      cbteLetra: 'C',
      puntoVenta: Number(process.env.ARCA_PTO_VTA),
      cbteDesde: Number(notaCredito.numero_comprobante),
      cbteHasta: Number(notaCredito.numero_comprobante),
      cbteFecha: fechaComprobante,
      concepto: 1,
      items: [
        {
          descripcion: notaCredito.motivo || 'Ajuste sobre factura emitida',
          cantidad: 1,
          unidadMedida: 'unidad',
          precioUnitario: importeTotal,
          subtotal: importeTotal
        }
      ],
      importeNetoGravado: importeTotal,
      importeIva: 0,
      importeTotal,
      cae: notaCredito.cae,
      caeFechaVencimiento: fechaVtoCae
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=nota-credito-${notaCredito.numero_comprobante}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    responderError(res, error, 'Error al generar el PDF de la nota de crédito');
  }
}

module.exports = {
  listar, obtenerUno, crear, actualizarEstado, eliminar, facturar, generarPdf, verComanda,
  imprimirComandaFisica, modificarProductos, obtenerPendientesImpresion, confirmarImpresion,
  listarPorFecha, anularFactura, generarPdfNotaCredito
};
