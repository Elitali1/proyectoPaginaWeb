const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Base de mentira: anota cada consulta que hace el repositorio y devuelve filas según el tipo de consulta.
// Así se prueba QUÉ escribe el repositorio sin necesitar una base real.
const consultas = [];

function respuesta(sql) {
  if (/^\s*UPDATE productos SET nombre/i.test(sql)) return { rows: [{ id: 7 }] };        // catálogo
  if (/FROM productos p/i.test(sql)) return { rows: [{ id: 7, nombre: 'Muzzarella', precio: '10000', disponible: true }] }; // leerProducto
  if (/SELECT 1 FROM productos WHERE id/i.test(sql)) return { rows: [{ '?column?': 1 }] };
  if (/SELECT id FROM sucursales WHERE activa/i.test(sql)) return { rows: [{ id: 1 }, { id: 2 }] };
  if (/INSERT INTO productos \(/i.test(sql)) return { rows: [{ id: 7 }] };
  if (/FROM sucursales s/i.test(sql)) return { rows: [] };
  return { rows: [] };
}

const baseFalsa = {
  query: async (sql, params) => {
    consultas.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
    return respuesta(sql);
  }
};

// Se reemplazan los módulos de conexión ANTES de cargar el repositorio.
function reemplazarModulo(rutaRelativa, exportaciones) {
  const ruta = path.join(__dirname, '..', 'src', rutaRelativa);
  require.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports: exportaciones };
}
reemplazarModulo('config/db.js', baseFalsa);
reemplazarModulo('config/transaccion.js', { conTransaccion: async (funcion) => funcion(baseFalsa) });

const repositorio = require('../src/repositories/productos.repository.js');

test.beforeEach(() => { consultas.length = 0; });

// ¿Alguna consulta escribe precio o disponible en la tabla vieja `productos`?
const escribeEnColumnasViejas = c => /UPDATE productos SET[^;]*\b(precio|disponible)\b/i.test(c.sql);

const datos = { nombre: 'Muzzarella', precio: 12000, disponible: false, imagen: 'm.jpg', categoria_id: 3 };

test('actualizar en la sucursal 1: guarda precio y disponibilidad solo en productos_sucursal', async () => {
  await repositorio.actualizar(7, datos, 1);

  assert.equal(consultas.filter(escribeEnColumnasViejas).length, 0);

  const enSucursal = consultas.find(c => /INSERT INTO productos_sucursal/i.test(c.sql));
  assert.ok(enSucursal);
  assert.deepEqual(enSucursal.params, [7, 1, 12000, false]);
});

test('actualizar en otra sucursal: tampoco toca las columnas viejas', async () => {
  await repositorio.actualizar(7, datos, 2);

  assert.equal(consultas.filter(escribeEnColumnasViejas).length, 0);
  const enSucursal = consultas.find(c => /INSERT INTO productos_sucursal/i.test(c.sql));
  assert.deepEqual(enSucursal.params, [7, 2, 12000, false]);
});

test('actualizar: el catálogo compartido (nombre, imagen, categoría) se sigue guardando en productos', async () => {
  await repositorio.actualizar(7, datos, 1);

  const catalogo = consultas.find(c => /^UPDATE productos SET nombre/i.test(c.sql));
  assert.ok(catalogo);
  assert.deepEqual(catalogo.params, ['Muzzarella', 'm.jpg', 3, 7]);
});

test('actualizar: un producto que no existe devuelve undefined y no guarda nada en productos_sucursal', async () => {
  const original = baseFalsa.query;
  baseFalsa.query = async (sql, params) => {
    consultas.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
    if (/^\s*UPDATE productos SET nombre/i.test(sql)) return { rows: [] };
    return respuesta(sql);
  };
  try {
    const resultado = await repositorio.actualizar(999, datos, 1);
    assert.equal(resultado, undefined);
    assert.equal(consultas.filter(c => /INSERT INTO productos_sucursal/i.test(c.sql)).length, 0);
  } finally {
    baseFalsa.query = original;
  }
});

test('guardarSucursalesDeProducto: guarda el precio de cada sucursal elegida solo en productos_sucursal', async () => {
  await repositorio.guardarSucursalesDeProducto(7, [
    { sucursal_id: 1, precio: 11000 },
    { sucursal_id: 2, precio: 13000 }
  ]);

  assert.equal(consultas.filter(escribeEnColumnasViejas).length, 0);

  const guardados = consultas.filter(c => /INSERT INTO productos_sucursal/i.test(c.sql));
  assert.equal(guardados.length, 2);
  assert.deepEqual(guardados.map(c => c.params), [[7, 1, 11000], [7, 2, 13000]]);
  // El producto nuevo en esa sucursal queda disponible; si ya existía, el ON CONFLICT no pisa la disponibilidad.
  assert.ok(guardados.every(c => /VALUES \(\$1, \$2, \$3, true\)/.test(c.sql)));
  assert.ok(guardados.every(c => !/DO UPDATE SET[^;]*disponible/i.test(c.sql)));
});

test('guardarSucursalesDeProducto: las sucursales activas que no se eligen dejan de ofrecer el producto', async () => {
  await repositorio.guardarSucursalesDeProducto(7, [{ sucursal_id: 1, precio: 11000 }]);

  const borrados = consultas.filter(c => /DELETE FROM productos_sucursal/i.test(c.sql));
  assert.equal(borrados.length, 1);
  assert.deepEqual(borrados[0].params, [7, 2]);
});

test('guardarSucursalesDeProducto: una sucursal inexistente o inactiva se rechaza sin guardar nada', async () => {
  await assert.rejects(
    () => repositorio.guardarSucursalesDeProducto(7, [{ sucursal_id: 99, precio: 5000 }]),
    /no existe o está inactiva/
  );
  assert.equal(consultas.filter(c => /INSERT INTO productos_sucursal/i.test(c.sql)).length, 0);
});

test('crear: el catálogo no recibe precio ni disponibilidad; eso va solo en productos_sucursal', async () => {
  await repositorio.crear({ nombre: 'Fugazzeta', precio: 15000, imagen: null, categoria_id: 3 }, 2);

  const catalogo = consultas.find(c => /INSERT INTO productos \(/i.test(c.sql));
  assert.ok(catalogo);
  assert.deepEqual(catalogo.params, ['Fugazzeta', null, 3]);
  assert.ok(!/precio|disponible/i.test(catalogo.sql));

  const enSucursal = consultas.find(c => /INSERT INTO productos_sucursal/i.test(c.sql));
  assert.deepEqual(enSucursal.params, [7, 2, 15000, true]);
});
