const facturasCompraRepository = require('../repositories/facturasCompra.repository.js');

async function listar(req, res) {
  try {
    const { desde, hasta } = req.query;

    if (desde && hasta) {
      const facturas = await facturasCompraRepository.obtenerPorRangoFechas(desde, hasta);
      return res.json(facturas);
    }

    const facturas = await facturasCompraRepository.obtenerTodas();
    res.json(facturas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener facturas de compra' });
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
    console.error(error);
    res.status(500).json({ error: 'Error al obtener factura' });
  }
}

async function crear(req, res) {
  try {
    const { proveedor, concepto, monto, fecha, archivo_url, subido_por } = req.body;
    const nuevaFactura = await facturasCompraRepository.crear({
      proveedor, concepto, monto, fecha, archivo_url, subido_por
    });
    res.status(201).json(nuevaFactura);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear factura' });
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const facturaEliminada = await facturasCompraRepository.eliminar(id);

    if (!facturaEliminada) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    res.json({ mensaje: 'Factura eliminada', factura: facturaEliminada });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar factura' });
  }
}

module.exports = { listar, obtenerUna, crear, eliminar };