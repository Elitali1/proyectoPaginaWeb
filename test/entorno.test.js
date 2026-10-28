const test = require('node:test');
const assert = require('node:assert');
const { revisarEntorno } = require('../src/config/entorno.js');

// Un entorno completo y válido, como el de producción.
function entornoCompleto() {
  return {
    DATABASE_URL: 'postgres://usuario:clave@host/base',
    JWT_SECRET: 'secreto',
    ARCA_CUIT: '20386202126',
    ARCA_CBTE_TIPO: '11',
    ARCA_PTO_VTA: '2',
    ARCA_PRODUCTION: 'true',
    ARCA_CERT: 'cert',
    ARCA_KEY: 'key',
    FRONTEND_URL: 'https://www.donchichopizza.com.ar',
    CLOUDINARY_CLOUD_NAME: 'a',
    CLOUDINARY_API_KEY: 'b',
    CLOUDINARY_API_SECRET: 'c',
    BREVO_API_KEY: 'd',
    SENDER_EMAIL: 'e@e.com',
    SENDER_NAME: 'Don Chicho'
  };
}

test('un entorno completo no da errores ni avisos', () => {
  const { errores, avisos } = revisarEntorno(entornoCompleto());
  assert.deepStrictEqual(errores, []);
  assert.deepStrictEqual(avisos, []);
});

test('falta una variable crítica: da error y nombra la variable', () => {
  for (const nombre of ['DATABASE_URL', 'JWT_SECRET', 'ARCA_CUIT', 'ARCA_CBTE_TIPO']) {
    const env = entornoCompleto();
    delete env[nombre];
    const { errores } = revisarEntorno(env);
    assert.strictEqual(errores.length, 1, `debería haber 1 error al faltar ${nombre}`);
    assert.ok(errores[0].includes(nombre));
  }
});

test('una variable crítica vacía o con solo espacios cuenta como faltante', () => {
  const env = entornoCompleto();
  env.JWT_SECRET = '   ';
  assert.strictEqual(revisarEntorno(env).errores.length, 1);
});

test('ARCA_CUIT y ARCA_CBTE_TIPO con formato inválido dan error', () => {
  const env = entornoCompleto();
  env.ARCA_CUIT = '20-38620212-6';
  env.ARCA_CBTE_TIPO = 'once';
  const { errores } = revisarEntorno(env);
  assert.strictEqual(errores.length, 2);
});

test('falta una variable opcional: avisa pero no es error', () => {
  const env = entornoCompleto();
  delete env.CLOUDINARY_API_SECRET;
  delete env.BREVO_API_KEY;
  const { errores, avisos } = revisarEntorno(env);
  assert.deepStrictEqual(errores, []);
  assert.strictEqual(avisos.length, 2);
});

test('sin ARCA_CERT o ARCA_KEY avisa que se buscarán los archivos', () => {
  const env = entornoCompleto();
  delete env.ARCA_CERT;
  const { errores, avisos } = revisarEntorno(env);
  assert.deepStrictEqual(errores, []);
  assert.ok(avisos.some(a => a.includes('certificados-arca')));
});

test('los mensajes nunca incluyen el valor de las variables', () => {
  const env = entornoCompleto();
  env.ARCA_CUIT = 'valor-secreto-123';
  const { errores } = revisarEntorno(env);
  assert.ok(!JSON.stringify(errores).includes('valor-secreto-123'));
});