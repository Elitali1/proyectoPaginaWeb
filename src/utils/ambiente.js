// Decide si ARCA trabaja en PRODUCCIÓN (comprobantes reales) o en HOMOLOGACIÓN (pruebas).
//
// Regla: solo es producción si la variable ARCA_PRODUCTION vale EXACTAMENTE "true".
// Cualquier otra cosa (no definida, vacía, "True", "falso", un error de tipeo, etc.) es
// homologación. Así un error al escribir la variable nunca emite comprobantes reales:
// lo peor que puede pasar es que las facturas fallen, y eso se nota enseguida.
// (Antes era al revés: todo lo que no fuera "false" emitía en producción.)
function esProduccionArca(valor) {
  return valor === 'true';
}

// Texto para el log de arranque: deja a la vista en qué modo quedó, y avisa si el valor
// es raro (tiene algo escrito, pero no es ni "true" ni "false").
function describirModoArca(valor) {
  const produccion = esProduccionArca(valor);
  const modo = produccion ? 'PRODUCCIÓN (comprobantes reales)' : 'HOMOLOGACIÓN (pruebas, no emite comprobantes reales)';
  const valorRaro = valor !== undefined && valor !== 'true' && valor !== 'false';
  const aviso = valorRaro
    ? ` ATENCIÓN: ARCA_PRODUCTION tiene el valor "${valor}"; solo "true" activa la producción.`
    : '';
  return `ARCA en modo ${modo}.${aviso}`;
}

module.exports = { esProduccionArca, describirModoArca };