const test = require('node:test');
const assert = require('node:assert');
const L = require('../public/pedido-logica.js');

const catalogo = {
  1: { id: 1, nombre: 'Muzzarella', precio: 8500, requiere_masa: true },
  2: { id: 2, nombre: 'Napolitana', precio: 9500, requiere_masa: true },
  3: { id: 3, nombre: 'Coca 1.5L', precio: 3000, requiere_masa: false }
};

test('precio: producto simple y mitad y mitad (mitad + mitad + recargo)', () => {
  assert.strictEqual(L.precioUnitario(catalogo[1]), 8500);
  assert.strictEqual(L.precioUnitario(catalogo[1], catalogo[2]), 8500 / 2 + 9500 / 2 + 1000);
});

test('carrito: dos líneas iguales se suman, distinta masa o aclaración son líneas aparte', () => {
  let items = [];
  items = L.agregarItem(items, { producto_id: 1, cantidad: 1, tipo_masa: 'piedra' });
  items = L.agregarItem(items, { producto_id: 1, cantidad: 2, tipo_masa: 'piedra' });
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].cantidad, 3);
  items = L.agregarItem(items, { producto_id: 1, cantidad: 1, tipo_masa: 'molde' });
  items = L.agregarItem(items, { producto_id: 1, cantidad: 1, tipo_masa: 'piedra', aclaraciones: 'bien cocida' });
  assert.strictEqual(items.length, 3);
});

test('carrito: cantidad entre 1 y el máximo, masa inválida se descarta, aclaración se limpia', () => {
  const [a] = L.agregarItem([], { producto_id: '3', cantidad: -4, tipo_masa: 'raro', aclaraciones: '   sin   hielo  ' });
  assert.strictEqual(a.producto_id, 3);
  assert.strictEqual(a.cantidad, 1);
  assert.strictEqual(a.tipo_masa, undefined);
  assert.strictEqual(a.aclaraciones, 'sin hielo');
  const [b] = L.agregarItem([], { producto_id: 3, cantidad: 999 });
  assert.strictEqual(b.cantidad, L.CANTIDAD_MAXIMA);
});

test('carrito: restar hasta cero quita la línea', () => {
  let items = L.agregarItem([], { producto_id: 3, cantidad: 2 });
  const clave = L.claveItem(items[0]);
  items = L.cambiarCantidad(items, clave, -1);
  assert.strictEqual(items[0].cantidad, 1);
  items = L.cambiarCantidad(items, clave, -1);
  assert.deepStrictEqual(items, []);
});

test('total y cantidad total', () => {
  let items = [];
  items = L.agregarItem(items, { producto_id: 1, cantidad: 2, tipo_masa: 'piedra' });
  items = L.agregarItem(items, { producto_id: 3, cantidad: 1 });
  assert.strictEqual(L.totalPedido(items, catalogo), 8500 * 2 + 3000);
  assert.strictEqual(L.cantidadTotal(items), 3);
  assert.strictEqual(L.cantidadDeProducto(items, 1), 2);
});

test('reconciliar: saca lo que ya no está en el menú y avisa cuál', () => {
  const items = [
    { producto_id: 1, cantidad: 1 },
    { producto_id: 99, cantidad: 1 },
    { producto_id: 1, producto_id_2: 77, cantidad: 1, tipo_masa: 'molde' }
  ];
  const r = L.reconciliar(items, catalogo);
  assert.deepStrictEqual(r.items, [{ producto_id: 1, cantidad: 1 }]);
  assert.strictEqual(r.quitados.length, 2);
});

test('el precio de una línea sale del menú actual, no de lo guardado', () => {
  const items = [{ producto_id: 1, cantidad: 2 }];
  const d1 = L.describirItem(items[0], catalogo);
  const catalogoNuevo = { ...catalogo, 1: { ...catalogo[1], precio: 9000 } };
  assert.strictEqual(d1.subtotal, 17000);
  assert.strictEqual(L.describirItem(items[0], catalogoNuevo).subtotal, 18000);
});

test('teléfono: solo dígitos y con largo de número con código de país', () => {
  assert.strictEqual(L.limpiarTelefono('+54 9 11 6583-8528'), '5491165838528');
  assert.strictEqual(L.limpiarTelefono('1165838528'), null);
  assert.strictEqual(L.limpiarTelefono(''), null);
  assert.strictEqual(L.limpiarTelefono(undefined), null);
});

test('mensaje de WhatsApp: formato igual al de la pantalla de Pedidos, con retiro', () => {
  const items = [
    { producto_id: 1, cantidad: 2, tipo_masa: 'piedra', aclaraciones: 'bien cocida' },
    { producto_id: 1, producto_id_2: 2, cantidad: 1, tipo_masa: 'molde' },
    { producto_id: 3, cantidad: 1 }
  ];
  const texto = L.armarMensaje({
    local: 'Donchichopizza Av. 25 de Mayo', items, catalogoPorId: catalogo,
    entrega: 'retiro', pago: 'efectivo', nombre: 'Juan', aclaraciones: null
  });
  assert.ok(texto.startsWith('Hola! Quiero hacer un pedido en Donchichopizza Av. 25 de Mayo.'));
  assert.ok(texto.includes('2 x Muzzarella - A la piedra (bien cocida) - $17.000'));
  assert.ok(texto.includes('1 x Mitad Muzzarella / Mitad Napolitana - Al molde - $10.000'));
  assert.ok(texto.includes('1 x Coca 1.5L - $3.000'));
  assert.ok(texto.includes('Total: $30.000\n'));
  assert.ok(texto.includes('Entrega: retiro en el local'));
  assert.ok(texto.includes('Pago: efectivo'));
  assert.ok(texto.includes('A nombre de: Juan'));
  assert.ok(!texto.includes('Aclaraciones:'));
});

test('mensaje de WhatsApp: con envío aclara que el total no incluye el envío', () => {
  const texto = L.armarMensaje({
    local: 'Local', items: [{ producto_id: 3, cantidad: 1 }], catalogoPorId: catalogo,
    entrega: 'envio', direccion: 'Av. Siempre Viva 742', pago: 'transferencia', nombre: 'Ana', aclaraciones: 'tocar timbre 2'
  });
  assert.ok(texto.includes('Total: $3.000 (sin el envío)'));
  assert.ok(texto.includes('Entrega: envío a Av. Siempre Viva 742'));
  assert.ok(texto.includes('Pago: transferencia'));
  assert.ok(texto.includes('Aclaraciones: tocar timbre 2'));
});

test('link de WhatsApp: codifica el texto y rechaza números inválidos', () => {
  const link = L.linkWhatsapp('5491165838528', 'Hola! 2 x Pizza\nTotal: $5.000 & más');
  assert.strictEqual(link.startsWith('https://wa.me/5491165838528?text='), true);
  assert.ok(!link.includes(' ') && !link.includes('\n'));
  assert.strictEqual(decodeURIComponent(link.split('?text=')[1]), 'Hola! 2 x Pizza\nTotal: $5.000 & más');
  assert.strictEqual(L.linkWhatsapp('123', 'x'), null);
  assert.strictEqual(L.linkWhatsapp(null, 'x'), null);
});
