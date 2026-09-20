const categoriasRepository = require('../repositories/categorias.repository.js');
const { ErrorNegocio, responderError } = require('../utils/errores.js');
const { esTexto } = require('../utils/validaciones.js');

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
    const { nombre, requiere_masa } = req.body || {};

    if (!esTexto(nombre, { max: 100 })) throw new ErrorNegocio('El nombre de la categoría es obligatorio');

    const nuevaCategoria = await categoriasRepository.crear({ nombre: nombre.trim(), requiere_masa: requiere_masa === true });
    res.status(201).json(nuevaCategoria);
  } catch (error) {
    responderError(res, error, 'Error al crear categoría');
  }
}

module.exports = { listar, crear };
