const categoriasRepository = require('../repositories/categorias.repository.js');

async function listar(req, res) {
  try {
    const categorias = await categoriasRepository.obtenerTodas();
    res.json(categorias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
}

async function crear(req, res) {
  try {
    const { nombre, requiere_masa } = req.body;
    const nuevaCategoria = await categoriasRepository.crear({ nombre, requiere_masa });
    res.status(201).json(nuevaCategoria);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
}

module.exports = { listar, crear };