const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'DonchichoAgenteImpresora',
  description: 'Agente de impresión de comandas para Donchichopizza',
  script: path.join(__dirname, 'agente-impresora.js'),
  nodeOptions: [],
  env: [
    { name: 'AGENTE_TOKEN', value: process.env.AGENTE_TOKEN },
    { name: 'API_URL_PRODUCCION', value: process.env.API_URL_PRODUCCION },
    { name: 'JWT_SECRET', value: process.env.JWT_SECRET }
  ]
});

svc.on('install', () => {
  console.log('Servicio instalado correctamente. Iniciando...');
  svc.start();
});

svc.install();