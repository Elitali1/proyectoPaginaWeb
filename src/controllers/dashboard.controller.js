const cierreCajaRepository = require('../repositories/cierreCaja.repository.js');
const clientesRepository = require('../repositories/clientes.repository.js');
const recetasRepository = require('../repositories/recetas.repository.js');
const insumosRepository = require('../repositories/insumos.repository.js');
const facturasCompraRepository = require('../repositories/facturasCompra.repository.js');
const gastosRepository = require('../repositories/gastos.repository.js');
const { responderError } = require('../utils/errores.js');
const { esFechaISO } = require('../utils/validaciones.js');

async function obtenerDashboard(req, res) {
  try {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Necesitás indicar desde y hasta' });
    }
    if (!esFechaISO(desde) || !esFechaISO(hasta)) {
      return res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD' });
    }

    const resumen = await cierreCajaRepository.calcularResumenPeriodo(desde, hasta);
    const totalesPorMedioPago = await cierreCajaRepository.calcularTotalesPorMedioPago(desde, hasta);
    const clientesRecurrentes = await clientesRepository.obtenerMasRecurrentes(desde, hasta, 10);
    const mejoresMargenes = await recetasRepository.obtenerMejoresMargenes(10);

    const todosLosInsumos = await insumosRepository.obtenerTodos();
    const stockBajo = todosLosInsumos.filter(insumo =>
      insumo.activo && Number(insumo.stock_minimo) > 0 && Number(insumo.stock_actual) < Number(insumo.stock_minimo)
    );

    const compras = await facturasCompraRepository.obtenerPorRangoFechas(desde, hasta);
    const totalCompras = compras.reduce((suma, c) => suma + Number(c.monto), 0);

    const gastos = await gastosRepository.obtenerPorRangoFechas(desde, hasta);
    const totalGastos = gastos.reduce((suma, g) => suma + Number(g.monto), 0);

    const gananciaNeta = resumen.ventasTotales - totalCompras - totalGastos;

    res.json({
      periodo: { desde, hasta },
      resumen: {
        cantidadPedidos: resumen.cantidadPedidos,
        ventasTotales: resumen.ventasTotales,
        ticketPromedio: resumen.ticketPromedio
      },
      // "mercadopago" es como en el local se le dice a todo lo que se cobra por transferencia/link de pago.
      pagos: {
        efectivo: Number(totalesPorMedioPago.total_efectivo),
        mercadopago: Number(totalesPorMedioPago.total_transferencia)
      },
      topProductos: resumen.topProductos,
      clientesRecurrentes,
      mejoresMargenes,
      stockBajo,
      balance: {
        ventas: resumen.ventasTotales,
        compras: totalCompras,
        gastos: totalGastos,
        gananciaNeta
      }
    });
  } catch (error) {
    responderError(res, error, 'Error al generar el dashboard');
  }
}

module.exports = { obtenerDashboard };
