// Colas de emisión de comprobantes. Es un módulo puro (no toca ARCA ni la base): por eso se puede testear solo.
//
// Por qué una cola por punto de venta y tipo de comprobante:
// ARCA numera de forma independiente cada combinación de punto de venta + tipo de comprobante
// (la factura C del punto 1 y la del punto 2 tienen numeraciones separadas, y la nota de crédito otra más).
// Lo único que hay que evitar es que DOS emisiones de la MISMA combinación pidan "el último comprobante"
// al mismo tiempo: las dos verían el mismo número y una chocaría con la otra.
// Entonces: dentro de una misma combinación las emisiones salen de a una y en orden;
// entre combinaciones distintas pueden salir en paralelo, porque no comparten numeración.

// La clave identifica la numeración que se protege.
function claveDeCola(ptoVta, cbteTipo) {
  return `${ptoVta}-${cbteTipo}`;
}

function crearColasPorClave() {
  // clave -> promesa de la última emisión encolada para esa clave (nunca se rechaza)
  const colas = new Map();

  function encolar(clave, funcion) {
    const anterior = colas.get(clave) || Promise.resolve();
    // Se espera a la emisión anterior de la misma clave y recién ahí se ejecuta esta.
    const resultado = anterior.then(() => funcion());
    // Si esta emisión falla, no debe trabar a las siguientes de la misma clave.
    const cola = resultado.catch(() => {});
    colas.set(clave, cola);
    // Limpieza: si nadie encoló nada después de esta, la clave ya no necesita cola.
    cola.then(() => {
      if (colas.get(clave) === cola) colas.delete(clave);
    });
    // Quien llama recibe el resultado real (o el error real) de SU emisión.
    return resultado;
  }

  return { encolar, cantidadDeColas: () => colas.size };
}

module.exports = { claveDeCola, crearColasPorClave };
