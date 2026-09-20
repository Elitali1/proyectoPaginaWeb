// Error "esperado" de negocio: se le muestra el mensaje al usuario con el status indicado.
class ErrorNegocio extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.name = 'ErrorNegocio';
    this.status = status;
  }
}

// Traduce cualquier error a una respuesta HTTP sin filtrar detalles internos.
function responderError(res, error, mensajeGenerico) {
  if (error instanceof ErrorNegocio) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error && error.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  }
  if (error && error.code === '23503') {
    return res.status(409).json({ error: 'No se puede completar la operación: el registro está relacionado con otros datos' });
  }
  console.error(error);
  return res.status(500).json({ error: mensajeGenerico });
}

module.exports = { ErrorNegocio, responderError };
