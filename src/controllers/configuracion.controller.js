const configuracionRepository = require('../repositories/configuracion.repository.js');
const { responderError } = require('../utils/errores.js');
const { validarConfigIva } = require('../utils/configuracion.js');

async function obtenerIva(req, res) {
  try {
    res.json(await configuracionRepository.obtenerIva());
  } catch (error) {
    responderError(res, error, 'Error al obtener la configuración de IVA');
  }
}

async function guardarIva(req, res) {
  try {
    const datos = validarConfigIva(req.body);
    res.json(await configuracionRepository.guardarIva(datos));
  } catch (error) {
    responderError(res, error, 'Error al guardar la configuración de IVA');
  }
}

module.exports = { obtenerIva, guardarIva };
