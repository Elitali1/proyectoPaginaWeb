const { Arca } = require('@arcasdk/core');
const fs = require('fs');
const path = require('path');
const { fechaDeEmision } = require('../utils/fechas.js');
const { esProduccionArca, describirModoArca } = require('../utils/ambiente.js');
const { claveDeCola, crearColasPorClave } = require('../utils/colaEmision.js');

const cert = process.env.ARCA_CERT
  ? process.env.ARCA_CERT
  : fs.readFileSync(path.join(__dirname, '..', '..', 'certificados-arca', 'arca.crt'), 'utf8');

const key = process.env.ARCA_KEY
  ? process.env.ARCA_KEY
  : fs.readFileSync(path.join(__dirname, '..', '..', 'certificados-arca', 'arca.key'), 'utf8');

// Solo se emite en producción (comprobantes reales) si ARCA_PRODUCTION vale EXACTAMENTE "true".
// Cualquier otro valor, o no definirla, usa homologación: un error de tipeo en la variable nunca
// puede emitir comprobantes reales. En Railway (producción) hay que definir ARCA_PRODUCTION=true.
const arca = new Arca({
  cert,
  key,
  cuit: Number(process.env.ARCA_CUIT),
  production: esProduccionArca(process.env.ARCA_PRODUCTION)
});

// Deja a la vista en el log, en cada arranque, en qué modo quedó ARCA.
console.log(describirModoArca(process.env.ARCA_PRODUCTION));

// Una cola por punto de venta y tipo de comprobante (ver utils/colaEmision.js): las emisiones de la
// misma numeración salen de a una, para que nunca dos peticiones consulten "el último comprobante"
// al mismo tiempo, pero las sucursales con puntos de venta distintos no se esperan entre sí.
const colas = crearColasPorClave();

// El punto de venta lo decide quien llama (según la sucursal). Acá solo se exige que sea válido,
// para que nunca se emita con un punto de venta indefinido.
function validarPtoVta(ptoVta) {
  if (!Number.isInteger(ptoVta) || ptoVta <= 0) {
    throw new Error('Punto de venta de ARCA inválido: no se emite el comprobante');
  }
}

async function emitirFactura({ monto, cuitReceptor, ptoVta }) {
  validarPtoVta(ptoVta);
  const cbteTipo = Number(process.env.ARCA_CBTE_TIPO);
  return colas.encolar(claveDeCola(ptoVta, cbteTipo), async () => {
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

// La nota de crédito se emite con el mismo punto de venta de la factura que acredita.
async function emitirNotaCredito({ monto, cuitReceptor, facturaAsociada, ptoVta }) {
  validarPtoVta(ptoVta);
  const cbteTipoNC = 13;
  return colas.encolar(claveDeCola(ptoVta, cbteTipoNC), async () => {
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