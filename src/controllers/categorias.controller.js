const categoriasRepository = require('../repositories/categorias.repository.js');
const { ErrorNegocio, responderError } = require('../utils/errores.js');
const { validarDatosCategoria, leerIdCategoria } = require('../utils/categorias.js');

async function listar(req, res) {
  try {
    const categorias = await categoriasRepository.obtenerTodas();
    res.json(categorias);
  } catch (error) {
    responderError(res, error, 'Error al obtener categorías');
  }
}

async function crear(req, res) {
  try {
    const datos = validarDatosCategoria(req.body);

    if (await categoriasRepository.existeNombre(datos.nombre)) {
      throw new ErrorNegocio('Ya existe una categoría con ese nombre', 409);
    }

    const nuevaCategoria = await categoriasRepository.crear(datos);
    res.status(201).json(nuevaCategoria);
  } catch (error) {
    responderError(res, error, 'Error al crear categoría');
  }
}

async function actualizar(req, res) {
  try {
    const id = leerIdCategoria(req.params.id);
    const datos = validarDatosCategoria(req.body);

    if (await categoriasRepository.existeNombre(datos.nombre, id)) {
      throw new ErrorNegocio('Ya existe otra categoría con ese nombre', 409);
    }

    const categoria = await categoriasRepository.actualizar(id, datos);
    if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });

    res.json(categoria);
  } catch (error) {
    responderError(res, error, 'Error al actualizar categoría');
  }
}

async function eliminar(req, res) {
  try {
    const id = leerIdCategoria(req.params.id);
    const resultado = await categoriasRepository.eliminar(id);

    if (!resultado) return res.status(404).json({ error: 'Categoría no encontrada' });
    if (!resultado.borrada) {
      throw new ErrorNegocio(`No se puede borrar: la categoría tiene ${resultado.cantidad} producto${resultado.cantidad === 1 ? '' : 's'}. Pasalos a otra categoría primero.`, 409);
    }

    res.json({ mensaje: 'Categoría eliminada' });
  } catch (error) {
    responderError(res, error, 'Error al eliminar categoría');
  }
}

module.exports = { listar, crear, actualizar, eliminar };
