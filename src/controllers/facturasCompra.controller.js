const facturasCompraRepository = require('../repositories/facturasCompra.repository.js');
const { ErrorNegocio, responderError } = require('../utils/errores.js');
const { esTexto, esNumero, esEnteroPositivo, esFechaISO, esUrlHttp, textoOpcional } = require('../utils/validaciones.js');

async function listar(req, res) {
  try {
    const { desde, hasta } = req.query;

    if (desde && hasta) {
      if (!esFechaISO(desde) || !esFechaISO(hasta)) {
        return res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD' });
      }
      const facturas = await facturasCompraRepository.obtenerPorRangoFechas(desde, hasta);
      return res.json(facturas);
    }

    const facturas = await facturasCompraRepository.obtenerTodas();
    res.json(facturas);
  } catch (error) {
    responderError(res, error, 'Error al obtener facturas de compra');
  }
}

async function obtenerUna(req, res) {
  try {
    const { id } = req.params;
    const factura = await facturasCompraRepository.obtenerPorId(id);

    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    res.json(factura);
  } catch (error) {
    responderError(res, error, 'Error al obtener factura');
  }
}

async function crear(req, res) {
  try {
    const { proveedor, concepto, monto, fecha, archivo_url } = req.body || {};

    if (!esTexto(proveedor, { max: 150 })) throw new ErrorNegocio('El proveedor es obligatorio');
    if (!esNumero(monto) || Number(monto) <= 0) throw new ErrorNegocio('El monto debe ser un número mayor a cero');
    if (!esFechaISO(fecha)) throw new ErrorNegocio('La fecha es obligatoria (AAAA-MM-DD)');
    if (archivo_url && !esUrlHttp(archivo_url)) throw new ErrorNegocio('El link del archivo debe ser una URL http(s)');

    const nuevaFactura = await facturasCompraRepository.crear({
      proveedor: proveedor.trim(),
      concepto: textoOpcional(concepto, 300),
      monto: Number(monto),
      fecha,
      archivo_url: archivo_url || null,
      subido_por: req.usuario.id // sale del token, no de lo que mande el navegador
    });
    res.status(201).json(nuevaFactura);
  } catch (error) {
    responderError(res, error, 'Error al crear factura');
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;

    const facturaEliminada = await facturasCompraRepository.eliminarConReversion(id);

    if (!facturaEliminada) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    res.json({ mensaje: 'Factura eliminada y stock revertido', factura: facturaEliminada });
  } catch (error) {
    responderError(res, error, 'Error al eliminar factura');
  }
}
async function agregarDetalleFactura(req, res) {
  try {
    const { id } = req.params;
    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Necesitás cargar al menos un item' });
    }

    const itemsValidos = items.map(item => {
      if (!item || !esEnteroPositivo(item.insumo_id) || !esNumero(item.cantidad) || Number(item.cantidad) <= 0
        || !esNumero(item.precio_unitario) || Number(item.precio_unitario) < 0) {
        throw new ErrorNegocio('Cada item necesita un insumo, una cantidad mayor a cero y un precio válido');
      }
      return {
        insumo_id: Number(item.insumo_id),
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario)
      };
    });

    const alertas = [];
    for (const item of itemsValidos) {
      const ultimoPrecio = await facturasCompraRepository.obtenerUltimoPrecioInsumo(item.insumo_id);
      if (ultimoPrecio && Number(ultimoPrecio.precio_unitario) > 0) {
        const precioAnterior = Number(ultimoPrecio.precio_unitario);
        const precioNuevo = item.precio_unitario;
        const variacionPorcentual = ((precioNuevo - precioAnterior) / precioAnterior) * 100;

        if (Math.abs(variacionPorcentual) >= 1) {
          alertas.push({
            insumo_id: item.insumo_id,
            precioAnterior,
            precioNuevo,
            variacionPorcentual: Number(variacionPorcentual.toFixed(1))
          });
        }
      }
    }

    const detalle = await facturasCompraRepository.agregarDetalle(id, itemsValidos);

    res.status(201).json({ detalle, alertas });
  } catch (error) {
    responderError(res, error, 'Error al cargar el detalle de la compra');
  }
}

async function obtenerDetalleDeFactura(req, res) {
  try {
    const { id } = req.params;
    const detalle = await facturasCompraRepository.obtenerDetallePorFactura(id);
    res.json(detalle);
  } catch (error) {
    responderError(res, error, 'Error al obtener el detalle');
  }
}

module.exports = { listar, obtenerUna, crear, eliminar, agregarDetalleFactura, obtenerDetalleDeFactura };
