// "Día comercial": el negocio cierra de madrugada, así que los pedidos hechos antes de las 6 AM
// cuentan para el día anterior. Esta expresión estaba repetida en varias consultas.
function diaComercial(columna) {
  return `DATE((${columna} AT TIME ZONE 'America/Argentina/Buenos_Aires') - INTERVAL '6 hours')`;
}

module.exports = { diaComercial };
