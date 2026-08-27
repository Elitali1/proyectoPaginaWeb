const facturasVentaRepository = require('../repositories/facturasVenta.repository.js');

async function listar(req, res) {
  try {
    const facturas = await facturasVentaRepository.obtenerTodas();
    res.json(facturas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener facturas de venta' });
  }
}

async function obtenerUna(req, res) {
  try {
    const { id } = req.params;
    const factura = await facturasVentaRepository.obtenerPorId(id);

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
    const { pedido_id, tipo_comprobante, monto } = req.body;

    const existente = await facturasVentaRepository.obtenerPorPedido(pedido_id);
    if (existente) {
      return res.status(400).json({ error: 'Este pedido ya tiene una factura asociada' });
    }

    const nuevaFactura = await facturasVentaRepository.crear({ pedido_id, tipo_comprobante, monto });
    res.status(201).json(nuevaFactura);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear factura' });
  }
}

module.exports = { listar, obtenerUna, crear };