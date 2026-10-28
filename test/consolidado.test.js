const test = require('node:test');
const assert = require('node:assert');
const { armarConsolidado } = require('../src/utils/consolidado.js');

const item = (id, nombre, activa, pedidos, ventas, ef, tr, compras, gastos, top = []) => ({
  sucursal: { id, nombre, activa },
  resumen: { cantidadPedidos: pedidos, ventasTotales: ventas, topProductos: top },
  pagos: { efectivo: ef, transferencia: tr },
  compras, gastos
});

test('consolidado: suma ventas, compras, gastos y ganancia de todas las sucursales', () => {
  const r = armarConsolidado([
    item(1, 'General Villegas', true, 10, 100000, 60000, 40000, 30000, 10000),
    item(2, '25 de Mayo', true, 5, 50000, 20000, 30000, 25000, 5000)
  ]);
  assert.strictEqual(r.total.ventas, 150000);
  assert.strictEqual(r.total.pedidos, 15);
  assert.strictEqual(r.total.ticketPromedio, 10000);
  assert.strictEqual(r.total.compras, 55000);
  assert.strictEqual(r.total.gastos, 15000);
  assert.strictEqual(r.total.ganancia, 80000);
  assert.strictEqual(r.total.efectivo, 80000);
  assert.strictEqual(r.total.transferencia, 70000);
});

test('consolidado: el total es igual a la suma de las ganancias por sucursal', () => {
  const r = armarConsolidado([
    item(1, 'A', true, 3, 30000, 0, 30000, 40000, 0),
    item(2, 'B', true, 4, 40000, 40000, 0, 0, 5000)
  ]);
  assert.deepStrictEqual(r.porSucursal.map(s => s.ganancia), [-10000, 35000]);
  assert.strictEqual(r.total.ganancia, 25000);
});

test('consolidado: participación y margen por sucursal', () => {
  const r = armarConsolidado([
    item(1, 'A', true, 1, 75000, 0, 0, 0, 0),
    item(2, 'B', true, 1, 25000, 0, 0, 0, 5000)
  ]);
  assert.strictEqual(r.porSucursal[0].participacionPorcentual, 75);
  assert.strictEqual(r.porSucursal[1].participacionPorcentual, 25);
  assert.strictEqual(r.porSucursal[1].margenPorcentual, 80);
});

test('consolidado: sin ventas no se inventan porcentajes ni se divide por cero', () => {
  const r = armarConsolidado([item(1, 'A', true, 0, 0, 0, 0, 1000, 0), item(2, 'B', true, 0, 0, 0, 0, 0, 0)]);
  assert.strictEqual(r.total.ticketPromedio, 0);
  assert.strictEqual(r.total.margenPorcentual, null);
  assert.strictEqual(r.porSucursal[0].participacionPorcentual, 0);
  assert.strictEqual(r.total.ganancia, -1000);
});

test('consolidado: una sucursal inactiva sin movimiento se oculta, con movimiento se muestra', () => {
  const sinMov = armarConsolidado([item(1, 'A', true, 1, 100, 0, 0, 0, 0), item(2, 'Vieja', false, 0, 0, 0, 0, 0, 0)]);
  assert.strictEqual(sinMov.porSucursal.length, 1);
  const conMov = armarConsolidado([item(1, 'A', true, 1, 100, 0, 0, 0, 0), item(2, 'Vieja', false, 2, 500, 0, 0, 0, 0)]);
  assert.strictEqual(conMov.porSucursal.length, 2);
  assert.strictEqual(conMov.total.ventas, 600);
});

test('consolidado: los productos más vendidos se suman entre sucursales y se ordenan', () => {
  const r = armarConsolidado([
    item(1, 'A', true, 1, 1, 0, 0, 0, 0, [
      { categoria_nombre: 'Pizzas', producto_nombre: 'Muzzarella', cantidad_vendida: '10' },
      { categoria_nombre: 'Bebidas', producto_nombre: 'Coca', cantidad_vendida: '4' }
    ]),
    item(2, 'B', true, 1, 1, 0, 0, 0, 0, [
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