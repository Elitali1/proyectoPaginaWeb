const cierreCajaRepository = require('../repositories/cierreCaja.repository.js');
const facturasCompraRepository = require('../repositories/facturasCompra.repository.js');
const gastosRepository = require('../repositories/gastos.repository.js');
const { responderError } = require('../utils/errores.js');
const { esFechaISO } = require('../utils/validaciones.js');

async function listar(req, res) {
  try {
    const { desde, hasta } = req.query;

    if ((desde || hasta) && !(esFechaISO(desde) && esFechaISO(hasta))) {
      return res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD' });
    }

    const cierres = desde && hasta
      ? await cierreCajaRepository.obtenerPorRangoFechas(desde, hasta)
      : await cierreCajaRepository.obtenerTodos();

    if (cierres.length === 0) {
      return res.json([]);
    }

    const fechas = cierres.map(cierre => new Date(cierre.fecha).toISOString().split('T')[0]);
    const primeraFecha = fechas.reduce((min, f) => (f < min ? f : min));
    const ultimaFecha = fechas.reduce((max, f) => (f > max ? f : max));

    // Una sola consulta para todos los días (antes era una por cierre, en paralelo).
    const ventasPorDia = await cierreCajaRepository.calcularVentasPorProductoEnRango(primeraFecha, ultimaFecha);

    const cierresConDetalle = cierres.map((cierre, i) => ({
      ...cierre,
      ventasPorProducto: ventasPorDia[fechas[i]] || []
    }));

    res.json(cierresConDetalle);
  } catch (error) {
    responderError(res, error, 'Error al obtener cierres de caja');
  }
}

async function crear(req, res) {
  try {
    const { fecha } = req.body || {};

    if (!esFechaISO(fecha)) {
      return res.status(400).json({ error: 'Indicá la fecha del cierre (AAAA-MM-DD)' });
    }

    // Quién cierra sale del token de la sesión, no de lo que mande el navegador.
    const cerrado_por = req.usuario.id;

    const existente = await cierreCajaRepository.obtenerPorFecha(fecha);

    if (existente) {
      const cierreActualizado = await cierreCajaRepository.actualizar(fecha, cerrado_por);
      return res.json(cierreActualizado);
    }

    const nuevoCierre = await cierreCajaRepository.crear(fecha, cerrado_por);
    res.status(201).json(nuevoCierre);
  } catch (error) {
    responderError(res, error, 'Error al crear cierre de caja');
  }
}

async function balance(req, res) {
  try {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Necesitás indicar desde y hasta' });
    }

    if (!esFechaISO(desde) || !esFechaISO(hasta)) {
      return res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD' });
    }

    // Filtra en la base en lugar de traer todos los cierres de la historia y filtrarlos acá.
    const cierresEnRango = await cierreCajaRepository.obtenerPorRangoFechas(desde, hasta);

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
    responderError(res, error, 'Error al calcular el balance');
  }
}

module.exports = { listar, crear, balance };
