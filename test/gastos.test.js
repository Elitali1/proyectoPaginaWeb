const test = require('node:test');
const assert = require('node:assert');
const { ErrorNegocio } = require('../src/utils/errores.js');
const { validarGasto, validarClasificacion, validarRecurrente, clasificarGastos, esCostoDirecto, buscarCategoria } = require('../src/utils/gastos.js');

test('gasto: categoría conocida propone su tipo y se normaliza el nombre', () => {
  const g = validarGasto({ concepto: ' Alquiler octubre ', categoria: 'alquiler', monto: '500000', fecha: '2026-10-01' });
  assert.deepStrictEqual(g, { concepto: 'Alquiler octubre', categoria: 'Alquiler', tipo: 'fijo', monto: 500000, fecha: '2026-10-01' });
});

test('gasto: el tipo elegido manda sobre el de la categoría', () => {
  const g = validarGasto({ concepto: 'Luz', categoria: 'Luz', tipo: 'variable', monto: 1000, fecha: '2026-10-01' });
  assert.strictEqual(g.tipo, 'variable');
});

test('gasto: categoría desconocida o sin categoría exige elegir fijo o variable', () => {
  assert.throws(() => validarGasto({ concepto: 'Varios', monto: 100, fecha: '2026-10-01' }), ErrorNegocio);
  assert.throws(() => validarGasto({ concepto: 'Varios', categoria: 'Cosas raras', monto: 100, fecha: '2026-10-01' }), ErrorNegocio);
  const ok = validarGasto({ concepto: 'Varios', categoria: 'Cosas raras', tipo: 'variable', monto: 100, fecha: '2026-10-01' });
  assert.strictEqual(ok.categoria, 'Cosas raras');
});

test('gasto: tipo inválido, "Otros" sin tipo, monto y fecha inválidos se rechazan', () => {
  assert.throws(() => validarGasto({ concepto: 'x', tipo: 'raro', monto: 100, fecha: '2026-10-01' }), ErrorNegocio);
  assert.throws(() => validarGasto({ concepto: 'x', tipo: 'sin_clasificar', monto: 100, fecha: '2026-10-01' }), ErrorNegocio);
  assert.throws(() => validarGasto({ concepto: 'x', categoria: 'Otros', monto: 100, fecha: '2026-10-01' }), ErrorNegocio);
  assert.throws(() => validarGasto({ concepto: 'x', tipo: 'fijo', monto: 0, fecha: '2026-10-01' }), ErrorNegocio);
  assert.throws(() => validarGasto({ concepto: 'x', tipo: 'fijo', monto: -5, fecha: '2026-10-01' }), ErrorNegocio);
  assert.throws(() => validarGasto({ concepto: 'x', tipo: 'fijo', monto: 10, fecha: '01/10/2026' }), ErrorNegocio);
  assert.throws(() => validarGasto({ concepto: '', tipo: 'fijo', monto: 10, fecha: '2026-10-01' }), ErrorNegocio);
  assert.throws(() => validarGasto(undefined), ErrorNegocio);
});

test('clasificación: solo fijo o variable (no se puede volver a "sin clasificar")', () => {
  assert.deepStrictEqual(validarClasificacion({ tipo: 'fijo', categoria: 'sueldos' }), { tipo: 'fijo', categoria: 'Sueldos' });
  assert.deepStrictEqual(validarClasificacion({ tipo: 'variable' }), { tipo: 'variable', categoria: null });
  assert.throws(() => validarClasificacion({ tipo: 'sin_clasificar' }), ErrorNegocio);
  assert.throws(() => validarClasificacion({}), ErrorNegocio);
});

test('recurrente: valida igual que un gasto (sin fecha)', () => {
  const r = validarRecurrente({ concepto: 'Internet', categoria: 'Internet', monto: 35000 });
  assert.deepStrictEqual(r, { concepto: 'Internet', categoria: 'Internet', tipo: 'fijo', monto: 35000 });
  assert.throws(() => validarRecurrente({ concepto: 'Internet', monto: 0 }), ErrorNegocio);
});

test('mercadería es costo directo, sin importar tildes ni mayúsculas', () => {
  assert.strictEqual(esCostoDirecto('Mercadería'), true);
  assert.strictEqual(esCostoDirecto(' mercaderia '), true);
  assert.strictEqual(esCostoDirecto('Sueldos'), false);
  assert.strictEqual(esCostoDirecto(null), false);
  assert.strictEqual(buscarCategoria(''), undefined);
});

test('clasificar gastos del período: fijos, variables, directos y sin clasificar', () => {
  const t = clasificarGastos([
    { monto: '100', tipo: 'fijo', categoria: 'Sueldos' },
    { monto: '50', tipo: 'fijo', categoria: null },
    { monto: '30', tipo: 'variable', categoria: 'Delivery' },
    { monto: '200', tipo: 'variable', categoria: 'mercaderia' },
    { monto: '7', tipo: 'sin_clasificar', categoria: 'Mercadería' }
  ]);
  assert.deepStrictEqual(t, { fijos: 150, variables: 30, directos: 200, sinClasificar: 7 });
});
