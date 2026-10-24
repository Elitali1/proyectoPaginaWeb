const pool = require('../config/db.js');
const { ErrorNegocio } = require('../utils/errores.js');

async function obtener(id) {
  const resultado = await pool.query('SELECT * FROM sucursales WHERE id = $1', [id]);
  if (resultado.rows.length === 0) {
    throw new ErrorNegocio('La sucursal no existe', 404);
  }
  return resultado.rows[0];
}

// Punto de venta de ARCA con el que emite una sucursal.
//  - Si la sucursal lo tiene cargado (sucursales.pto_vta), se usa ese.
//  - La sucursal 1 (el local original) mantiene la variable ARCA_PTO_VTA como respaldo, así sigue
//    emitiendo igual que antes aunque todavía no se haya cargado en la tabla.
//  - Cualquier otra sucursal sin punto de venta NO puede emitir: si cayera en el de la sucursal 1,
//    saldrían comprobantes de un local con el punto de venta de otro.
function ptoVtaDeEmision(sucursal) {
  if (sucursal.pto_vta) return Number(sucursal.pto_vta);
  if (Number(sucursal.id) === 1 && process.env.ARCA_PTO_VTA) return Number(process.env.ARCA_PTO_VTA);
  throw new ErrorNegocio('Esta sucursal todavía no tiene un punto de venta de ARCA configurado. Avisá al administrador.', 409);
}

module.exports = { obtener, ptoVtaDeEmision };