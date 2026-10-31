// Estado de resultados por costeo variable. Es una función pura.
//
//   Ventas (netas de IVA si es Responsable Inscripto)
//   − Gastos variables (compras de insumos + lo cargado como gasto variable: materia prima, papelería)
//   = Margen de contribución
//   − Gastos fijos (sueldos, servicios, alquiler, monotributo, seguros, impuestos y permisos)
//   − Gastos sin clasificar (se restan por prudencia y se avisan aparte)
//   = Resultado neto
//
// Es la cuenta de siempre: ventas − gastos variables − gastos fijos = resultado neto.
// El margen de contribución es solo un subtotal intermedio: de ahí sale el punto de equilibrio.
//
// Punto de equilibrio = gastos fijos ÷ (margen de contribución ÷ ventas):
// cuánto hay que vender en el período para cubrir todos los costos fijos.

const CONDICIONES_IVA = ['monotributo', 'responsable_inscripto'];

function redondear(n) {
  return Math.round(Number(n) * 100) / 100;
}

// % sobre ventas; sin ventas no se puede calcular (null en vez de inventar un 0).
function porcentaje(parte, ventas) {
  return ventas > 0 ? redondear((parte / ventas) * 100) : null;
}

// entrada: { ventas, compras, gastos: {fijos, variables, sinClasificar}, iva: {condicion, alicuota} }
//  - compras: total de las facturas de compra de insumos (la materia prima), ya cuentan como variable.
//  - gastos.variables: lo cargado como gasto variable (materia prima que no pasa por Compras, papelería, etc.).
function armarEstadoResultados({ ventas, compras, gastos, iva }) {
  const condicion = iva && iva.condicion;
  const esRI = condicion === 'responsable_inscripto';
  const alicuota = esRI ? Number(iva.alicuota) : 0;

  const ventasBrutas = Number(ventas);
  // Con IVA incluido en el precio: neto = precio ÷ (1 + alícuota). El IVA no es ganancia: es del fisco.
  const ventasNetas = esRI ? ventasBrutas / (1 + alicuota / 100) : ventasBrutas;
  const iva21 = ventasBrutas - ventasNetas;

  const comprasInsumos = Number(compras);
  const otrosVariables = Number(gastos.variables);
  const gastosVariables = comprasInsumos + otrosVariables;

  const margenContribucion = ventasNetas - gastosVariables;
  const resultadoNeto = margenContribucion - Number(gastos.fijos) - Number(gastos.sinClasificar);

  const pctContribucion = ventasNetas > 0 ? margenContribucion / ventasNetas : null;
  // Si el margen de contribución no es positivo, vender más no alcanza para cubrir los fijos.
  const puntoEquilibrio = pctContribucion !== null && pctContribucion > 0
    ? redondear(Number(gastos.fijos) / pctContribucion)
    : null;

  return {
    condicionIva: esRI ? 'responsable_inscripto' : 'monotributo',
    ventasBrutas: redondear(ventasBrutas),
    iva: redondear(iva21),
    ventasNetas: redondear(ventasNetas),
    compras: redondear(comprasInsumos),
    otrosVariables: redondear(otrosVariables),
    gastosVariables: redondear(gastosVariables),
    margenContribucion: redondear(margenContribucion),
    margenContribucionPorcentual: porcentaje(margenContribucion, ventasNetas),
    gastosFijos: redondear(gastos.fijos),
    gastosSinClasificar: redondear(gastos.sinClasificar),
    resultadoNeto: redondear(resultadoNeto),
    margenNetoPorcentual: porcentaje(resultadoNeto, ventasNetas),
    puntoEquilibrio,
    // Cuánto falta (o sobra) vender respecto del equilibrio. Positivo = ya lo superó.
    colchonSobreEquilibrio: puntoEquilibrio === null ? null : redondear(ventasNetas - puntoEquilibrio)
  };
}

// Suma las entradas de varias sucursales y arma UN estado de resultados con los totales
// (los porcentajes se recalculan sobre el total, no se promedian).
function sumarEntradas(entradas) {
  const suma = (f) => entradas.reduce((acc, e) => acc + Number(f(e)), 0);
  return {
    ventas: suma(e => e.ventas),
    compras: suma(e => e.compras),
    gastos: {
      fijos: suma(e => e.gastos.fijos),
      variables: suma(e => e.gastos.variables),
      sinClasificar: suma(e => e.gastos.sinClasificar)
    },
    iva: entradas.length > 0 ? entradas[0].iva : { condicion: 'monotributo', alicuota: 21 }
  };
}

module.exports = { CONDICIONES_IVA, armarEstadoResultados, sumarEntradas };
