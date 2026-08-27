const { Arca } = require('@arcasdk/core');
const fs = require('fs');
const path = require('path');

const cert = process.env.ARCA_CERT
  ? process.env.ARCA_CERT
  : fs.readFileSync(path.join(__dirname, '..', '..', 'certificados-arca', 'arca.crt'), 'utf8');

const key = process.env.ARCA_KEY
  ? process.env.ARCA_KEY
  : fs.readFileSync(path.join(__dirname, '..', '..', 'certificados-arca', 'arca.key'), 'utf8');

const arca = new Arca({
  cert,
  key,
  cuit: Number(process.env.ARCA_CUIT),
  production: true
});

async function emitirFactura({ monto, cuitReceptor }) {
  const ptoVta = Number(process.env.ARCA_PTO_VTA);
  const cbteTipo = Number(process.env.ARCA_CBTE_TIPO);

  const ultimoComprobante = await arca.electronicBillingService.getLastVoucher(ptoVta, cbteTipo);
  const nuevoNumero = ultimoComprobante.cbteNro + 1;

  const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');

  const docTipo = cuitReceptor ? 80 : 99;
  const docNro = cuitReceptor || 0;
  const condicionIva = cuitReceptor ? 1 : 5; // 1 = Responsable Inscripto, 5 = Consumidor Final

  const resultado = await arca.electronicBillingService.createVoucher({
    CantReg: 1,
    PtoVta: ptoVta,
    CbteTipo: cbteTipo,
    Concepto: 1,
    DocTipo: docTipo,
    DocNro: docNro,
    CondicionIVAReceptorId: condicionIva,
    CbteDesde: nuevoNumero,
    CbteHasta: nuevoNumero,
    CbteFch: fecha,
    ImpTotal: monto,
    ImpTotConc: 0,
    ImpNeto: monto,
    ImpOpEx: 0,
    ImpTrib: 0,
    ImpIVA: 0,
    MonId: 'PES',
    MonCotiz: 1
  });

  return {
    numeroComprobante: nuevoNumero,
    cae: resultado.cae,
    caeFchVto: resultado.caeFchVto
  };
}

module.exports = { emitirFactura };