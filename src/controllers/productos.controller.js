const productosRepository = require('../repositories/productos.repository.js');

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