const test = require('node:test');
const assert = require('node:assert/strict');
const { armarComanda, instruccionDeCobro } = require('../src/services/comanda.service.js');

function pedido(extra = {}) {
  return {
    id: 7,
    creado_en: '2026-09-20T23:30:00Z',
    cliente: 'Ana',
    canal: 'WhatsApp',
    tipo_entrega: 'envio',
    direccion_entrega: 'Calle 123',
    medio_pago: 'efectivo',
    productos: [{ nombre_producto: 'Muzzarella', cantidad: 2, precio_unitario: '5000', tipo_masa: 'molde' }],
    ...extra
  };
}

test('envío en efectivo: cobrar el total', () => {
  const cobro = instruccionDeCobro(pedido(), 10000);
  assert.equal(cobro.destacado, true);
  assert.match(cobro.texto, /^COBRAR: \$/);
});

test('envío con pago mixto: cobrar SOLO la parte en efectivo (antes decía "YA PAGADO")', () => {
  const cobro = instruccionDeCobro(pedido({ medio_pago: 'mixto', monto_efectivo: 4000, monto_transferencia: 6000 }), 10000);
  assert.equal(cobro.destacado, true);
  assert.match(cobro.texto, /^COBRAR EFECTIVO: \$/);
  assert.match(cobro.texto, /4\.000/);
});

test('envío mixto sin efectivo o por transferencia: ya pagado', () => {
  assert.equal(instruccionDeCobro(pedido({ medio_pago: 'mixto', monto_efectivo: 0, monto_transferencia: 10000 }), 10000).texto, 'YA PAGADO - NO COBRAR');
  assert.equal(instruccionDeCobro(pedido({ medio_pago: 'transferencia' }), 10000).texto, 'YA PAGADO - NO COBRAR');
});

test('retiro en el local: no hay instrucción de cobro', () => {
  assert.equal(instruccionDeCobro(pedido({ tipo_entrega: 'retiro' }), 10000), null);
});

test('armarComanda incluye producto, masa, total y la instrucción de cobro', () => {
  const texto = armarComanda(pedido({ medio_pago: 'mixto', monto_efectivo: 4000, monto_transferencia: 6000 }));
  assert.match(texto, /Pedido #7/);
  assert.match(texto, /2x Muzzarella - Al molde/);
  assert.match(texto, /TOTAL: \$10\.000/);
  assert.match(texto, />>> COBRAR EFECTIVO: \$4\.000 <<</);
});
