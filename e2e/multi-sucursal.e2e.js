// ============================================================================
// PRUEBAS AUTOMÁTICAS DE PUNTA A PUNTA: MULTI-SUCURSAL
//
// Le habla a la API de STAGING por HTTP, igual que el panel: entra, cambia de sucursal, crea
// pedidos, compras y gastos, y comprueba que cada sucursal quede separada de la otra.
//
// CÓMO SE CORRE (PowerShell, desde la raíz del proyecto):
//   $env:TEST_URL = 'https://TU-DOMINIO-DE-STAGING.up.railway.app'
//   $env:TEST_EMAIL = 'email-de-un-admin-de-staging'
//   $env:TEST_PASSWORD = 'su-contraseña'
//   $env:TEST_ES_STAGING = 'si'          # confirmación de que es staging y NO producción
//   npm run test:staging
//
// Opcional: $env:TEST_FACTURACION = '1' prueba también el pedido de factura (en staging tiene que
// fallar a propósito, porque ARCA está en modo prueba).
//
// SEGURIDAD:
//  - Se niega a correr si la dirección no es localhost o *.up.railway.app, y siempre contra el
//    dominio de producción.
//  - Solo toca datos propios, que se reconocen porque empiezan con "TEST-AUTO".
//  - Hay un límite de 300 pedidos por IP cada 15 minutos en la API: esta suite usa unos 160.
// ============================================================================
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

// ---------- Configuración y protecciones ----------
const PRODUCCION = ['donchichopizza.com.ar', 'www.donchichopizza.com.ar'];
const PREFIJO = 'TEST-AUTO';
const LIMITE_PEDIDOS_A_LA_API = 280; // la API corta a las 300 por IP cada 15 minutos

function abortar(mensaje) {
  console.error('\n⛔ ' + mensaje + '\n');
  process.exit(1);
}

const URL_BASE = (process.env.TEST_URL || '').replace(/\/+$/, '');
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!URL_BASE || !EMAIL || !PASSWORD) {
  abortar('Faltan variables: TEST_URL, TEST_EMAIL y TEST_PASSWORD (ver las instrucciones al principio de este archivo).');
}
let host;
try { host = new URL(URL_BASE).hostname; } catch (e) { abortar('TEST_URL no es una dirección válida: ' + URL_BASE); }
if (PRODUCCION.includes(host)) abortar('Esa es la dirección de PRODUCCIÓN. Estas pruebas crean datos: no se corren ahí.');
if (!(host === 'localhost' || host === '127.0.0.1' || host.endsWith('.up.railway.app'))) {
  abortar('Solo se corre contra localhost o contra un dominio *.up.railway.app (staging). Recibí: ' + host);
}
if (process.env.TEST_ES_STAGING !== 'si') {
  abortar("Confirmá que es staging con  $env:TEST_ES_STAGING = 'si'  (un paso más para no equivocarse de ambiente).");
}

// ---------- Cliente HTTP con "sesión" (guarda la cookie de login) ----------
let cantidadDePedidos = 0;

class Sesion {
  constructor(nombre) { this.nombre = nombre; this.cookie = null; this.usuario = null; }

