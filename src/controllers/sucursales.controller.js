const sucursalesRepository = require('../repositories/sucursales.repository.js');
const { ErrorNegocio, responderError } = require('../utils/errores.js');
const { validarDatosSucursal, validarOpcionesDeCopia } = require('../utils/sucursales.js');

function leerId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('Sucursal inválida');
  return id;
}

async function listar(req, res) {
  try {
    res.json(await sucursalesRepository.listarCompleta());
  } catch (error) {
    responderError(res, error, 'Error al obtener las sucursales');
  }
}

// Público (sin sesión): las sucursales activas para el menú de pedidos.
async function listarPublico(req, res) {
  try {
    res.json(await sucursalesRepository.listarPublicas());
  } catch (error) {
    responderError(res, error, 'Error al obtener las sucursales');
  }
}

async function crear(req, res) {
  try {
    const datos = validarDatosSucursal(req.body);
    const opciones = validarOpcionesDeCopia(req.body);
    const nueva = await sucursalesRepository.crear(datos, opciones);
    res.status(201).json(nueva);
  } catch (error) {
    responderError(res, error, 'Error al crear la sucursal');
  }
}

async function actualizar(req, res) {
  try {
    const id = leerId(req);
    const datos = validarDatosSucursal(req.body);

    // Para no dejar al admin trabajando en una sucursal inactiva: primero tiene que cambiarse a otra.
    if (datos.activa === false && id === Number(req.sucursalId)) {
      throw new ErrorNegocio('No podés desactivar la sucursal en la que estás trabajando. Cambiate a otra primero.', 409);
    }

    res.json(await sucursalesRepository.actualizar(id, datos));
  } catch (error) {
    responderError(res, error, 'Error al actualizar la sucursal');
  }
}

module.exports = { listar, listarPublico, crear, actualizar };
