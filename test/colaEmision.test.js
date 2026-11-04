const test = require('node:test');
const assert = require('node:assert/strict');
const { claveDeCola, crearColasPorClave } = require('../src/utils/colaEmision.js');

// Una "emisión" de mentira que se puede terminar cuando el test quiere,
// y que anota cuándo empezó y terminó para ver si hubo solapamiento.
function emisionControlada(nombre, bitacora) {
  let terminar;
  const espera = new Promise(resolve => { terminar = resolve; });
  const funcion = async () => {
    bitacora.push(`inicio ${nombre}`);
    await espera;
    bitacora.push(`fin ${nombre}`);
    return nombre;
  };
  return { funcion, terminar };
}

// Deja correr las promesas pendientes (microtareas) antes de mirar la bitácora.
const dejarCorrer = () => new Promise(resolve => setImmediate(resolve));

test('clave: depende del punto de venta y del tipo de comprobante', () => {
  assert.equal(claveDeCola(1, 11), '1-11');
  assert.notEqual(claveDeCola(1, 11), claveDeCola(2, 11)); // otro punto de venta
  assert.notEqual(claveDeCola(1, 11), claveDeCola(1, 13)); // factura y nota de crédito numeran aparte
  assert.equal(claveDeCola(2, 11), claveDeCola(2, 11));
});

test('misma clave: las emisiones salen de a una y en el orden en que se pidieron', async () => {
  const { encolar } = crearColasPorClave();
  const bitacora = [];
  const a = emisionControlada('A', bitacora);
  const b = emisionControlada('B', bitacora);
  const c = emisionControlada('C', bitacora);

  const pA = encolar('2-11', a.funcion);
  const pB = encolar('2-11', b.funcion);
  const pC = encolar('2-11', c.funcion);

  await dejarCorrer();
  assert.deepEqual(bitacora, ['inicio A']); // B y C esperan: nunca consultan el último número a la vez

  a.terminar();
  await dejarCorrer();
  assert.deepEqual(bitacora, ['inicio A', 'fin A', 'inicio B']);

  b.terminar();
  await dejarCorrer();
  c.terminar();
  assert.deepEqual(await Promise.all([pA, pB, pC]), ['A', 'B', 'C']);
  assert.deepEqual(bitacora, ['inicio A', 'fin A', 'inicio B', 'fin B', 'inicio C', 'fin C']);
});

test('claves distintas (otro punto de venta): no se esperan entre sí', async () => {
  const { encolar } = crearColasPorClave();
  const bitacora = [];
  const local1 = emisionControlada('local1', bitacora);
  const local2 = emisionControlada('local2', bitacora);

  const p1 = encolar(claveDeCola(1, 11), local1.funcion);
  const p2 = encolar(claveDeCola(2, 11), local2.funcion);

  await dejarCorrer();
  // El local 2 arrancó sin esperar a que terminara el local 1
  assert.deepEqual(bitacora, ['inicio local1', 'inicio local2']);

  local2.terminar();
  local1.terminar();
  await Promise.all([p1, p2]);
});

test('factura y nota de crédito del mismo punto de venta tampoco se esperan (numeran aparte)', async () => {
  const { encolar } = crearColasPorClave();
  const bitacora = [];
  const factura = emisionControlada('factura', bitacora);
  const nota = emisionControlada('nota', bitacora);

  const pF = encolar(claveDeCola(2, 11), factura.funcion);
  const pN = encolar(claveDeCola(2, 13), nota.funcion);

  await dejarCorrer();
  assert.deepEqual(bitacora, ['inicio factura', 'inicio nota']);
  factura.terminar();
  nota.terminar();
  await Promise.all([pF, pN]);
});

test('si una emisión falla, quien la pidió recibe el error y las siguientes de esa clave igual salen', async () => {
  const { encolar } = crearColasPorClave();
  const bitacora = [];
  const fallida = encolar('2-11', async () => { throw new Error('ARCA rechazó el comprobante'); });
  const siguiente = encolar('2-11', async () => { bitacora.push('salió la siguiente'); return 'ok'; });

  await assert.rejects(fallida, /ARCA rechazó/);
  assert.equal(await siguiente, 'ok');
  assert.deepEqual(bitacora, ['salió la siguiente']);
});

test('un error síncrono de la función tampoco traba la cola', async () => {
  const { encolar } = crearColasPorClave();
  const fallida = encolar('1-11', () => { throw new Error('se rompió al arrancar'); });
  const siguiente = encolar('1-11', async () => 'ok');
  await assert.rejects(fallida, /se rompió al arrancar/);
  assert.equal(await siguiente, 'ok');
});

test('un error en una clave no afecta a las otras', async () => {
  const { encolar } = crearColasPorClave();
  const fallida = encolar('1-11', async () => { throw new Error('falló el local 1'); });
  const otra = encolar('2-11', async () => 'salió el local 2');
  await assert.rejects(fallida, /falló el local 1/);
  assert.equal(await otra, 'salió el local 2');
});

test('devuelve el resultado de cada emisión a quien la pidió', async () => {
  const { encolar } = crearColasPorClave();
  const [a, b] = await Promise.all([
    encolar('1-11', async () => ({ numeroComprobante: 101 })),
    encolar('1-11', async () => ({ numeroComprobante: 102 }))
  ]);
  assert.deepEqual(a, { numeroComprobante: 101 });
  assert.deepEqual(b, { numeroComprobante: 102 });
});

test('las colas se limpian cuando terminan (no quedan claves acumuladas)', async () => {
  const colas = crearColasPorClave();
  const p1 = colas.encolar('1-11', async () => 1);
  const p2 = colas.encolar('2-11', async () => 2);
  const p3 = colas.encolar('1-11', async () => 3);
  assert.equal(colas.cantidadDeColas(), 2);
  await Promise.all([p1, p2, p3]);
  await dejarCorrer();
  assert.equal(colas.cantidadDeColas(), 0);
});

test('simula el caso real: 3 facturas del local 1 y 3 del local 2, cada local numera en orden', async () => {
  const { encolar } = crearColasPorClave();
  const ultimo = { 1: 100, 2: 500 }; // último número autorizado por punto de venta
  const emitidos = [];

  // Misma lógica que emitirFactura: consultar el último, esperar un poco (ARCA) y recién ahí "autorizar".
  const emitir = ptoVta => encolar(claveDeCola(ptoVta, 11), async () => {
    const numero = ultimo[ptoVta] + 1;
    await new Promise(resolve => setTimeout(resolve, 5));
    ultimo[ptoVta] = numero;
    emitidos.push(`${ptoVta}:${numero}`);
    return numero;
  });

  const numeros = await Promise.all([emitir(1), emitir(2), emitir(1), emitir(2), emitir(1), emitir(2)]);

  assert.deepEqual(numeros, [101, 501, 102, 502, 103, 503]); // sin repetidos ni saltos en ningún punto de venta
  assert.deepEqual(emitidos.filter(e => e.startsWith('1:')), ['1:101', '1:102', '1:103']);
  assert.deepEqual(emitidos.filter(e => e.startsWith('2:')), ['2:501', '2:502', '2:503']);
});
