// Instala el agente de impresión como servicio de Windows.
// Requiere `node-windows`, que solo se necesita en la PC del local:  npm install node-windows --no-save
require('dotenv').config();
const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'DonchichoAgenteImpresora',
  description: 'Agente de impresión de comandas para Donchichopizza',
  script: path.join(__dirname, 'agente-impresora.js'),
  nodeOptions: [],
  // El agente solo necesita el token y la URL. (Antes también se le pasaba JWT_SECRET, que no usa:
  // dejar esa clave en la PC del local era un riesgo innecesario.)
  env: [
    { name: 'AGENTE_TOKEN', value: process.env.AGENTE_TOKEN },
    { name: 'API_URL_PRODUCCION', value: process.env.API_URL_PRODUCCION }
  ]
});

svc.on('install', () => {
  console.log('Servicio instalado correctamente. Iniciando...');
  svc.start();
});

svc.install();
