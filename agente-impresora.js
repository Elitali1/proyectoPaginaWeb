require('dotenv').config();
const comandaService = require('./src/services/comanda.service.js');

const API_URL = process.env.API_URL_PRODUCCION || 'https://proyectopaginaweb-production.up.railway.app/';
const TOKEN = process.env.AGENTE_TOKEN;

async function revisarPendientes() {
  try {
    const respuesta = await fetch(`${API_URL}/pedidos/pendientes-impresion`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });

    if (!respuesta.ok) {
      console.error('Error al consultar pendientes:', respuesta.status);
      return;
    }

    const pedidos = await respuesta.json();

    for (const pedido of pedidos) {
      console.log(`Imprimiendo pedido #${pedido.id}...`);

      try {
        await comandaService.imprimirComanda(pedido);

        await fetch(`${API_URL}/pedidos/${pedido.id}/confirmar-impresion`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${TOKEN}` }
        });

        console.log(`Pedido #${pedido.id} impreso y confirmado.`);
      } catch (errorImpresion) {
        console.error(`Error al imprimir pedido #${pedido.id}:`, errorImpresion.message);
      }
    }
  } catch (error) {
    console.error('Error al conectar con el servidor:', error.message);
  }
}

console.log('Agente de impresión iniciado. Consultando cada 5 segundos...');
setInterval(revisarPendientes, 5000);
revisarPendientes();