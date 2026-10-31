const test = require('node:test');
const assert = require('node:assert/strict');
const { armarEstadoResultados, sumarEntradas } = require('../src/utils/estadoResultados.js');

const sinGastos = { fijos: 0, variables: 0, sinClasificar: 0 };

test('estado de resultados: ventas − gastos variables − gastos fijos = resultado neto (monotributo)', () => {
  const e = armarEstadoResultados({
    ventas: 100000,
    compras: 30000, // materia prima comprada en Compras
    gastos: { fijos: 20000, variables: 10000, sinClasificar: 0 }, // variables: papelería y otros
    iva: { condicion: 'monotributo' }
  });
  assert.equal(e.ventasNetas, 100000);
  assert.equal(e.gastosVariables, 40000); // 30000 de compras + 10000 cargados como variables
  assert.equal(e.margenContribucion, 60000);
  assert.equal(e.margenContribucionPorcentual, 60);
  assert.equal(e.gastosFijos, 20000);
  assert.equal(e.resultadoNeto, 40000); // 100000 − 40000 − 20000
  assert.equal(e.margenNetoPorcentual, 40);
});

test('estado de resultados: ya no existe la ganancia bruta ni el costo de mercadería aparte', () => {
  const e = armarEstadoResultados({ ventas: 100000, compras: 30000, gastos: sinGastos, iva: { condicion: 'monotributo' } });
  assert.equal(e.gananciaBruta, undefined);
  assert.equal(e.margenBrutoPorcentual, undefined);
  assert.equal(e.costoMercaderia, undefined);
  assert.equal(e.gastosDirectos, undefined);
});

test('estado de resultados: el detalle de variables separa compras de insumos y otros variables', () => {
  const e = armarEstadoResultados({ ventas: 50000, compras: 12000, gastos: { fijos: 0, variables: 3000, sinClasificar: 0 }, iva: { condicion: 'monotributo' } });
  assert.equal(e.compras, 12000);
  assert.equal(e.otrosVariables, 3000);
  assert.equal(e.gastosVariables, 15000);
});

test('estado de resultados: punto de equilibrio = fijos ÷ % de margen de contribución', () => {
  const e = armarEstadoResultados({
    ventas: 200000,
    compras: 80000,
    gastos: { fijos: 30000, variables: 20000, sinClasificar: 0 },
    iva: { condicion: 'monotributo' }
  });
  // margen de contribución: 200000 − 100000 = 100000 (50 %) → equilibrio = 30000 ÷ 0,5
  assert.equal(e.margenContribucionPorcentual, 50);
  assert.equal(e.puntoEquilibrio, 60000);
  assert.equal(e.colchonSobreEquilibrio, 140000);
});

test('estado de resultados: si el margen de contribución es negativo no hay punto de equilibrio', () => {
  const e = armarEstadoResultados({ ventas: 10000, compras: 12000, gastos: { fijos: 5000, variables: 0, sinClasificar: 0 }, iva: { condicion: 'monotributo' } });
  assert.equal(e.margenContribucion, -2000);
  assert.equal(e.puntoEquilibrio, null);
  assert.equal(e.colchonSobreEquilibrio, null);
  assert.equal(e.resultadoNeto, -7000);
});

test('estado de resultados: sin ventas no se divide por cero ni se inventan porcentajes', () => {
  const e = armarEstadoResultados({ ventas: 0, compras: 0, gastos: { fijos: 15000, variables: 0, sinClasificar: 0 }, iva: { condicion: 'monotributo' } });
  assert.equal(e.margenContribucionPorcentual, null);
  assert.equal(e.margenNetoPorcentual, null);
  assert.equal(e.puntoEquilibrio, null);
  assert.equal(e.resultadoNeto, -15000);
});

test('estado de resultados: Responsable Inscripto trabaja con ventas netas de IVA', () => {
  const e = armarEstadoResultados({ ventas: 121000, compras: 40000, gastos: sinGastos, iva: { condicion: 'responsable_inscripto', alicuota: 21 } });
  assert.equal(e.condicionIva, 'responsable_inscripto');
  assert.equal(e.ventasBrutas, 121000);
  assert.equal(e.ventasNetas, 100000);
  assert.equal(e.iva, 21000);
  assert.equal(e.resultadoNeto, 60000);
});

test('estado de resultados: la alícuota es un parámetro (10,5 %)', () => {
  const e = armarEstadoResultados({ ventas: 110500, compras: 0, gastos: sinGastos, iva: { condicion: 'responsable_inscripto', alicuota: 10.5 } });
  assert.equal(e.ventasNetas, 100000);
  assert.equal(e.iva, 10500);
});

test('estado de resultados: los gastos sin clasificar se restan y se informan aparte', () => {
  const e = armarEstadoResultados({ ventas: 100000, compras: 0, gastos: { fijos: 10000, variables: 0, sinClasificar: 5000 }, iva: { condicion: 'monotributo' } });
  assert.equal(e.gastosSinClasificar, 5000);
  assert.equal(e.resultadoNeto, 85000); // 100000 − 10000 − 5000
});

test('estado de resultados: sin configuración de IVA se asume monotributo', () => {
  const e = armarEstadoResultados({ ventas: 100000, compras: 0, gastos: sinGastos });
  assert.equal(e.condicionIva, 'monotributo');
  assert.equal(e.ventasNetas, 100000);
  assert.equal(e.iva, 0);
});

test('sumar entradas: el total recalcula los porcentajes sobre la suma (no promedia)', () => {
  const a = { ventas: 100000, compras: 50000, gastos: { fijos: 10000, variables: 0, sinClasificar: 0 }, iva: { condicion: 'monotributo' } };
  const b = { ventas: 300000, compras: 60000, gastos: { fijos: 20000, variables: 15000, sinClasificar: 0 }, iva: { condicion: 'monotributo' } };
  const total = armarEstadoResultados(sumarEntradas([a, b]));
  assert.equal(total.ventasNetas, 400000);
  assert.equal(total.gastosVariables, 125000); // 50000 + 60000 + 15000
  assert.equal(total.gastosFijos, 30000);
  assert.equal(total.resultadoNeto, 245000);
  // a deja 50 % de margen de contribución y b 75 %: el promedio simple daría 62,5 %, el total real es 68,75 %
  assert.equal(total.margenContribucionPorcentual, 68.75);
});

test('sumar entradas: sin entradas devuelve ceros y monotributo por defecto', () => {
  const total = armarEstadoResultados(sumarEntradas([]));
  assert.equal(total.ventasNetas, 0);
  assert.equal(total.resultadoNeto, 0);
  assert.equal(total.condicionIva, 'monotributo');
});
