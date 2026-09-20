const test = require('node:test');
const assert = require('node:assert/strict');
const fechas = require('../src/utils/fechas.js');

// 22:30 del 20/09 en Argentina (UTC-3) = 01:30 del 21/09 en UTC
const NOCHE_ARGENTINA = '2026-09-21T01:30:00Z';

test('fechaArgentina usa la hora de Argentina', () => {
  assert.equal(fechas.fechaArgentina(NOCHE_ARGENTINA), '2026-09-20');
  assert.equal(fechas.fechaUtc(NOCHE_ARGENTINA), '2026-09-21');
});

test('sin ARCA_FECHA_ART_DESDE el comportamiento es el histórico (fecha UTC)', () => {
  delete process.env.ARCA_FECHA_ART_DESDE;
  assert.equal(fechas.fechaDeComprobante(NOCHE_ARGENTINA), '2026-09-21');
});

test('con ARCA_FECHA_ART_DESDE, solo los comprobantes posteriores usan la fecha de Argentina', () => {
  process.env.ARCA_FECHA_ART_DESDE = '2026-09-21T00:00:00Z';
  try {
    assert.equal(fechas.fechaDeComprobante(NOCHE_ARGENTINA), '2026-09-20');
    // un comprobante viejo (anterior al corte) conserva la fecha con la que se emitió en ARCA
    assert.equal(fechas.fechaDeComprobante('2026-09-20T23:00:00Z'), '2026-09-20');
    assert.equal(fechas.fechaDeComprobante('2026-09-20T01:30:00Z'), '2026-09-20');
  } finally {
    delete process.env.ARCA_FECHA_ART_DESDE;
  }
});

test('una variable ARCA_FECHA_ART_DESDE inválida se ignora', () => {
  process.env.ARCA_FECHA_ART_DESDE = 'no-es-una-fecha';
  try {
    assert.equal(fechas.fechaDeComprobante(NOCHE_ARGENTINA), '2026-09-21');
  } finally {
    delete process.env.ARCA_FECHA_ART_DESDE;
  }
});
