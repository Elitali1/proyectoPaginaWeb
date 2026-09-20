const test = require('node:test');
const assert = require('node:assert/strict');
const pedidosService = require('../src/services/pedidos.service.js');
const { ErrorNegocio } = require('../src/utils/errores.js');

function pedidoBase(extra = {}) {
  return {
    cliente: 'Juan',
    canal: 'WhatsApp',
    medio_pago: 'efectivo',
    tipo_entrega: 'retiro',
    productos: [{ producto_id: 1, cantidad: 2 }],
    ...extra
  };
}

test('normalizarPedido acepta un pedido válido y calcula requiere_factura', () => {
  const p = pedidosService.normalizarPedido(pedidoBase());
  assert.equal(p.requiere_factura, false);
  assert.equal(p.monto_efectivo, null);
  assert.deepEqual(p.productos[0], { producto_id: 1, producto_id_2: null, cantidad: 2, tipo_masa: null, aclaraciones: null });

  assert.equal(pedidosService.normalizarPedido(pedidoBase({ medio_pago: 'transferencia' })).requiere_factura, true);
});

test('normalizarPedido rechaza cantidades negativas, cero o decimales (evitaba sumar stock)', () => {
  for (const cantidad of [-5, 0, 1.5, 'abc', 1000]) {
    assert.throws(
      () => pedidosService.normalizarPedido(pedidoBase({ productos: [{ producto_id: 1, cantidad }] })),
      ErrorNegocio,
      `cantidad ${cantidad} debería rechazarse`
    );
  }
});

test('normalizarPedido rechaza pedido sin productos, medio de pago inválido o sin cliente', () => {
  assert.throws(() => pedidosService.normalizarPedido(pedidoBase({ productos: [] })), /al menos un producto/);
  assert.throws(() => pedidosService.normalizarPedido(pedidoBase({ productos: undefined })), ErrorNegocio);
  assert.throws(() => pedidosService.normalizarPedido(pedidoBase({ medio_pago: 'bitcoin' })), /Medio de pago/);
  assert.throws(() => pedidosService.normalizarPedido(pedidoBase({ cliente: '  ' })), /cliente/);
  assert.throws(() => pedidosService.normalizarPedido(undefined), ErrorNegocio);
});

test('normalizarPedido exige los montos en un pago mixto y marca factura si hay transferencia', () => {
  assert.throws(() => pedidosService.normalizarPedido(pedidoBase({ medio_pago: 'mixto' })), /montos/);

  const mixto = pedidosService.normalizarPedido(pedidoBase({ medio_pago: 'mixto', monto_efectivo: 1000, monto_transferencia: 500 }));
  assert.equal(mixto.requiere_factura, true);
  assert.equal(mixto.monto_efectivo, 1000);

  const soloEfectivo = pedidosService.normalizarPedido(pedidoBase({ medio_pago: 'mixto', monto_efectivo: 1500, monto_transferencia: 0 }));
  assert.equal(soloEfectivo.requiere_factura, false);
});

test('normalizarPedido normaliza y valida el CUIT del receptor', () => {
  const conGuiones = pedidosService.normalizarPedido(pedidoBase({ cuit_receptor: '20-38620212-6' }));
  assert.equal(conGuiones.cuit_receptor, '20386202126');
  assert.throws(() => pedidosService.normalizarPedido(pedidoBase({ cuit_receptor: '20386202127' })), /CUIT/);
  assert.equal(pedidosService.normalizarPedido(pedidoBase({ cuit_receptor: '' })).cuit_receptor, null);
});

// Base falsa: responde a la consulta de productos con un catálogo en memoria.
function dbConCatalogo(productos) {
  return { query: async () => ({ rows: productos }) };
}

test('resolverItems calcula el precio en el servidor (simple y mitad y mitad con recargo)', async () => {
  const db = dbConCatalogo([
    { id: 1, precio: '10000', disponible: true },
    { id: 2, precio: '8000', disponible: true }
  ]);

  const items = await pedidosService.resolverItems(db, [
    { producto_id: 1, producto_id_2: null, cantidad: 2 },
    { producto_id: 1, producto_id_2: 2, cantidad: 1 }
  ]);

  assert.equal(items[0].precio_unitario, 10000);
  assert.equal(items[1].precio_unitario, 5000 + 4000 + 1000);
  assert.equal(pedidosService.calcularTotal(items), 20000 + 10000);
});

test('resolverItems rechaza productos inexistentes o no disponibles', async () => {
  const db = dbConCatalogo([
    { id: 1, precio: '10000', disponible: true },
    { id: 3, precio: '500', disponible: false }
  ]);

  await assert.rejects(() => pedidosService.resolverItems(db, [{ producto_id: 99, producto_id_2: null, cantidad: 1 }]), /no existe/);
  await assert.rejects(() => pedidosService.resolverItems(db, [{ producto_id: 3, producto_id_2: null, cantidad: 1 }]), /ya no está disponible/);
  await assert.rejects(() => pedidosService.resolverItems(db, [{ producto_id: 1, producto_id_2: 3, cantidad: 1 }]), /ya no está disponible/);
});

test('validarPago: en un pago mixto efectivo + transferencia debe ser igual al total', () => {
  const ok = { medio_pago: 'mixto', monto_efectivo: 6000, monto_transferencia: 4000 };
  assert.doesNotThrow(() => pedidosService.validarPago(ok, 10000));
  assert.throws(() => pedidosService.validarPago({ ...ok, monto_transferencia: 3000 }, 10000), /no coincide/);
  assert.throws(() => pedidosService.validarPago({ medio_pago: 'mixto', monto_efectivo: 0, monto_transferencia: 0 }, 10000), /no coincide/);
  // otros medios de pago no se validan
  assert.doesNotThrow(() => pedidosService.validarPago({ medio_pago: 'efectivo' }, 10000));
});
