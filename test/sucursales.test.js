const test = require('node:test');
const assert = require('node:assert');
const { ErrorNegocio } = require('../src/utils/errores.js');
const {
  validarDatosSucursal,
  validarOpcionesDeCopia,
  validarSucursalesDeProducto,
  validarWhatsapp,
  leerSucursalDeConsulta
} = require('../src/utils/sucursales.js');

test('sucursal: datos válidos se limpian (espacios, vacíos a null)', () => {
  const datos = validarDatosSucursal({ nombre: '  Donchichopizza Av. 25 de Mayo  ', direccion: ' Av. 25 de Mayo 1645 ', pto_vta: '3', activa: true });
  assert.deepStrictEqual(datos, { nombre: 'Donchichopizza Av. 25 de Mayo', direccion: 'Av. 25 de Mayo 1645', pto_vta: 3, activa: true, cuenta_transferencia: undefined, whatsapp: undefined });

  const sinOpcionales = validarDatosSucursal({ nombre: 'Local', direccion: '', pto_vta: '' });
  assert.strictEqual(sinOpcionales.direccion, null);
  assert.strictEqual(sinOpcionales.pto_vta, null);
  assert.strictEqual(sinOpcionales.activa, undefined);
});

test('sucursal: el nombre es obligatorio y tiene tope', () => {
  for (const body of [undefined, {}, { nombre: '' }, { nombre: '   ' }, { nombre: 5 }, { nombre: 'x'.repeat(101) }]) {
    assert.throws(() => validarDatosSucursal(body), ErrorNegocio);
  }
});

test('sucursal: punto de venta inválido se rechaza', () => {
  for (const pto_vta of ['abc', 0, -1, 1.5, '2.5', 100000]) {
    assert.throws(() => validarDatosSucursal({ nombre: 'Local', pto_vta }), ErrorNegocio, `pto_vta ${pto_vta}`);
  }
});

test('sucursal: dirección demasiado larga o activa que no es booleano se rechazan', () => {
  assert.throws(() => validarDatosSucursal({ nombre: 'Local', direccion: 'x'.repeat(201) }), ErrorNegocio);
  assert.throws(() => validarDatosSucursal({ nombre: 'Local', activa: 'si' }), ErrorNegocio);
});

test('copia: por defecto no copia y el factor es 1', () => {
  assert.deepStrictEqual(validarOpcionesDeCopia({}), { copiarDe: null, factor: 1 });
  assert.deepStrictEqual(validarOpcionesDeCopia({ copiar_de: '', factor: '' }), { copiarDe: null, factor: 1 });
  assert.deepStrictEqual(validarOpcionesDeCopia({ copiar_de: '1', factor: '1.1' }), { copiarDe: 1, factor: 1.1 });
});

test('copia: origen o factor inválidos se rechazan', () => {
  for (const body of [{ copiar_de: 'x' }, { copiar_de: 0 }, { copiar_de: 1.5 }, { factor: 0 }, { factor: -2 }, { factor: 11 }, { factor: 'abc' }]) {
    assert.throws(() => validarOpcionesDeCopia(body), ErrorNegocio, JSON.stringify(body));
  }
});

test('producto en sucursales: lista válida', () => {
  const lista = validarSucursalesDeProducto({ sucursales: [{ sucursal_id: '1', precio: '8500' }, { sucursal_id: 2, precio: 0 }] });
  assert.deepStrictEqual(lista, [{ sucursal_id: 1, precio: 8500 }, { sucursal_id: 2, precio: 0 }]);
});

test('producto en sucursales: vacía, repetida o con precio inválido se rechaza', () => {
  const malos = [
    undefined, {}, { sucursales: [] }, { sucursales: 'x' },
    { sucursales: [{ sucursal_id: 1, precio: 10 }, { sucursal_id: 1, precio: 20 }] },
    { sucursales: [{ sucursal_id: 0, precio: 10 }] },
    { sucursales: [{ sucursal_id: 'a', precio: 10 }] },
    { sucursales: [{ sucursal_id: 1 }] },
    { sucursales: [{ sucursal_id: 1, precio: '' }] },
    { sucursales: [{ sucursal_id: 1, precio: null }] },
    { sucursales: [{ sucursal_id: 1, precio: -5 }] },
    { sucursales: [{ sucursal_id: 1, precio: 'abc' }] },
    { sucursales: [null] }
  ];
  for (const body of malos) {
    assert.throws(() => validarSucursalesDeProducto(body), ErrorNegocio, JSON.stringify(body));
  }
});

test('sucursal: la cuenta de cobro es opcional, se limpia y tiene tope', () => {
  assert.strictEqual(validarDatosSucursal({ nombre: 'Local' }).cuenta_transferencia, undefined);
  assert.strictEqual(validarDatosSucursal({ nombre: 'Local', cuenta_transferencia: '  Banco Galicia  ' }).cuenta_transferencia, 'Banco Galicia');
  assert.strictEqual(validarDatosSucursal({ nombre: 'Local', cuenta_transferencia: '   ' }).cuenta_transferencia, undefined);
  assert.throws(() => validarDatosSucursal({ nombre: 'Local', cuenta_transferencia: 'x'.repeat(101) }), ErrorNegocio);
  assert.throws(() => validarDatosSucursal({ nombre: 'Local', cuenta_transferencia: 5 }), ErrorNegocio);
});

test('whatsapp: se guardan solo los dígitos, undefined conserva y vacío borra', () => {
  assert.strictEqual(validarWhatsapp(undefined), undefined);
  assert.strictEqual(validarWhatsapp(''), null);
  assert.strictEqual(validarWhatsapp(null), null);
  assert.strictEqual(validarWhatsapp('   '), null);
  assert.strictEqual(validarWhatsapp('+54 9 11 6583-8528'), '5491165838528');
  assert.strictEqual(validarWhatsapp(5491165838528), '5491165838528');
});

test('whatsapp: letras, muy corto o muy largo se rechazan', () => {
  for (const malo of ['abc', '1165838528', '54911658385281234', '54911-6583-85x8', '{}']) {
    assert.throws(() => validarWhatsapp(malo), ErrorNegocio, malo);
  }
  assert.throws(() => validarWhatsapp({}), ErrorNegocio);
});

test('datos de sucursal incluyen el whatsapp validado', () => {
  assert.strictEqual(validarDatosSucursal({ nombre: 'Local', whatsapp: '54 9 11 1234 5678' }).whatsapp, '5491112345678');
  assert.strictEqual(validarDatosSucursal({ nombre: 'Local' }).whatsapp, undefined);
  assert.throws(() => validarDatosSucursal({ nombre: 'Local', whatsapp: 'hola' }), ErrorNegocio);
});

test('sucursal de una consulta pública: vacía = por defecto, inválida se rechaza', () => {
  assert.strictEqual(leerSucursalDeConsulta(undefined), null);
  assert.strictEqual(leerSucursalDeConsulta(''), null);
  assert.strictEqual(leerSucursalDeConsulta('2'), 2);
  for (const malo of ['x', '0', '-1', '1.5', '1; DROP TABLE']) {
    assert.throws(() => leerSucursalDeConsulta(malo), ErrorNegocio, malo);
  }
});
