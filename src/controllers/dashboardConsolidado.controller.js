const cierreCajaRepository = require('../repositories/cierreCaja.repository.js');
const facturasCompraRepository = require('../repositories/facturasCompra.repository.js');
const gastosRepository = require('../repositories/gastos.repository.js');
const sucursalesRepository = require('../repositories/sucursales.repository.js');
const configuracionRepository = require('../repositories/configuracion.repository.js');
const { responderError } = require('../utils/errores.js');
const { esFechaISO } = require('../utils/validaciones.js');
const { clasificarGastos } = require('../utils/gastos.js');
const { armarConsolidado } = require('../utils/consolidado.js');

const sumarMontos = filas => filas.reduce((suma, f) => suma + Number(f.monto), 0);

// Solo lectura: junta los números de cada sucursal con las mismas funciones que usa el dashboard
// normal (así los totales coinciden siempre) y los suma. No modifica nada.
async function obtenerConsolidado(req, res) {
  try {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Necesitás indicar desde y hasta' });
    }
    if (!esFechaISO(desde) || !esFechaISO(hasta)) {
      return res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD' });
    }

    const sucursales = await sucursalesRepository.listarCompleta();
    const iva = await configuracionRepository.obtenerIva();

    const items = await Promise.all(sucursales.map(async (sucursal) => {
      const [resumen, pagos, compras, gastos] = await Promise.all([
        cierreCajaRepository.calcularResumenPeriodo(desde, hasta, sucursal.id),
        cierreCajaRepository.calcularTotalesPorMedioPago(desde, hasta, sucursal.id),
        facturasCompraRepository.obtenerPorRangoFechas(desde, hasta, sucursal.id),
        gastosRepository.obtenerPorRangoFechas(desde, hasta, sucursal.id)
      ]);
      return {
        sucursal,
        resumen,
        pagos: { efectivo: Number(pagos.total_efectivo), transferencia: Number(pagos.total_transferencia) },
        compras: sumarMontos(compras),
        gastos: clasificarGastos(gastos),
        iva
      };
    }));

    res.json({ periodo: { desde, hasta }, ...armarConsolidado(items) });
  } catch (error) {
    responderError(res, error, 'Error al generar el consolidado');
  }
}

module.exports = { obtenerConsolidado };
