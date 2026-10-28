const productosRepository = require('../repositories/productos.repository.js');
const { ErrorNegocio, responderError } = require('../utils/errores.js');
const { esTexto, esNumero, esEnteroPositivo } = require('../utils/validaciones.js');
const { validarSucursalesDeProducto, leerSucursalDeConsulta } = require('../utils/sucursales.js');
const sucursalesRepository = require('../repositories/sucursales.repository.js');
const categoriasRepository = require('../repositories/categorias.repository.js');

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
    const productos = await productosRepository.obtenerTodos(req.sucursalId);
    res.json(productos);
  } catch (error) {
    responderError(res, error, 'Error al obtener productos');
  }
}

async function obtenerUno(req, res) {
  try {
    const { id } = req.params;
    const producto = await productosRepository.obtenerPorId(id, req.sucursalId);

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
    const nuevoProducto = await productosRepository.crear(datos, req.sucursalId);
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
      const actual = await productosRepository.obtenerPorId(id, req.sucursalId);
      if (!actual) return res.status(404).json({ error: 'Producto no encontrado' });
      datos.disponible = actual.disponible;
    }

    const productoActualizado = await productosRepository.actualizar(id, datos, req.sucursalId);

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
    const productoEliminado = await productosRepository.eliminar(id, req.sucursalId);

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
    // Sin ?sucursal= se muestra el menú de la sucursal 1 (así la landing sigue igual).
    // Con ?sucursal=2 se muestra el de esa sucursal, con SUS precios y solo lo que se vende ahí.
    const sucursalId = leerSucursalDeConsulta(req.query.sucursal) ?? 1;

    // Una sucursal inactiva o inexistente no muestra menú.
    const sucursal = await sucursalesRepository.obtener(sucursalId);
    if (!sucursal.activa) throw new ErrorNegocio('Esa sucursal no está disponible', 404);

    const productos = await productosRepository.obtenerTodos(sucursalId);
    // Los productos de categorías marcadas como extras se ofrecen dentro de las pizzas, no como productos sueltos.
    const categorias = await categoriasRepository.obtenerTodas();
    const extraPorCategoria = new Map(categorias.map(c => [c.id, c.es_extra === true]));
    const disponibles = productos
      .filter(p => p.disponible)
      .map(p => ({
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        imagen: p.imagen,
        categoria_nombre: p.categoria_nombre,
        // Para que el armado de pedido sepa si hay que elegir masa (piedra / molde).
        requiere_masa: Boolean(p.requiere_masa),
        es_extra: extraPorCategoria.get(p.categoria_id) === true
      }));
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

    const productoActualizado = await productosRepository.actualizarImagen(id, nombreArchivo, req.sucursalId);

    if (!productoActualizado) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(productoActualizado);
  } catch (error) {
    responderError(res, error, 'Error al subir la imagen');
  }
}

// En qué sucursales se vende un producto (y a qué precio). Solo admin: ve todas las sucursales activas.
async function listarSucursalesDeProducto(req, res) {
  try {
    const sucursales = await productosRepository.obtenerSucursalesDeProducto(req.params.id);
    if (!sucursales) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(sucursales);
  } catch (error) {
    responderError(res, error, 'Error al obtener las sucursales del producto');
  }
}

async function guardarSucursalesDeProducto(req, res) {
  try {
    const lista = validarSucursalesDeProducto(req.body);
    const sucursales = await productosRepository.guardarSucursalesDeProducto(req.params.id, lista);
    if (!sucursales) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(sucursales);
  } catch (error) {
    responderError(res, error, 'Error al guardar las sucursales del producto');
  }
}

module.exports = {
  listar, obtenerUno, crear, actualizar, eliminar, listarPublico, subirImagen,
  listarSucursalesDeProducto, guardarSucursalesDeProducto
};