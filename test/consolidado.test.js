const test = require('node:test');
const assert = require('node:assert/strict');
const { armarConsolidado } = require('../src/utils/consolidado.js');

const MONO = { condicion: 'monotributo', alicuota: 21 };

// Arma el item de una sucursal como lo hace el servicio: números ya calculados, sin base de datos.
function item(id, nombre, datos = {}) {
  const {
    activa = true, pedidos = 0, ventas = 0, efectivo = 0, transferencia = 0, compras = 0,
    gastos = { fijos: 0, variables: 0, sinClasificar: 0 }, cuenta = null, topProductos = []
  } = datos;
  return {
    sucursal: { id, nombre, activa, cuenta_transferencia: cuenta },
    resumen: { cantidadPedidos: pedidos, ventasTotales: ventas, topProductos },
    pagos: { efectivo, transferencia },
    compras,
    gastos,
    iva: MONO
  };
}

const localUno = () => item(1, 'Villegas', {
  pedidos: 10, ventas: 100000, efectivo: 60000, transferencia: 40000, compras: 30000,
  gastos: { fijos: 20000, variables: 5000, sinClasificar: 0 }
});
const localDos = () => item(2, 'Av. 25 de Mayo', {
  pedidos: 30, ventas: 300000, efectivo: 100000, transferencia: 200000, compras: 90000,
  gastos: { fijos: 50000, variables: 10000, sinClasificar: 2000 }
});

test('consolidado: suma ventas, compras, gastos y resultado de todas las sucursales', () => {
  const c = armarConsolidado([localUno(), localDos()]);
  assert.equal(c.total.ventas, 400000);
  assert.equal(c.total.pedidos, 40);
  assert.equal(c.total.efectivo, 160000);
  assert.equal(c.total.transferencia, 240000);
  assert.equal(c.total.estado.compras, 120000);
  assert.equal(c.total.estado.gastosFijos, 70000);
  assert.equal(c.total.estado.gastosSinClasificar, 2000);
});

test('consolidado: el resultado total es la suma del resultado de cada sucursal', () => {
  const c = armarConsolidado([localUno(), localDos()]);
  const suma = c.porSucursal.reduce((acc, s) => acc + s.estado.resultadoNeto, 0);
  assert.equal(c.total.estado.resultadoNeto, suma);
  // Villegas: 100000 − (30000 + 5000) − 20000 = 45000 · Av. 25 de Mayo: 300000 − (90000 + 10000) − 50000 − 2000 = 148000
  assert.equal(c.porSucursal[0].estado.resultadoNeto, 45000);
  assert.equal(c.porSucursal[1].estado.resultadoNeto, 148000);
  assert.equal(c.total.estado.resultadoNeto, 193000);
});

test('consolidado: el estado de resultados de cada sucursal separa fijos y variables (con la materia prima adentro)', () => {
  const c = armarConsolidado([localUno()]);
  const e = c.porSucursal[0].estado;
  assert.equal(e.gastosVariables, 35000); // 30000 de compras + 5000 cargados como variables
  assert.equal(e.compras, 30000);
  assert.equal(e.otrosVariables, 5000);
  assert.equal(e.gastosFijos, 20000);
  assert.equal(e.gananciaBruta, undefined);
});

test('consolidado: participación de cada local sobre las ventas totales', () => {
  const c = armarConsolidado([localUno(), localDos()]);
  assert.equal(c.porSucursal[0].participacionPorcentual, 25);
  assert.equal(c.porSucursal[1].participacionPorcentual, 75);
});

test('consolidado: sin ventas no se divide por cero', () => {
  const c = armarConsolidado([item(1, 'Villegas', { gastos: { fijos: 1000, variables: 0, sinClasificar: 0 } })]);
  assert.equal(c.total.ticketPromedio, 0);
  assert.equal(c.porSucursal[0].participacionPorcentual, 0);
  assert.equal(c.total.estado.margenNetoPorcentual, null);
  assert.equal(c.total.estado.puntoEquilibrio, null);
});

test('consolidado: una sucursal inactiva sin movimiento se oculta, con movimiento se muestra', () => {
  const sinMovimiento = armarConsolidado([localUno(), item(3, 'Vieja', { activa: false })]);
  assert.equal(sinMovimiento.porSucursal.length, 1);

  const conGastos = armarConsolidado([localUno(), item(3, 'Vieja', { activa: false, gastos: { fijos: 500, variables: 0, sinClasificar: 0 } })]);
  assert.equal(conGastos.porSucursal.length, 2);

  const conPedidos = armarConsolidado([localUno(), item(3, 'Vieja', { activa: false, pedidos: 2, ventas: 5000 })]);
  assert.equal(conPedidos.porSucursal.length, 2);
});

test('consolidado: cada sucursal informa su cuenta de cobro (por defecto MercadoPago)', () => {
  const c = armarConsolidado([item(1, 'Villegas', { activa: true }), item(2, 'Av. 25 de Mayo', { activa: true, cuenta: 'Cuenta DNI' })]);
  assert.equal(c.porSucursal[0].cuentaTransferencia, 'MercadoPago');
  assert.equal(c.porSucursal[1].cuentaTransferencia, 'Cuenta DNI');
});

test('consolidado: los productos más vendidos se suman entre sucursales y se ordenan', () => {
  const a = item(1, 'Villegas', { topProductos: [
    { categoria_nombre: 'Pizzas', producto_nombre: 'Muzzarella', cantidad_vendida: 10 },
    { categoria_nombre: 'Pizzas', producto_nombre: 'Napolitana', cantidad_vendida: 4 }
  ] });
  const b = item(2, 'Av. 25 de Mayo', { topProductos: [
    { categoria_nombre: 'Pizzas', producto_nombre: 'Napolitana', cantidad_vendida: 9 },
    { categoria_nombre: 'Bebidas', producto_nombre: 'Gaseosa', cantidad_vendida: 2 }
  ] });
  const c = armarConsolidado([a, b]);
  assert.deepEqual(c.topProductos.map(p => [p.producto_nombre, p.cantidad_vendida]), [['Muzzarella', 10], ['Napolitana', 13], ['Gaseosa', 2]].sort((x, y) => y[1] - x[1]));
});

test('consolidado: sin sucursales devuelve ceros', () => {
  const c = armarConsolidado([]);
  assert.deepEqual(c.porSucursal, []);
  assert.equal(c.total.ventas, 0);
  assert.equal(c.total.pedidos, 0);
  assert.equal(c.total.estado.resultadoNeto, 0);
  assert.deepEqual(c.topProductos, []);
});
