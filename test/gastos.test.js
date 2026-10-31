const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CATEGORIAS, buscarCategoria, validarGasto, validarClasificacion, validarRecurrente, clasificarGastos
} = require('../src/utils/gastos.js');

const base = { concepto: 'Gasto de prueba', monto: 1000, fecha: '2026-10-15' };

test('las categorías sugeridas son las acordadas: 6 fijas y 2 variables (más "Otros")', () => {
  const fijas = CATEGORIAS.filter(c => c.tipo === 'fijo').map(c => c.nombre);
  const variables = CATEGORIAS.filter(c => c.tipo === 'variable').map(c => c.nombre);
  assert.deepEqual(fijas, ['Sueldos', 'Servicios', 'Alquiler', 'Monotributo', 'Seguros', 'Impuestos y permisos']);
  assert.deepEqual(variables, ['Materia prima', 'Insumos de papelería generales']);
  assert.equal(CATEGORIAS.find(c => c.nombre === 'Otros').tipo, null);
});

test('gasto: categoría conocida propone su tipo y se normaliza el nombre', () => {
  const sueldo = validarGasto({ ...base, categoria: '  sueldos ' });
  assert.equal(sueldo.categoria, 'Sueldos');
  assert.equal(sueldo.tipo, 'fijo');

  const monotributo = validarGasto({ ...base, categoria: 'MONOTRIBUTO' });
  assert.equal(monotributo.tipo, 'fijo');

  const materia = validarGasto({ ...base, categoria: 'materia prima' });
  assert.equal(materia.categoria, 'Materia prima');
  assert.equal(materia.tipo, 'variable');

  const papeleria = validarGasto({ ...base, categoria: 'insumos de papeleria generales' }); // sin tilde
  assert.equal(papeleria.categoria, 'Insumos de papelería generales');
  assert.equal(papeleria.tipo, 'variable');
});

test('gasto: los nombres viejos se reconocen y pasan a la categoría nueva', () => {
  assert.equal(validarGasto({ ...base, categoria: 'Mercadería' }).categoria, 'Materia prima');
  assert.equal(validarGasto({ ...base, categoria: 'mercaderia' }).tipo, 'variable');
  assert.equal(validarGasto({ ...base, categoria: 'Luz' }).categoria, 'Servicios');
  assert.equal(validarGasto({ ...base, categoria: 'Internet' }).tipo, 'fijo');
  assert.equal(validarGasto({ ...base, categoria: 'Tasas municipales' }).categoria, 'Impuestos y permisos');
  assert.equal(validarGasto({ ...base, categoria: 'Packaging y descartables' }).categoria, 'Insumos de papelería generales');
  assert.equal(buscarCategoria('Delivery'), undefined); // lo que no se acordó no se reconoce
});

test('gasto: el tipo elegido manda sobre el de la categoría', () => {
  const g = validarGasto({ ...base, categoria: 'Sueldos', tipo: 'variable' });
  assert.equal(g.tipo, 'variable');
});

test('gasto: categoría desconocida o sin categoría exige elegir fijo o variable', () => {
  assert.throws(() => validarGasto({ ...base, categoria: 'Algo raro' }), /fijo o variable/);
  assert.throws(() => validarGasto({ ...base }), /fijo o variable/);
  const g = validarGasto({ ...base, categoria: 'Algo raro', tipo: 'fijo' });
  assert.equal(g.tipo, 'fijo');
  assert.equal(g.categoria, 'Algo raro');
});

test('gasto: tipo inválido, "Otros" sin tipo, monto y fecha inválidos se rechazan', () => {
  assert.throws(() => validarGasto({ ...base, categoria: 'Sueldos', tipo: 'extra' }), /fijo o variable/);
  assert.throws(() => validarGasto({ ...base, categoria: 'Otros' }), /fijo o variable/);
  assert.throws(() => validarGasto({ ...base, categoria: 'Sueldos', monto: 0 }), /monto/i);
  assert.throws(() => validarGasto({ ...base, categoria: 'Sueldos', monto: -5 }), /monto/i);
  assert.throws(() => validarGasto({ ...base, categoria: 'Sueldos', monto: 'abc' }), /monto/i);
  assert.throws(() => validarGasto({ ...base, categoria: 'Sueldos', fecha: '15/10/2026' }), /fecha/i);
  assert.throws(() => validarGasto({ ...base, categoria: 'Sueldos', concepto: '   ' }), /concepto/i);
});

test('clasificación: solo fijo o variable', () => {
  assert.deepEqual(validarClasificacion({ tipo: 'fijo' }), { tipo: 'fijo', categoria: null });
  assert.throws(() => validarClasificacion({ tipo: '' }), /fijo o variable/);
  assert.throws(() => validarClasificacion({ tipo: 'otro' }), /fijo o variable/);
  // al reclasificar un gasto viejo, su categoría vieja pasa al nombre nuevo
  assert.deepEqual(validarClasificacion({ tipo: 'fijo', categoria: 'Luz' }), { tipo: 'fijo', categoria: 'Servicios' });
});

test('recurrente: valida igual que un gasto (sin fecha)', () => {
  const r = validarRecurrente({ concepto: 'Alquiler local', categoria: 'alquiler', monto: 500000 });
  assert.deepEqual(r, { concepto: 'Alquiler local', categoria: 'Alquiler', tipo: 'fijo', monto: 500000 });
  assert.throws(() => validarRecurrente({ concepto: 'Algo', categoria: 'Algo raro', monto: 100 }), /fijo o variable/);
});

test('clasificar gastos del período: fijos, variables y sin clasificar (la materia prima es variable)', () => {
  const total = clasificarGastos([
    { monto: '200000', tipo: 'fijo', categoria: 'Sueldos' },
    { monto: '50000', tipo: 'fijo', categoria: 'Monotributo' },
    { monto: '30000', tipo: 'variable', categoria: 'Materia prima' },
    { monto: '20000', tipo: 'variable', categoria: 'Mercadería' }, // gasto viejo: suma con los variables
    { monto: '5000', tipo: 'variable', categoria: 'Insumos de papelería generales' },
    { monto: '7000', tipo: null, categoria: 'Otros' }
  ]);
  assert.deepEqual(total, { fijos: 250000, variables: 55000, sinClasificar: 7000 });
});

test('clasificar gastos del período: sin gastos da ceros', () => {
  assert.deepEqual(clasificarGastos([]), { fijos: 0, variables: 0, sinClasificar: 0 });
});
