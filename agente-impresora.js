require('dotenv').config();
const { imprimirComanda } = require('./src/services/impresora.service.js');

const API_URL = process.env.API_URL_PRODUCCION || 'https://www.donchichopizza.com.ar';
const TOKEN = process.env.AGENTE_TOKEN;
const INTERVALO_MS = 5000;
const TIMEOUT_MS = 15000;

if (!TOKEN) {
  console.error('Falta la variable AGENTE_TOKEN: el agente no puede autenticarse contra el servidor.');
  process.exit(1);
}

const opciones = (extra = {}) => ({
  ...extra,
  headers: { 'Authorization': `Bearer ${TOKEN}` },
  signal: AbortSignal.timeout(TIMEOUT_MS)
});

async function revisarPendientes() {
  try {
    const respuesta = await fetch(`${API_URL}/pedidos/pendientes-impresion`, opciones());

    if (!respuesta.ok) {
      const textoError = await respuesta.text();
      console.error('Error al consultar pendientes:', respuesta.status, textoError);
      return;
    }

    const pedidos = await respuesta.json();

    for (const pedido of pedidos) {
      console.log(`Imprimiendo pedido #${pedido.id}...`);

      try {
        await imprimirComanda(pedido);
      } catch (errorImpresion) {
        console.error(`Error al imprimir pedido #${pedido.id}:`, errorImpresion.message);
        continue;
      }

      // Ya se imprimió: si la confirmación falla no se sigue de largo en silencio, porque el pedido
      // quedaría pendiente y se reimprimiría en el próximo ciclo.
      try {
        const confirmacion = await fetch(`${API_URL}/pedidos/${pedido.id}/confirmar-impresion`, opciones({ method: 'POST' }));
        if (!confirmacion.ok) {
          console.error(`Pedido #${pedido.id} impreso pero el servidor no confirmó (status ${confirmacion.status}). Puede reimprimirse.`);
          continue;
        }
        console.log(`Pedido #${pedido.id} impreso y confirmado.`);
      } catch (errorConfirmacion) {
        console.error(`Pedido #${pedido.id} impreso pero no se pudo confirmar:`, errorConfirmacion.message);
      }
    }
  } catch (error) {
    console.error('Error al conectar con el servidor:', error.message);
  }
}

// Se reprograma recién cuando termina el ciclo anterior: con setInterval, si imprimir tardaba más de
// 5 segundos el ciclo siguiente volvía a leer los mismos pendientes y los imprimía dos veces.
async function ciclo() {
  await revisarPendientes();
  setTimeout(ciclo, INTERVALO_MS);
}

console.log(`Agente de impresión iniciado (servidor: ${API_URL}). Consultando cada ${INTERVALO_MS / 1000} segundos...`);
ciclo();
