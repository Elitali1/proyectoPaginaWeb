const productosRepository = require('../repositories/productos.repository.js');
const { ErrorNegocio, responderError } = require('../utils/errores.js');
const { esTexto, esNumero, esEnteroPositivo } = require('../utils/validaciones.js');

// Valida y limpia los datos de un producto. Lanza ErrorNegocio si algo no cierra.
function validarDatosProducto(body) {
  const { nombre, precio, disponible, imagen, categoria_id } = body || {};

  if (!esTexto(nombre, { max: 150 })) throw new ErrorNegocio('El nombre del producto es obligatorio');
  if (!esNumero(precio) || Number(precio) < 0) throw new ErrorNegocio('El precio debe ser un número mayor o igual a cero');
  if (disponible !== undefined && typeof disponible !== 'boolean') throw new ErrorNegocio('El campo disponible debe ser verdadero o falso');

  // El formulario manda 0 cuando no se elige categoría: se trata como 'sin categoría'.
  const tieneCategoria = Boolean(categoria_id) && Number(categoria_id) !== 0;
  if (tieneCategoria && !esEnteroPositivo(categoria_id)) throw new ErrorNegocio('Categoría inválida');

  return {
    nombre: nombre.trim(),
    precio: Number(precio),
    disponible,
    imagen: imagen ? String(imagen).trim().slice(0, 1000) : null,
    categoria_id: tieneCategoria ? Number(categoria_id) : null
  };
}

async function listar(req, res) {
  try {
    const productos = await productosRepository.obtenerTodos();
    res.json(productos);
  } catch (error) {
    responderError(res, error, 'Error al obtener productos');
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
    responderError(res, error, 'Error al obtener producto');
  }
}

async function crear(req, res) {
  try {
    const datos = validarDatosProducto(req.body);
    const nuevoProducto = await productosRepository.crear(datos);
    res.status(201).json(nuevoProducto);
  } catch (error) {
    responderError(res, error, 'Error al crear producto');
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const datos = validarDatosProducto(req.body);

    // El PUT reemplaza todos los campos: si no llega `disponible` se conserva el valor actual.
    if (datos.disponible === undefined) {
      const actual = await productosRepository.obtenerPorId(id);
      if (!actual) return res.status(404).json({ error: 'Producto no encontrado' });
      datos.disponible = actual.disponible;
    }

    const productoActualizado = await productosRepository.actualizar(id, datos);

    if (!productoActualizado) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(productoActualizado);
  } catch (error) {
    responderError(res, error, 'Error al actualizar producto');
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
    if (error && error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: el producto tiene pedidos o recetas asociadas. Marcalo como "no disponible" en su lugar.' });
    }
    responderError(res, error, 'Error al eliminar producto');
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
    responderError(res, error, 'Error al obtener el menú');
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
    responderError(res, error, 'Error al subir la imagen');
  }
}

module.exports = { listar, obtenerUno, crear, actualizar, eliminar, listarPublico, subirImagen };
