const test = require('node:test');
const assert = require('node:assert/strict');
const {
  esCuitValido, normalizarCuit, esFechaISO, esEnteroPositivo, esNumero, esEmail, esUrlHttp,
  redondear2, escaparHtml, textoOpcional
} = require('../src/utils/validaciones.js');

test('esCuitValido acepta un CUIT real y rechaza dígito verificador incorrecto', () => {
  assert.equal(esCuitValido('20386202126'), true);
  assert.equal(esCuitValido('20386202127'), false);
  assert.equal(esCuitValido('2038620212'), false);
  assert.equal(esCuitValido('abcdefghijk'), false);
  assert.equal(esCuitValido(20386202126), false); // se espera texto ya normalizado
});

test('normalizarCuit deja solo dígitos y devuelve null si viene vacío', () => {
  assert.equal(normalizarCuit('20-38620212-6'), '20386202126');
  assert.equal(normalizarCuit(' 20 38620212 6 '), '20386202126');
  assert.equal(normalizarCuit(''), null);
  assert.equal(normalizarCuit(null), null);
  assert.equal(normalizarCuit(undefined), null);
});

test('esFechaISO valida formato y fechas reales', () => {
  assert.equal(esFechaISO('2026-09-20'), true);
  assert.equal(esFechaISO('2026-02-30'), false);
  assert.equal(esFechaISO('20-09-2026'), false);
  assert.equal(esFechaISO(''), false);
  assert.equal(esFechaISO(undefined), false);
});

test('esEnteroPositivo rechaza cero, negativos, decimales y basura', () => {
  assert.equal(esEnteroPositivo(3), true);
  assert.equal(esEnteroPositivo('3'), true);
  assert.equal(esEnteroPositivo(0), false);
  assert.equal(esEnteroPositivo(-2), false);
  assert.equal(esEnteroPositivo(1.5), false);
  assert.equal(esEnteroPositivo('abc'), false);
  assert.equal(esEnteroPositivo(null), false);
  assert.equal(esEnteroPositivo(true), false);
});

test('esNumero no acepta vacío, null ni booleanos', () => {
  assert.equal(esNumero('12.5'), true);
  assert.equal(esNumero(0), true);
  assert.equal(esNumero(''), false);
  assert.equal(esNumero(null), false);
  assert.equal(esNumero(NaN), false);
  assert.equal(esNumero(false), false);
});

test('esEmail y esUrlHttp', () => {
  assert.equal(esEmail('a@b.com'), true);
  assert.equal(esEmail('a@b'), false);
  assert.equal(esUrlHttp('https://ejemplo.com/factura.pdf'), true);
  assert.equal(esUrlHttp('javascript:alert(1)'), false);
  assert.equal(esUrlHttp('no es url'), false);
});

test('redondear2 evita errores de punto flotante', () => {
  assert.equal(redondear2(0.1 + 0.2), 0.3);
  assert.equal(redondear2(1234.5678), 1234.57);
});

test('escaparHtml neutraliza etiquetas y comillas', () => {
  assert.equal(escaparHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escaparHtml(null), '');
});

test('textoOpcional recorta, devuelve null si está vacío y falla si es muy largo', () => {
  assert.equal(textoOpcional('  hola  '), 'hola');
  assert.equal(textoOpcional('   '), null);
  assert.equal(textoOpcional(undefined), null);
  assert.throws(() => textoOpcional('x'.repeat(11), 10), /demasiado largo/);
});
