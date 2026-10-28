const test = require('node:test');
const assert = require('node:assert');
const { esProduccionArca, describirModoArca } = require('../src/utils/ambiente.js');

test('esProduccionArca: solo "true" exacto activa la producción', () => {
  assert.strictEqual(esProduccionArca('true'), true);
});

test('esProduccionArca: cualquier otro valor es homologación (no emite comprobantes reales)', () => {
  for (const valor of [undefined, '', 'false', 'False', 'TRUE', 'True', 'falso', ' true', 'true ', '1', 'si', 'ture']) {
    assert.strictEqual(esProduccionArca(valor), false, `"${valor}" no debería activar la producción`);
  }
});

test('describirModoArca: indica el modo y avisa si el valor es raro', () => {
  assert.match(describirModoArca('true'), /PRODUCCIÓN/);
  assert.match(describirModoArca('false'), /HOMOLOGACIÓN/);
  assert.match(describirModoArca(undefined), /HOMOLOGACIÓN/);
  assert.doesNotMatch(describirModoArca('false'), /ATENCIÓN/);
  assert.doesNotMatch(describirModoArca(undefined), /ATENCIÓN/);
  assert.match(describirModoArca('False'), /ATENCIÓN/);
  assert.match(describirModoArca('ture'), /HOMOLOGACIÓN/);
});