const cierreCajaRepository = require('../repositories/cierreCaja.repository.js');
const facturasCompraRepository = require('../repositories/facturasCompra.repository.js');
const gastosRepository = require('../repositories/gastos.repository.js');

async function listar(req, res) {
  try {
    const cierres = await cierreCajaRepository.obtenerTodos();
    res.json(cierres);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener cierres de caja' });
  }
}

async function crear(req, res) {
  try {
    const { fecha, cerrado_por } = req.body;

    const existente = await cierreCajaRepository.obtenerPorFecha(fecha);

    if (existente) {
      const cierreActualizado = await cierreCajaRepository.actualizar(fecha, cerrado_por);
      return res.json(cierreActualizado);
    }

    const nuevoCierre = await cierreCajaRepository.crear(fecha, cerrado_por);
    res.status(201).json(nuevoCierre);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear cierre de caja' });
  }
}

async function balance(req, res) {
  try {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Necesitás indicar desde y hasta' });
    }

    const cierres = await cierreCajaRepository.obtenerTodos();
    const cierresEnRango = cierres.filter(c => {
      const fecha = new Date(c.fecha).toISOString().split('T')[0];
      return fecha >= desde && fecha <= hasta;
    });

    const ventas = cierresEnRango.reduce((suma, c) => suma + Number(c.total_general), 0);

    const compras = await facturasCompraRepository.obtenerPorRangoFechas(desde, hasta);
    const totalCompras = compras.reduce((suma, c) => suma + Number(c.monto), 0);

    const gastos = await gastosRepository.obtenerPorRangoFechas(desde, hasta);
    const totalGastos = gastos.reduce((suma, g) => suma + Number(g.monto), 0);

    const gananciaNeta = ventas - totalCompras - totalGastos;

    res.json({
      desde,
      hasta,
      ventas,
      compras: totalCompras,
      gastos: totalGastos,
      gananciaNeta
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular el balance' });
  }
}

module.exports = { listar, crear, balance };