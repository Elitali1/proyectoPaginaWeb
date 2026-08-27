const { Arca } = require('@arcasdk/core');
const fs = require('fs');
const path = require('path');

const cert = fs.readFileSync(path.join(__dirname, 'certificados-arca', 'arca.crt'), 'utf8');
const key = fs.readFileSync(path.join(__dirname, 'certificados-arca', 'arca.key'), 'utf8');

const arca = new Arca({
  cert,
  key,
  cuit: 20386202126,
  production: true
});

async function probar() {
  try {
    const estado = await arca.electronicBillingService.getServerStatus();
    console.log('Conexión exitosa. Estado del servidor ARCA:', estado);

    const ultimoComprobante = await arca.electronicBillingService.getLastVoucher(2, 11);
    console.log('Último comprobante autorizado:', JSON.stringify(ultimoComprobante, null, 2));

    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');

    const nuevoComprobante = await arca.electronicBillingService.createVoucher({
      CantReg: 1,
      PtoVta: 2,
      CbteTipo: 11,
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