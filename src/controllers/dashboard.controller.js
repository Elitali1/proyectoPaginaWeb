const cierreCajaRepository = require('../repositories/cierreCaja.repository.js');
const clientesRepository = require('../repositories/clientes.repository.js');
const recetasRepository = require('../repositories/recetas.repository.js');
const insumosRepository = require('../repositories/insumos.repository.js');
const facturasCompraRepository = require('../repositories/facturasCompra.repository.js');
const gastosRepository = require('../repositories/gastos.repository.js');
const sucursalesRepository = require('../repositories/sucursales.repository.js');
const configuracionRepository = require('../repositories/configuracion.repository.js');
const { responderError } = require('../utils/errores.js');
const { esFechaISO } = require('../utils/validaciones.js');
const { clasificarGastos } = require('../utils/gastos.js');
const { armarEstadoResultados } = require('../utils/estadoResultados.js');

async function obtenerDashboard(req, res) {
  try {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Necesitás indicar desde y hasta' });
    }
    if (!esFechaISO(desde) || !esFechaISO(hasta)) {
      return res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD' });
    }

    const resumen = await cierreCajaRepository.calcularResumenPeriodo(desde, hasta, req.sucursalId);
    const totalesPorMedioPago = await cierreCajaRepository.calcularTotalesPorMedioPago(desde, hasta, req.sucursalId);
    const clientesRecurrentes = await clientesRepository.obtenerMasRecurrentes(desde, hasta, 10);
    const mejoresMargenes = await recetasRepository.obtenerMejoresMargenes(10, req.sucursalId);

    const todosLosInsumos = await insumosRepository.obtenerTodos(req.sucursalId);
    const stockBajo = todosLosInsumos.filter(insumo =>
      insumo.activo && Number(insumo.stock_minimo) > 0 && Number(insumo.stock_actual) < Number(insumo.stock_minimo)
    );

    const compras = await facturasCompraRepository.obtenerPorRangoFechas(desde, hasta, req.sucursalId);
    const totalCompras = compras.reduce((suma, c) => suma + Number(c.monto), 0);

    const gastos = await gastosRepository.obtenerPorRangoFechas(desde, hasta, req.sucursalId);
    const totalGastos = gastos.reduce((suma, g) => suma + Number(g.monto), 0);

    const gananciaNeta = resumen.ventasTotales - totalCompras - totalGastos;

    // Estado de resultados con costos fijos y variables (ver utils/estadoResultados.js).
    const sucursal = await sucursalesRepository.obtener(req.sucursalId);
    const iva = await configuracionRepository.obtenerIva();
    const estadoResultados = armarEstadoResultados({
      ventas: resumen.ventasTotales,
      compras: totalCompras,
      gastos: clasificarGastos(gastos),
      iva
    });

    res.json({
      periodo: { desde, hasta },
      resumen: {
        cantidadPedidos: resumen.cantidadPedidos,
        ventasTotales: resumen.ventasTotales,
        ticketPromedio: resumen.ticketPromedio
      },
      // Antes se llamaba "mercadopago" a todo lo cobrado por transferencia; ahora cada sucursal indica
      // en qué cuenta cobra (cuentaTransferencia). La clave "mercadopago" se mantiene por compatibilidad.
      pagos: {
        efectivo: Number(totalesPorMedioPago.total_efectivo),
        mercadopago: Number(totalesPorMedioPago.total_transferencia)
      },
      cuentaTransferencia: sucursal.cuenta_transferencia || 'MercadoPago',
      topProductos: resumen.topProductos,
      clientesRecurrentes,
      mejoresMargenes,
      stockBajo,
      balance: {
        ventas: resumen.ventasTotales,
        compras: totalCompras,
        gastos: totalGastos,
        gananciaNeta
      },
      estadoResultados
    });
  } catch (error) {
    responderError(res, error, 'Error al generar el dashboard');
  }
}

module.exports = { obtenerDashboard };
