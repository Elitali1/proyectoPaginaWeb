const test = require('node:test');
const assert = require('node:assert');
const { ErrorNegocio } = require('../src/utils/errores.js');
const { validarDatosCategoria, leerIdCategoria } = require('../src/utils/categorias.js');

test('categoría: datos válidos se limpian y requiere_masa vale false por defecto', () => {
  assert.deepStrictEqual(validarDatosCategoria({ nombre: '  Mini   pizzas ' }), { nombre: 'Mini pizzas', requiere_masa: false });
  assert.deepStrictEqual(validarDatosCategoria({ nombre: 'Pizzas', requiere_masa: true }), { nombre: 'Pizzas', requiere_masa: true });
});

test('categoría: nombre vacío, ausente o demasiado largo se rechaza', () => {
  assert.throws(() => validarDatosCategoria({ nombre: '   ' }), ErrorNegocio);
  assert.throws(() => validarDatosCategoria({}), ErrorNegocio);
  assert.throws(() => validarDatosCategoria(undefined), ErrorNegocio);
  assert.throws(() => validarDatosCategoria({ nombre: 'x'.repeat(101) }), ErrorNegocio);
});

test('categoría: requiere_masa que no es booleano se rechaza', () => {
  assert.throws(() => validarDatosCategoria({ nombre: 'Canastitas', requiere_masa: 'si' }), ErrorNegocio);
  assert.throws(() => validarDatosCategoria({ nombre: 'Canastitas', requiere_masa: 1 }), ErrorNegocio);
});

test('categoría: el id de la URL debe ser un entero positivo', () => {
  assert.strictEqual(leerIdCategoria('4'), 4);
  assert.throws(() => leerIdCategoria('abc'), ErrorNegocio);
  assert.throws(() => leerIdCategoria('0'), ErrorNegocio);
  assert.throws(() => leerIdCategoria('-2'), ErrorNegocio);
  assert.throws(() => leerIdCategoria('1.5'), ErrorNegocio);
});
