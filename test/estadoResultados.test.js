const test = require('node:test');
const assert = require('node:assert');
const { armarEstadoResultados, sumarEntradas } = require('../src/utils/estadoResultados.js');

const MONO = { condicion: 'monotributo', alicuota: 21 };
const RI = { condicion: 'responsable_inscripto', alicuota: 21 };
const gastos = (fijos = 0, variables = 0, directos = 0, sinClasificar = 0) => ({ fijos, variables, directos, sinClasificar });

test('estado de resultados: cadena completa de ganancia bruta a resultado neto (monotributo)', () => {
  const e = armarEstadoResultados({ ventas: 1000000, compras: 300000, gastos: gastos(250000, 50000, 100000), iva: MONO });
  assert.strictEqual(e.ventasNetas, 1000000);
  assert.strictEqual(e.iva, 0);
  assert.strictEqual(e.costoMercaderia, 400000);        // compras + gastos de mercadería
  assert.strictEqual(e.gananciaBruta, 600000);
  assert.strictEqual(e.margenBrutoPorcentual, 60);
  assert.strictEqual(e.margenContribucion, 550000);      // bruta − variables
  assert.strictEqual(e.margenContribucionPorcentual, 55);
  assert.strictEqual(e.resultadoNeto, 300000);           // − fijos
  assert.strictEqual(e.margenNetoPorcentual, 30);
});

test('estado de resultados: punto de equilibrio = fijos ÷ % de margen de contribución', () => {
  const e = armarEstadoResultados({ ventas: 1000000, compras: 300000, gastos: gastos(250000, 50000, 100000), iva: MONO });
  assert.strictEqual(e.puntoEquilibrio, 454545.45);      // 250000 / 0.55
  assert.strictEqual(e.colchonSobreEquilibrio, 545454.55);
});

test('estado de resultados: si el margen de contribución es negativo no hay punto de equilibrio', () => {
  const e = armarEstadoResultados({ ventas: 100000, compras: 150000, gastos: gastos(10000), iva: MONO });
  assert.strictEqual(e.puntoEquilibrio, null);
  assert.strictEqual(e.colchonSobreEquilibrio, null);
  assert.strictEqual(e.resultadoNeto, -60000);
});

test('estado de resultados: sin ventas no se divide por cero ni se inventan porcentajes', () => {
  const e = armarEstadoResultados({ ventas: 0, compras: 0, gastos: gastos(5000), iva: MONO });
  assert.strictEqual(e.margenBrutoPorcentual, null);
  assert.strictEqual(e.margenNetoPorcentual, null);
  assert.strictEqual(e.puntoEquilibrio, null);
  assert.strictEqual(e.resultadoNeto, -5000);
});

test('estado de resultados: Responsable Inscripto trabaja con ventas netas de IVA', () => {
  const e = armarEstadoResultados({ ventas: 1210000, compras: 0, gastos: gastos(), iva: RI });
  assert.strictEqual(e.condicionIva, 'responsable_inscripto');
  assert.strictEqual(e.ventasBrutas, 1210000);
  assert.strictEqual(e.ventasNetas, 1000000);
  assert.strictEqual(e.iva, 210000);
  assert.strictEqual(e.resultadoNeto, 1000000);
});

test('estado de resultados: la alícuota es un parámetro (10,5 %)', () => {
  const e = armarEstadoResultados({ ventas: 1105000, compras: 0, gastos: gastos(), iva: { condicion: 'responsable_inscripto', alicuota: 10.5 } });
  assert.strictEqual(e.ventasNetas, 1000000);
});

test('estado de resultados: los gastos sin clasificar se restan y se informan aparte', () => {
  const e = armarEstadoResultados({ ventas: 100000, compras: 0, gastos: gastos(0, 0, 0, 34000), iva: MONO });
  assert.strictEqual(e.gastosSinClasificar, 34000);
  assert.strictEqual(e.resultadoNeto, 66000);
});

test('estado de resultados: sin configuración de IVA se asume monotributo', () => {
  const e = armarEstadoResultados({ ventas: 100, compras: 0, gastos: gastos(), iva: undefined });
  assert.strictEqual(e.condicionIva, 'monotributo');
  assert.strictEqual(e.ventasNetas, 100);
});

test('sumar entradas: el total recalcula los porcentajes sobre la suma (no promedia)', () => {
  const a = { ventas: 1000, compras: 100, gastos: gastos(100), iva: MONO };   // neto 800  (80 %)
  const b = { ventas: 3000, compras: 2000, gastos: gastos(0), iva: MONO };    // neto 1000 (33,33 %)
  const total = armarEstadoResultados(sumarEntradas([a, b]));
  assert.strictEqual(total.ventasNetas, 4000);
  assert.strictEqual(total.resultadoNeto, 1800);
  assert.strictEqual(total.margenNetoPorcentual, 45);                          // no el promedio 56,67
  const suma = armarEstadoResultados(a).resultadoNeto + armarEstadoResultados(b).resultadoNeto;
  assert.strictEqual(total.resultadoNeto, suma);
});