  async pedir(metodo, ruta, cuerpo) {
    cantidadDePedidos++;
    if (cantidadDePedidos > LIMITE_PEDIDOS_A_LA_API) {
      throw new Error('Se estaba por superar el límite de pedidos de la API (300 cada 15 minutos). Esperá un rato y volvé a correr.');
    }
    const respuesta = await fetch(URL_BASE + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      redirect: 'manual'
    });
    const cookies = typeof respuesta.headers.getSetCookie === 'function' ? respuesta.headers.getSetCookie() : [];
    for (const c of cookies) {
      const m = /^auth_token=([^;]*)/.exec(c);
      if (m) this.cookie = m[1] ? `auth_token=${m[1]}` : null;
    }
    let body = null;
    try { body = await respuesta.json(); } catch (e) { /* sin cuerpo JSON */ }
    return { status: respuesta.status, body };
  }

  get(ruta) { return this.pedir('GET', ruta); }
  post(ruta, cuerpo) { return this.pedir('POST', ruta, cuerpo === undefined ? {} : cuerpo); }
  put(ruta, cuerpo) { return this.pedir('PUT', ruta, cuerpo); }
  del(ruta) { return this.pedir('DELETE', ruta); }

  async entrar(email, password) {
    const r = await this.pedir('POST', '/usuarios/login', { email, password });
    asegurar(r, 200, `login de ${this.nombre}`);
    this.usuario = r.body.usuario;
    return r.body.usuario;
  }

  // Cambia la sucursal de trabajo (solo admin): el servidor emite una sesión nueva.
  async irASucursal(id) {
    const r = await this.post('/usuarios/cambiar-sucursal', { sucursal_id: id });
    asegurar(r, 200, `cambiar a la sucursal ${id}`);
    this.usuario = r.body.usuario;
    return r.body.usuario;
  }
}

function asegurar(r, estadoEsperado, que) {
  assert.equal(r.status, estadoEsperado, `${que}: se esperaba HTTP ${estadoEsperado} y llegó ${r.status} → ${JSON.stringify(r.body)}`);
}

const casi = (a, b, que) => assert.ok(Math.abs(Number(a) - Number(b)) < 0.001, `${que}: se esperaba ${b} y llegó ${a}`);

// Día comercial actual (el día "cambia" a las 6 am, como en el cierre de caja).
function diaComercialDeHoy() {
  return new Date(Date.now() - 6 * 3600 * 1000).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
}

// ---------- Estado compartido entre los pasos ----------
const HOY = diaComercialDeHoy();
const admin = new Sesion('admin');
const ids = {};          // ids de los datos de prueba
const base = {};         // números de partida (dashboard) por sucursal
const costoInicial = {}; // costo de cada insumo de prueba en la sucursal 1 al empezar (no debe cambiar)
const pedidos = {};      // ids de los pedidos que crea la suite

const RECETA = { harina: 0.5, queso: 0.25 };   // por pizza
const PRECIO = { 1: 1000, 2: 1100 };           // precio de la pizza de prueba por sucursal
const CAJERO = { nombre: `${PREFIJO} Cajero`, email: 'test-auto-cajero@example.com', password: 'Test-Auto-12345' };

function pedido(extra = {}) {
  return {
    cliente: `${PREFIJO} cliente`, canal: 'presencial', medio_pago: 'efectivo', tipo_entrega: 'retiro',
    productos: [{ producto_id: ids.pizza, cantidad: 1 }], ...extra
  };
}

async function stock(sesion) {
  const r = await sesion.get('/insumos');
  asegurar(r, 200, 'listar insumos');
  const por = n => r.body.find(i => i.id === n);
  return { harina: por(ids.harina), queso: por(ids.queso) };
}

async function dashboard(sesion) {
  const r = await sesion.get(`/dashboard?desde=${HOY}&hasta=${HOY}`);
  asegurar(r, 200, 'dashboard');
  return {
    ventas: Number(r.body.resumen.ventasTotales),
    efectivo: Number(r.body.pagos.efectivo),
    transferencia: Number(r.body.pagos.mercadopago),
    compras: Number(r.body.balance.compras),
    gastos: Number(r.body.balance.gastos)
  };
}

async function pedidosActivosDePrueba(sesion) {
  const r = await sesion.get('/pedidos?activos=1');
  asegurar(r, 200, 'listar pedidos activos');
  return r.body.filter(p => String(p.cliente).startsWith(PREFIJO));
}

