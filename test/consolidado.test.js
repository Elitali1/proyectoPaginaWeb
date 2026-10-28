const test = require('node:test');
const assert = require('node:assert');
const { armarConsolidado } = require('../src/utils/consolidado.js');

const MONO = { condicion: 'monotributo', alicuota: 21 };
const g = (fijos = 0, variables = 0, directos = 0, sinClasificar = 0) => ({ fijos, variables, directos, sinClasificar });
const item = (id, nombre, activa, pedidos, ventas, ef, tr, compras, gastos, top = [], cuenta) => ({
  sucursal: { id, nombre, activa, cuenta_transferencia: cuenta },
  resumen: { cantidadPedidos: pedidos, ventasTotales: ventas, topProductos: top },
  pagos: { efectivo: ef, transferencia: tr },
  compras, gastos, iva: MONO
});

test('consolidado: suma ventas, compras, gastos y resultado de todas las sucursales', () => {
  const r = armarConsolidado([
    item(1, 'General Villegas', true, 10, 100000, 60000, 40000, 30000, g(10000)),
    item(2, '25 de Mayo', true, 5, 50000, 20000, 30000, 25000, g(5000))
  ]);
  assert.strictEqual(r.total.ventas, 150000);
  assert.strictEqual(r.total.pedidos, 15);
  assert.strictEqual(r.total.ticketPromedio, 10000);
  assert.strictEqual(r.total.efectivo, 80000);
  assert.strictEqual(r.total.transferencia, 70000);
  assert.strictEqual(r.total.estado.compras, 55000);
  assert.strictEqual(r.total.estado.gastosFijos, 15000);
  assert.strictEqual(r.total.estado.resultadoNeto, 80000);
});

test('consolidado: el resultado total es la suma de los resultados de cada sucursal', () => {
  const r = armarConsolidado([
    item(1, 'A', true, 3, 30000, 0, 30000, 40000, g()),
    item(2, 'B', true, 4, 40000, 40000, 0, 0, g(5000))
  ]);
  assert.deepStrictEqual(r.porSucursal.map(s => s.estado.resultadoNeto), [-10000, 35000]);
  assert.strictEqual(r.total.estado.resultadoNeto, 25000);
});

test('consolidado: el estado de resultados de cada sucursal separa fijos, variables y mercadería', () => {
  const r = armarConsolidado([item(1, 'A', true, 1, 100000, 0, 0, 20000, g(30000, 5000, 10000))]);
  const e = r.porSucursal[0].estado;
  assert.strictEqual(e.gananciaBruta, 70000);
  assert.strictEqual(e.margenContribucion, 65000);
  assert.strictEqual(e.resultadoNeto, 35000);
});

test('consolidado: participación de cada local sobre las ventas totales', () => {
  const r = armarConsolidado([
    item(1, 'A', true, 1, 75000, 0, 0, 0, g()),
    item(2, 'B', true, 1, 25000, 0, 0, 0, g(5000))
  ]);
  assert.strictEqual(r.porSucursal[0].participacionPorcentual, 75);
  assert.strictEqual(r.porSucursal[1].participacionPorcentual, 25);
});

test('consolidado: sin ventas no se divide por cero', () => {
  const r = armarConsolidado([item(1, 'A', true, 0, 0, 0, 0, 1000, g()), item(2, 'B', true, 0, 0, 0, 0, 0, g())]);
  assert.strictEqual(r.total.ticketPromedio, 0);
  assert.strictEqual(r.total.estado.margenNetoPorcentual, null);
  assert.strictEqual(r.porSucursal[0].participacionPorcentual, 0);
  assert.strictEqual(r.total.estado.resultadoNeto, -1000);
});

test('consolidado: una sucursal inactiva sin movimiento se oculta, con movimiento se muestra', () => {
  const sinMov = armarConsolidado([item(1, 'A', true, 1, 100, 0, 0, 0, g()), item(2, 'Vieja', false, 0, 0, 0, 0, 0, g())]);
  assert.strictEqual(sinMov.porSucursal.length, 1);
  const conMov = armarConsolidado([item(1, 'A', true, 1, 100, 0, 0, 0, g()), item(2, 'Vieja', false, 0, 0, 0, 0, 0, g(50))]);
  assert.strictEqual(conMov.porSucursal.length, 2);
});

test('consolidado: cada sucursal informa su cuenta de cobro (por defecto MercadoPago)', () => {
  const r = armarConsolidado([
    item(1, 'A', true, 1, 1, 0, 0, 0, g(), [], 'MercadoPago'),
    item(2, 'B', true, 1, 1, 0, 0, 0, g(), [], 'Banco Galicia'),
    item(3, 'C', true, 1, 1, 0, 0, 0, g())
  ]);
  assert.deepStrictEqual(r.porSucursal.map(s => s.cuentaTransferencia), ['MercadoPago', 'Banco Galicia', 'MercadoPago']);
});

test('consolidado: los productos más vendidos se suman entre sucursales y se ordenan', () => {
  const r = armarConsolidado([
    item(1, 'A', true, 1, 1, 0, 0, 0, g(), [
      { categoria_nombre: 'Pizzas', producto_nombre: 'Muzzarella', cantidad_vendida: '10' },
      { categoria_nombre: 'Bebidas', producto_nombre: 'Coca', cantidad_vendida: '4' }
    ]),
    item(2, 'B', true, 1, 1, 0, 0, 0, g(), [
      { categoria_nombre: 'Bebidas', producto_nombre: 'Coca', cantidad_vendida: '9' },
      { categoria_nombre: 'Pizzas', producto_nombre: 'Muzzarella', cantidad_vendida: '1' }
    ])
  ]);
  assert.deepStrictEqual(r.topProductos.map(p => [p.producto_nombre, p.cantidad_vendida]), [['Coca', 13], ['Muzzarella', 11]]);
});

test('consolidado: sin sucursales devuelve ceros', () => {
  const r = armarConsolidado([]);
  assert.strictEqual(r.total.ventas, 0);
  assert.deepStrictEqual(r.porSucursal, []);
});
