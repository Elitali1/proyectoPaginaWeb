const { ErrorNegocio } = require('./errores.js');
const { CONDICIONES_IVA } = require('./estadoResultados.js');

// Condición frente al IVA y alícuota. Hoy: monotributo (las ventas se toman tal cual).
function validarConfigIva(body) {
  const { condicion, alicuota } = body || {};

  if (!CONDICIONES_IVA.includes(condicion)) {
    throw new ErrorNegocio('La condición frente al IVA tiene que ser monotributo o responsable_inscripto');
  }

  let alicuotaNumero = 21;
  if (alicuota !== undefined && alicuota !== null && String(alicuota).trim() !== '') {
    alicuotaNumero = Number(alicuota);
    if (!Number.isFinite(alicuotaNumero) || alicuotaNumero < 0 || alicuotaNumero > 50) {
      throw new ErrorNegocio('La alícuota de IVA tiene que ser un número entre 0 y 50');
    }
  }

  return { condicion, alicuota: alicuotaNumero };
}

module.exports = { validarConfigIva };
