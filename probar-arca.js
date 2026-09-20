// Prueba la conexión con ARCA.
//
//   node probar-arca.js            -> solo consulta (estado del servidor y último comprobante). No emite nada.
//   node probar-arca.js --emitir   -> además EMITE UN COMPROBANTE REAL de $1 (queda en ARCA, no se puede borrar).
require('dotenv').config();
const { Arca } = require('@arcasdk/core');
const fs = require('fs');
const path = require('path');

const cert = process.env.ARCA_CERT || fs.readFileSync(path.join(__dirname, 'certificados-arca', 'arca.crt'), 'utf8');
const key = process.env.ARCA_KEY || fs.readFileSync(path.join(__dirname, 'certificados-arca', 'arca.key'), 'utf8');

const CUIT = Number(process.env.ARCA_CUIT);
const PTO_VTA = Number(process.env.ARCA_PTO_VTA);
const CBTE_TIPO = Number(process.env.ARCA_CBTE_TIPO);
const EMITIR = process.argv.includes('--emitir');

if (!CUIT || !PTO_VTA || !CBTE_TIPO) {
  console.error('Faltan ARCA_CUIT, ARCA_PTO_VTA o ARCA_CBTE_TIPO en el .env');
  process.exit(1);
}

const arca = new Arca({
  cert,
  key,
  cuit: CUIT,
  production: process.env.ARCA_PRODUCTION !== 'false'
});

async function probar() {
  try {
    const estado = await arca.electronicBillingService.getServerStatus();
    console.log('Conexión exitosa. Estado del servidor ARCA:', estado);

    const ultimoComprobante = await arca.electronicBillingService.getLastVoucher(PTO_VTA, CBTE_TIPO);
    console.log('Último comprobante autorizado:', JSON.stringify(ultimoComprobante, null, 2));

    if (!EMITIR) {
      console.log('\nNo se emitió nada. Para emitir un comprobante real de prueba: node probar-arca.js --emitir');
      return;
    }

    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');

    const nuevoComprobante = await arca.electronicBillingService.createVoucher({
      CantReg: 1,
      PtoVta: PTO_VTA,
      CbteTipo: CBTE_TIPO,
      Concepto: 1,
      DocTipo: 99,
      DocNro: 0,
      CbteDesde: ultimoComprobante.cbteNro + 1,
      CbteHasta: ultimoComprobante.cbteNro + 1,
      CbteFch: fecha,
      ImpTotal: 1,
      ImpTotConc: 0,
      ImpNeto: 1,
      ImpOpEx: 0,
      ImpTrib: 0,
      ImpIVA: 0,
      MonId: 'PES',
      MonCotiz: 1
    });

    console.log('Comprobante creado:', JSON.stringify(nuevoComprobante, null, 2));
  } catch (error) {
    console.error('Error al conectar con ARCA:', error);
  }
}

probar();
