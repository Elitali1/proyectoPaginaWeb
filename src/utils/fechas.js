// Fechas de comprobantes ARCA.
//
// Históricamente el sistema usó la fecha UTC, así que entre las 21:00 y las 24:00 (Argentina)
// los comprobantes salían con la fecha del día siguiente. Para corregirlo sin alterar los
// comprobantes ya emitidos, la corrección se activa con la variable ARCA_FECHA_ART_DESDE
// (fecha/hora ISO del momento del deploy). Sin esa variable el comportamiento es el de siempre.

function fechaArgentina(fecha) {
  // 'en-CA' formatea como YYYY-MM-DD
  return new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

function fechaUtc(fecha) {
  return new Date(fecha).toISOString().split('T')[0];
}

function corteFechaArgentina() {
  const valor = process.env.ARCA_FECHA_ART_DESDE;
  if (!valor) return null;
  const corte = new Date(valor);
  return Number.isNaN(corte.getTime()) ? null : corte;
}

// Fecha (YYYY-MM-DD) con la que se debe emitir un comprobante nuevo.
function fechaDeEmision() {
  return corteFechaArgentina() ? fechaArgentina(new Date()) : fechaUtc(new Date());
}

// Fecha (YYYY-MM-DD) que tiene un comprobante ya guardado, según su `creado_en`.
function fechaDeComprobante(creadoEn) {
  const corte = corteFechaArgentina();
  if (corte && new Date(creadoEn) >= corte) return fechaArgentina(creadoEn);
  return fechaUtc(creadoEn);
}

module.exports = { fechaArgentina, fechaUtc, fechaDeEmision, fechaDeComprobante };
