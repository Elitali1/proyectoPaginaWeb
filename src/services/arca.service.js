const { Arca } = require('@arcasdk/core');
const fs = require('fs');
const path = require('path');
const { fechaDeEmision } = require('../utils/fechas.js');

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
  // Por defecto es producción (igual que antes). Poné ARCA_PRODUCTION=false para usar homologación
  // con certificados de prueba y no emitir comprobantes reales desde tu PC.
  production: process.env.ARCA_PRODUCTION !== 'false'
});

// Lock simple: encadena todas las emisiones una detrás de otra, para que
// nunca dos peticiones consulten "el último comprobante" al mismo tiempo.
let colaDeEmision = Promise.resolve();

function encolarEmision(funcion) {
  const resultado = colaDeEmision.then(() => funcion());
  // Si esta emisión falla, no debe trabar la cola para las siguientes
  colaDeEmision = resultado.catch(() => {});
  return resultado;
}

async function emitirFactura({ monto, cuitReceptor }) {
  return encolarEmision(async () => {
    const ptoVta = Number(process.env.ARCA_PTO_VTA);
    const cbteTipo = Number(process.env.ARCA_CBTE_TIPO);

    const ultimoComprobante = await arca.electronicBillingService.getLastVoucher(ptoVta, cbteTipo);
    const nuevoNumero = ultimoComprobante.cbteNro + 1;

    const fecha = fechaDeEmision().replace(/-/g, '');

    const docTipo = cuitReceptor ? 80 : 99;
    const docNro = cuitReceptor || 0;
    const condicionIva = cuitReceptor ? 1 : 5;

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
  });
}

async function emitirNotaCredito({ monto, cuitReceptor, facturaAsociada }) {
  return encolarEmision(async () => {
    const ptoVta = Number(process.env.ARCA_PTO_VTA);
    const cbteTipoNC = 13;

    const ultimoComprobante = await arca.electronicBillingService.getLastVoucher(ptoVta, cbteTipoNC);
    const nuevoNumero = ultimoComprobante.cbteNro + 1;

    const fecha = fechaDeEmision().replace(/-/g, '');

    const docTipo = cuitReceptor ? 80 : 99;
    const docNro = cuitReceptor || 0;
    const condicionIva = cuitReceptor ? 1 : 5;

    const resultado = await arca.electronicBillingService.createVoucher({
      CantReg: 1,
      PtoVta: ptoVta,
      CbteTipo: cbteTipoNC,
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
      MonCotiz: 1,
      CbtesAsoc: [
        {
          Tipo: facturaAsociada.tipoComprobante,
          PtoVta: ptoVta,
          Nro: facturaAsociada.numeroComprobante,
          Cuit: Number(process.env.ARCA_CUIT),
          CbteFch: facturaAsociada.fecha
        }
      ]
    });

    return {
      numeroComprobante: nuevoNumero,
      cae: resultado.cae,
      caeFchVto: resultado.caeFchVto
    };
  });
}

module.exports = { emitirFactura, emitirNotaCredito };