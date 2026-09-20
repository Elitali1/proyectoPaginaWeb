const test = require('node:test');
const assert = require('node:assert/strict');
const verificarAgente = require('../src/middlewares/verificarAgente.js');

function ejecutarMiddleware({ authorization, token = 'token-seguro' } = {}) {
  const anterior = process.env.AGENTE_TOKEN;
  process.env.AGENTE_TOKEN = token;

  let resultado;
  const req = { headers: authorization === undefined ? {} : { authorization } };
  const res = {
    status(codigo) {
      resultado = { codigo };
      return this;
    },
    json(cuerpo) {
      resultado.cuerpo = cuerpo;
      return resultado;
    }
  };

  let continuo = false;
  verificarAgente(req, res, () => {
    continuo = true;
  });

  if (anterior === undefined) delete process.env.AGENTE_TOKEN;
  else process.env.AGENTE_TOKEN = anterior;

  return { resultado, continuo };
}

test('autoriza al agente con bearer token válido', () => {
  const resultado = ejecutarMiddleware({ authorization: 'Bearer token-seguro' });
  assert.equal(resultado.continuo, true);
  assert.equal(resultado.resultado, undefined);
});

test('rechaza token de agente ausente o inválido', () => {
  const ausente = ejecutarMiddleware();
  const invalido = ejecutarMiddleware({ authorization: 'Bearer otro-token' });

  assert.equal(ausente.resultado.codigo, 401);
  assert.equal(invalido.resultado.codigo, 401);
  assert.equal(ausente.continuo, false);
  assert.equal(invalido.continuo, false);
});
