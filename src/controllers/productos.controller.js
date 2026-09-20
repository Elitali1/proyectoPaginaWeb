const productosRepository = require('../repositories/productos.repository.js');

function validarProducto({ nombre, precio, disponible, categoria_id }) {
  return typeof nombre === 'string' && nombre.trim().length >= 2 && nombre.length <= 150 &&
    Number.isFinite(Number(precio)) && Number(precio) >= 0 &&
    typeof disponible === 'boolean' &&
    Number.isInteger(Number(categoria_id)) && Number(categoria_id) > 0;
}

async function listar(req, res) {
  try {
    const productos = await productosRepository.obtenerTodos();
    res.json(productos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
}

async function obtenerUno(req, res) {
  try {
    const { id } = req.params;
    const producto = await productosRepository.obtenerPorId(id);

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(producto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
}

async function crear(req, res) {
  try {
    const { nombre, precio, disponible, imagen, categoria_id } = req.body;
    if (!validarProducto({ nombre, precio, disponible, categoria_id })) {
      return res.status(400).json({ error: 'Datos de producto inválidos' });
    }
    const nuevoProducto = await productosRepository.crear({ nombre, precio, disponible, imagen, categoria_id });
    res.status(201).json(nuevoProducto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, precio, disponible, imagen, categoria_id } = req.body;
    if (!validarProducto({ nombre, precio, disponible, categoria_id })) {
      return res.status(400).json({ error: 'Datos de producto inválidos' });
    }

    const productoActualizado = await productosRepository.actualizar(id, { nombre, precio, disponible, imagen, categoria_id });

    if (!productoActualizado) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(productoActualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const productoEliminado = await productosRepository.eliminar(id);

    if (!productoEliminado) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ mensaje: 'Producto eliminado', producto: productoEliminado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
}

async function listarPublico(req, res) {
  try {
    const productos = await productosRepository.obtenerTodos();
    const disponibles = productos
      .filter(p => p.disponible)
      .map(p => ({ id: p.id, nombre: p.nombre, precio: p.precio, imagen: p.imagen, categoria_nombre: p.categoria_nombre }));
    res.json(disponibles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el menú' });
  }
}

async function subirImagen(req, res) {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const nombreArchivo = req.file.path;

    const productoActualizado = await productosRepository.actualizarImagen(id, nombreArchivo);

    if (!productoActualizado) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(productoActualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
}

module.exports = { listar, obtenerUno, crear, actualizar, eliminar, listarPublico, subirImagen };