// ============================================================================
describe('Multi-sucursal (staging)', () => {

  before(async () => {
    await admin.entrar(EMAIL, PASSWORD);
    assert.equal(admin.usuario.rol, 'admin', 'TEST_EMAIL tiene que ser de un usuario administrador');

    const suc = await admin.get('/usuarios/sucursales');
    asegurar(suc, 200, 'listar sucursales');
    for (const n of [1, 2]) {
      const s = suc.body.find(x => x.id === n);
      assert.ok(s && s.activa, `La sucursal ${n} tiene que existir y estar activa en staging`);
    }

    // --- Datos de prueba propios: se reutilizan si ya existen de una corrida anterior ---
    await admin.irASucursal(1);
    const insumos = (await admin.get('/insumos')).body;
    for (const [clave, nombre] of [['harina', `${PREFIJO} Harina`], ['queso', `${PREFIJO} Queso`]]) {
      let i = insumos.find(x => x.nombre === nombre);
      if (!i) {
        const r = await admin.post('/insumos', { nombre, unidad_medida: 'kg', stock_minimo: 0 });
        asegurar(r, 201, 'crear insumo de prueba');
        i = r.body;
      }
      ids[clave] = i.id;
    }

    const productos = (await admin.get('/productos')).body;
    const nombrePizza = `${PREFIJO} Pizza`;
    let pizza = productos.find(p => p.nombre === nombrePizza);
    if (!pizza) {
      const r = await admin.post('/productos', { nombre: nombrePizza, precio: PRECIO[1], disponible: true, categoria_id: 0 });
      asegurar(r, 201, 'crear producto de prueba');
      pizza = r.body;
    }
    ids.pizza = pizza.id;

    // Precio y disponibilidad conocidos en cada sucursal.
    for (const s of [1, 2]) {
      await admin.irASucursal(s);
      const r = await admin.put(`/productos/${ids.pizza}`, { nombre: nombrePizza, precio: PRECIO[s], disponible: true, categoria_id: 0 });
      asegurar(r, 200, `fijar precio de prueba en la sucursal ${s}`);
    }
    const rec = await admin.put(`/recetas/${ids.pizza}`, {
      items: [{ insumo_id: ids.harina, cantidad: RECETA.harina }, { insumo_id: ids.queso, cantidad: RECETA.queso }]
    });
    asegurar(rec, 200, 'guardar la receta de prueba');

    // --- Limpieza de corridas anteriores: pedidos de prueba activos y usuario cajero ---
    for (const s of [1, 2]) {
      await admin.irASucursal(s);
      for (const p of await pedidosActivosDePrueba(admin)) {
        asegurar(await admin.put(`/pedidos/${p.id}`, { estado: 'cancelado' }), 200, 'cancelar pedido de prueba viejo');
      }
    }
    const usuarios = await admin.get('/usuarios');
    asegurar(usuarios, 200, 'listar usuarios');
    for (const u of usuarios.body.filter(x => x.email === CAJERO.email)) {
      asegurar(await admin.del(`/usuarios/${u.id}`), 200, 'borrar cajero de prueba viejo');
    }

    // --- Stock en cero en las dos sucursales (punto de partida conocido) ---
    for (const s of [1, 2]) {
      await admin.irASucursal(s);
      const actual = await stock(admin);
      for (const clave of ['harina', 'queso']) {
        const delta = -Number(actual[clave].stock_actual);
        if (delta !== 0) asegurar(await admin.post(`/insumos/${ids[clave]}/ajustar-stock`, { cantidad: delta, motivo: `${PREFIJO} reinicio` }), 200, 'dejar el stock en cero');
      }
    }

    // --- Números de partida del dashboard (para comparar por diferencia) ---
    for (const s of [1, 2]) {
      await admin.irASucursal(s);
      base[s] = await dashboard(admin);
    }
    // Costos de la sucursal 1: la suite nunca compra ahí, así que tienen que terminar iguales.
    await admin.irASucursal(1);
    const costos = await stock(admin);
    costoInicial.harina = Number(costos.harina.costo_unitario);
    costoInicial.queso = Number(costos.queso.costo_unitario);
    await admin.irASucursal(2);
  });

  // ------------------------------------------------------------------------
  describe('1. Sesión y cambio de sucursal', () => {
    it('el admin cambia de sucursal y la sesión lo refleja', async () => {
      const u = await admin.irASucursal(2);
      assert.equal(u.sucursal_id, 2);
      assert.ok(u.sucursal_nombre, 'la respuesta trae el nombre de la sucursal');
    });
    it('rechaza una sucursal que no existe, vacía o mal formada', async () => {
      assert.equal((await admin.post('/usuarios/cambiar-sucursal', { sucursal_id: 99999 })).status, 404);
      assert.equal((await admin.post('/usuarios/cambiar-sucursal', {})).status, 400);
      assert.equal((await admin.post('/usuarios/cambiar-sucursal', { sucursal_id: 'abc' })).status, 400);
      assert.equal(admin.usuario.sucursal_id, 2, 'tras un intento inválido sigue en la sucursal 2');
      const quien = await admin.get('/productos');
      asegurar(quien, 200, 'la sesión sigue funcionando');
    });
  });

  describe('2. Precios distintos por sucursal', () => {
    it('la pizza de prueba cuesta distinto en cada sucursal', async () => {
      for (const s of [1, 2]) {
        await admin.irASucursal(s);
        const r = await admin.get(`/productos/${ids.pizza}`);
        asegurar(r, 200, `producto en la sucursal ${s}`);
        casi(r.body.precio, PRECIO[s], `precio en la sucursal ${s}`);
      }
    });
    it('un producto no disponible en una sucursal no se puede pedir ahí, y en la otra sí sigue disponible', async () => {
      await admin.irASucursal(2);
      asegurar(await admin.put(`/productos/${ids.pizza}`, { nombre: `${PREFIJO} Pizza`, precio: PRECIO[2], disponible: false, categoria_id: 0 }), 200, 'desactivar en la 2');
      const rechazado = await admin.post('/pedidos', pedido());
      assert.equal(rechazado.status, 400, 'no se puede pedir un producto no disponible');
      await admin.irASucursal(1);
      const enLa1 = await admin.get(`/productos/${ids.pizza}`);
      assert.equal(enLa1.body.disponible, true, 'en la sucursal 1 sigue disponible');
      await admin.irASucursal(2);
      asegurar(await admin.put(`/productos/${ids.pizza}`, { nombre: `${PREFIJO} Pizza`, precio: PRECIO[2], disponible: true, categoria_id: 0 }), 200, 'reactivar en la 2');
    });
  });

  describe('3. Stock y compras por sucursal', () => {
    it('sin stock el pedido se rechaza y no se guarda nada', async () => {
      await admin.irASucursal(2);
      const antes = (await pedidosActivosDePrueba(admin)).length;
      const r = await admin.post('/pedidos', pedido());
      assert.equal(r.status, 400, `se esperaba rechazo por falta de stock → ${JSON.stringify(r.body)}`);
      assert.equal((await pedidosActivosDePrueba(admin)).length, antes, 'no quedó ningún pedido guardado');
      const s = await stock(admin);
      casi(s.harina.stock_actual, 0, 'la harina sigue en 0');
    });

    it('una compra en la sucursal 2 suma stock y costo SOLO ahí', async () => {
      await admin.irASucursal(2);
      const compra = await admin.post('/facturas-compra', { proveedor: `${PREFIJO} Proveedor`, concepto: 'prueba automática', monto: 1500, fecha: HOY });
      asegurar(compra, 201, 'crear compra');
      ids.compra = compra.body.id;
      const detalle = await admin.post(`/facturas-compra/${ids.compra}/detalle`, {
        items: [{ insumo_id: ids.harina, cantidad: 10, precio_unitario: 100 }, { insumo_id: ids.queso, cantidad: 5, precio_unitario: 200 }]
      });
      asegurar(detalle, 201, 'cargar el detalle de la compra');

      const en2 = await stock(admin);
      casi(en2.harina.stock_actual, 10, 'harina en la sucursal 2');
      casi(en2.queso.stock_actual, 5, 'queso en la sucursal 2');
      casi(en2.harina.costo_unitario, 100, 'costo de la harina en la sucursal 2');

      await admin.irASucursal(1);
      const en1 = await stock(admin);
      casi(en1.harina.stock_actual, 0, 'la harina de la sucursal 1 no cambió');
      casi(en1.harina.costo_unitario, costoInicial.harina, 'el costo de la sucursal 1 no cambió');
      casi(en1.queso.costo_unitario, costoInicial.queso, 'el costo del queso de la sucursal 1 no cambió');
    });

    it('el costo y el margen del producto se calculan con los insumos de cada sucursal', async () => {
      await admin.irASucursal(2);
      const r2 = await admin.get(`/recetas/${ids.pizza}/costo`);
      asegurar(r2, 200, 'costo en la sucursal 2');
      casi(r2.body.costo, RECETA.harina * 100 + RECETA.queso * 200, 'costo de la pizza en la sucursal 2');
      casi(r2.body.precioVenta, PRECIO[2], 'precio de venta en la sucursal 2');
      await admin.irASucursal(1);
      const r1 = await admin.get(`/recetas/${ids.pizza}/costo`);
      asegurar(r1, 200, 'costo en la sucursal 1');
      casi(r1.body.costo, RECETA.harina * costoInicial.harina + RECETA.queso * costoInicial.queso, 'el costo de la sucursal 1 usa los costos de la 1 (no los de la 2)');
    });

    it('la compra de la sucursal 2 no aparece en la sucursal 1', async () => {
      await admin.irASucursal(1);
      const r = await admin.get(`/facturas-compra/${ids.compra}`);
      assert.equal(r.status, 404);
      await admin.irASucursal(2);
      asegurar(await admin.get(`/facturas-compra/${ids.compra}`), 200, 'la compra sí se ve en la sucursal 2');
    });
  });

  describe('4. Pedidos: descuento de stock por receta', () => {
    it('un pedido en la sucursal 2 descuenta stock solo ahí y cobra el precio de la 2', async () => {
      await admin.irASucursal(2);
      const r = await admin.post('/pedidos', pedido({ productos: [{ producto_id: ids.pizza, cantidad: 2 }] }));
      asegurar(r, 201, 'crear pedido en la sucursal 2');
      pedidos.p2a = r.body.id;
      const s = await stock(admin);
      casi(s.harina.stock_actual, 10 - 2 * RECETA.harina, 'harina tras el pedido');
      casi(s.queso.stock_actual, 5 - 2 * RECETA.queso, 'queso tras el pedido');
      const det = await admin.get(`/pedidos/${pedidos.p2a}`);
      asegurar(det, 200, 'leer el pedido');
      casi(det.body.productos[0].precio_unitario, PRECIO[2], 'precio unitario cobrado');
    });

    it('un pedido en la sucursal 1 sin stock se rechaza; con stock descuenta solo de la 1', async () => {
      await admin.irASucursal(1);
      assert.equal((await admin.post('/pedidos', pedido())).status, 400, 'la sucursal 1 no tiene stock de los insumos de prueba');
      for (const clave of ['harina', 'queso']) {
        asegurar(await admin.post(`/insumos/${ids[clave]}/ajustar-stock`, { cantidad: clave === 'harina' ? 10 : 5, motivo: `${PREFIJO} carga inicial` }), 200, 'cargar stock en la 1');
      }
      const r = await admin.post('/pedidos', pedido());
      asegurar(r, 201, 'crear pedido en la sucursal 1');
      pedidos.p1 = r.body.id;
      const en1 = await stock(admin);
      casi(en1.harina.stock_actual, 10 - RECETA.harina, 'harina de la sucursal 1');
      await admin.irASucursal(2);
      const en2 = await stock(admin);
      casi(en2.harina.stock_actual, 10 - 2 * RECETA.harina, 'la harina de la sucursal 2 no se tocó');
    });

    it('cada sucursal ve solo sus pedidos', async () => {
      await admin.irASucursal(1);
      assert.equal((await admin.get(`/pedidos/${pedidos.p2a}`)).status, 404, 'el pedido de la 2 no se ve desde la 1');
      const activos1 = (await pedidosActivosDePrueba(admin)).map(p => p.id);
      assert.ok(activos1.includes(pedidos.p1) && !activos1.includes(pedidos.p2a), 'listado de la sucursal 1');
      await admin.irASucursal(2);
      const activos2 = (await pedidosActivosDePrueba(admin)).map(p => p.id);
      assert.ok(activos2.includes(pedidos.p2a) && !activos2.includes(pedidos.p1), 'listado de la sucursal 2');
    });

    it('un pedido de una sucursal no se puede modificar ni cancelar desde la otra', async () => {
      await admin.irASucursal(1);
      assert.equal((await admin.put(`/pedidos/${pedidos.p2a}`, { estado: 'cancelado' })).status, 404);
      assert.equal((await admin.put(`/pedidos/${pedidos.p2a}/productos`, pedido())).status, 404);
      await admin.irASucursal(2);
      const sigue = await admin.get(`/pedidos/${pedidos.p2a}`);
      asegurar(sigue, 200, 'el pedido sigue ahí');
      assert.notEqual(sigue.body.estado, 'cancelado');
    });
  });

  describe('5. Editar y cancelar devuelven el stock una sola vez', () => {
    it('editar la cantidad revierte y vuelve a descontar', async () => {
      await admin.irASucursal(2);
      const r = await admin.put(`/pedidos/${pedidos.p2a}/productos`, pedido({ productos: [{ producto_id: ids.pizza, cantidad: 3 }] }));
      asegurar(r, 200, 'editar el pedido');
      const s = await stock(admin);
      casi(s.harina.stock_actual, 10 - 3 * RECETA.harina, 'harina tras editar');
      casi(s.queso.stock_actual, 5 - 3 * RECETA.queso, 'queso tras editar');
    });

    it('cancelar devuelve el stock, y cancelar otra vez no lo devuelve de nuevo', async () => {
      await admin.irASucursal(2);
      const r = await admin.post('/pedidos', pedido());
      asegurar(r, 201, 'crear pedido para cancelar');
      pedidos.p2b = r.body.id;
      const antes = await stock(admin);
      asegurar(await admin.put(`/pedidos/${pedidos.p2b}`, { estado: 'cancelado' }), 200, 'cancelar');
      const despues = await stock(admin);
      casi(despues.harina.stock_actual, Number(antes.harina.stock_actual) + RECETA.harina, 'harina devuelta');
      await admin.put(`/pedidos/${pedidos.p2b}`, { estado: 'cancelado' }); // segundo intento
      const final = await stock(admin);
      casi(final.harina.stock_actual, despues.harina.stock_actual, 'la segunda cancelación no devuelve de más');
      casi(final.queso.stock_actual, despues.queso.stock_actual, 'el queso tampoco');
    });
  });

  describe('6. Pago mixto', () => {
    it('rechaza un pago mixto cuya suma no da el total, y no toca el stock', async () => {
      await admin.irASucursal(2);
      const antes = await stock(admin);
      const r = await admin.post('/pedidos', pedido({ medio_pago: 'mixto', monto_efectivo: 500, monto_transferencia: 500 }));
      assert.equal(r.status, 400, `suma 1000 contra total 1100 → ${JSON.stringify(r.body)}`);
      const despues = await stock(admin);
      casi(despues.harina.stock_actual, antes.harina.stock_actual, 'el stock no cambió');
    });
    it('acepta un pago mixto que suma el total y marca que requiere factura', async () => {
      await admin.irASucursal(2);
      const r = await admin.post('/pedidos', pedido({ medio_pago: 'mixto', monto_efectivo: 500, monto_transferencia: 600 }));
      asegurar(r, 201, 'pago mixto válido');
      pedidos.p2m = r.body.id;
      const det = await admin.get(`/pedidos/${pedidos.p2m}`);
      assert.equal(det.body.requiere_factura, true, 'la parte por transferencia requiere factura');
      casi(det.body.monto_efectivo, 500, 'efectivo');
      casi(det.body.monto_transferencia, 600, 'transferencia');
    });
  });

  describe('7. Gastos, caja y dashboard por sucursal', () => {
    it('un gasto cargado en una sucursal no aparece en la otra', async () => {
      const gastos = {};
      for (const [s, monto] of [[1, 111], [2, 222]]) {
        await admin.irASucursal(s);
        const r = await admin.post('/gastos', { concepto: `${PREFIJO} gasto sucursal ${s}`, categoria: 'prueba', monto, fecha: HOY });
        asegurar(r, 201, `crear gasto en la ${s}`);
        gastos[s] = r.body.id;
      }
      ids.gastos = gastos;
      for (const [s, otra] of [[1, 2], [2, 1]]) {
        await admin.irASucursal(s);
        const lista = (await admin.get(`/gastos?desde=${HOY}&hasta=${HOY}`)).body;
        assert.ok(lista.some(g => g.id === gastos[s]), `el gasto de la ${s} se ve en la ${s}`);
        assert.ok(!lista.some(g => g.id === gastos[otra]), `el gasto de la ${otra} NO se ve en la ${s}`);
      }
    });

    it('el dashboard de cada sucursal suma solo lo suyo', async () => {
      // Sucursal 2 (pedidos activos de la suite): 3 pizzas de p2a (efectivo) + 1 mixto (500 + 600).
      await admin.irASucursal(2);
      const d2 = await dashboard(admin);
      casi(d2.ventas - base[2].ventas, 3 * PRECIO[2] + PRECIO[2], 'ventas de la sucursal 2');
      casi(d2.efectivo - base[2].efectivo, 3 * PRECIO[2] + 500, 'efectivo de la sucursal 2');
      casi(d2.transferencia - base[2].transferencia, 600, 'transferencia de la sucursal 2');
      casi(d2.compras - base[2].compras, 1500, 'compras de la sucursal 2');
      casi(d2.gastos - base[2].gastos, 222, 'gastos de la sucursal 2');
      // Sucursal 1: un pedido de 1 pizza y un gasto.
      await admin.irASucursal(1);
      const d1 = await dashboard(admin);
      casi(d1.ventas - base[1].ventas, PRECIO[1], 'ventas de la sucursal 1');
      casi(d1.compras - base[1].compras, 0, 'la compra de la 2 no aparece en la 1');
      casi(d1.gastos - base[1].gastos, 111, 'gastos de la sucursal 1');
    });

    it('cada sucursal cierra su propia caja el mismo día', async () => {
      const totales = {};
      for (const s of [1, 2]) {
        await admin.irASucursal(s);
        const r = await admin.post('/cierre-caja', { fecha: HOY });
        assert.ok([200, 201].includes(r.status), `cierre de caja de la ${s}: HTTP ${r.status} → ${JSON.stringify(r.body)}`);
        const lista = await admin.get(`/cierre-caja?desde=${HOY}&hasta=${HOY}`);
        asegurar(lista, 200, `listar cierres de la ${s}`);
        assert.equal(lista.body.length, 1, `la sucursal ${s} ve un solo cierre (el suyo)`);
        totales[s] = Number(lista.body[0].total_general);
      }
      await admin.irASucursal(2);
      const d2 = await dashboard(admin);
      casi(totales[2], d2.ventas, 'el cierre de la sucursal 2 coincide con su dashboard');
    });
  });

  describe('8. Cajero de la sucursal 2', () => {
    const cajero = new Sesion('cajero');

    it('se crea un cajero asignado a la sucursal 2 y entra', async () => {
      await admin.irASucursal(2);
      const r = await admin.post('/usuarios', { nombre: CAJERO.nombre, email: CAJERO.email, password: CAJERO.password, rol: 'cajero', sucursal_id: 2 });
      asegurar(r, 201, 'crear el cajero');
      ids.cajero = r.body.id;
      const u = await cajero.entrar(CAJERO.email, CAJERO.password);
      assert.equal(u.sucursal_id, 2);
      assert.ok(u.sucursal_nombre);
    });

    it('ve los precios de la sucursal 2 y solo sus pedidos', async () => {
      const prod = await cajero.get(`/productos/${ids.pizza}`);
      asegurar(prod, 200, 'producto visto por el cajero');
      casi(prod.body.precio, PRECIO[2], 'precio visto por el cajero');
      assert.equal((await cajero.get(`/pedidos/${pedidos.p1}`)).status, 404, 'no ve el pedido de la sucursal 1');
      asegurar(await cajero.get(`/pedidos/${pedidos.p2m}`), 200, 'sí ve los de su sucursal');
    });

    it('no puede cambiar de sucursal ni entrar a las secciones de administrador', async () => {
      assert.equal((await cajero.post('/usuarios/cambiar-sucursal', { sucursal_id: 1 })).status, 403);
      assert.equal((await cajero.get('/insumos')).status, 403);
      assert.equal((await cajero.get('/dashboard?desde=' + HOY + '&hasta=' + HOY)).status, 403);
      assert.equal((await cajero.get('/gastos')).status, 403);
      assert.equal((await cajero.get('/cierre-caja')).status, 403);
    });

    it('puede cargar un pedido y se descuenta de la sucursal 2', async () => {
      const antes = await stock(admin);
      const r = await cajero.post('/pedidos', pedido());
      asegurar(r, 201, 'pedido del cajero');
      pedidos.pc = r.body.id;
      const despues = await stock(admin);
      casi(despues.harina.stock_actual, Number(antes.harina.stock_actual) - RECETA.harina, 'descuento de harina');
      const det = await admin.get(`/pedidos/${pedidos.pc}`);
      assert.equal(det.body.sucursal_id, 2, 'el pedido quedó en la sucursal 2');
    });
  });

  describe('9. Facturación (solo si TEST_FACTURACION=1)', { skip: process.env.TEST_FACTURACION !== '1' }, () => {
    it('en staging la emisión falla con un error limpio y el pedido queda intacto', async () => {
      await admin.irASucursal(2);
      const r = await admin.post('/pedidos', pedido({ medio_pago: 'transferencia' }));
      asegurar(r, 201, 'pedido por transferencia');
      pedidos.pf = r.body.id;
      const f = await admin.post(`/pedidos/${pedidos.pf}/facturar`);
      assert.equal(f.status, 500, 'ARCA en modo prueba no debería emitir: si respondió 200, avisá ya');
      assert.match(String(f.body && f.body.error), /ARCA/);
      const sigue = await admin.get(`/pedidos/${pedidos.pf}`);
      asegurar(sigue, 200, 'el pedido sigue ahí');
      assert.notEqual(sigue.body.estado, 'cancelado');
    });
  });

  // ------------------------------------------------------------------------
  after(async () => {
    // Limpieza: se cancelan los pedidos de prueba (devuelve el stock), se borra la compra
    // (revierte el stock que sumó) y los gastos, y se borra el cajero. Los cierres de caja quedan.
    try {
      for (const s of [1, 2]) {
        await admin.irASucursal(s);
        for (const p of await pedidosActivosDePrueba(admin)) await admin.put(`/pedidos/${p.id}`, { estado: 'cancelado' });
      }
      await admin.irASucursal(2);
      if (ids.compra) await admin.del(`/facturas-compra/${ids.compra}`);
      if (ids.gastos) {
        await admin.irASucursal(1); await admin.del(`/gastos/${ids.gastos[1]}`);
        await admin.irASucursal(2); await admin.del(`/gastos/${ids.gastos[2]}`);
      }
      if (ids.cajero) await admin.del(`/usuarios/${ids.cajero}`);
      await admin.irASucursal(1);
      const rest = await stock(admin);
      for (const clave of ['harina', 'queso']) {
        const delta = -Number(rest[clave].stock_actual);
        if (delta !== 0) await admin.post(`/insumos/${ids[clave]}/ajustar-stock`, { cantidad: delta, motivo: `${PREFIJO} limpieza` });
      }
    } catch (e) {
      console.error('\n⚠ La limpieza final no terminó (no es grave; la próxima corrida la completa):', e.message);
    }
    console.log(`\n(${cantidadDePedidos} pedidos a la API en esta corrida; el límite es 300 cada 15 minutos)`);
  });
});
