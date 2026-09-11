const recetasRepository = require('../repositories/recetas.repository.js');
const productosRepository = require('../repositories/productos.repository.js');

async function obtener(req, res) {
  try {
    const { productoId } = req.params;
    const receta = await recetasRepository.obtenerPorProducto(productoId);
    res.json(receta);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la receta' });
  }
}

async function guardar(req, res) {
  try {
    const { productoId } = req.params;
    const { items } = req.body;

    if (!items) {
      return res.status(400).json({ error: 'Faltan los items de la receta' });
    }

    const receta = await recetasRepository.reemplazarReceta(productoId, items);
    res.json(receta);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar la receta' });
  }
}

async function obtenerCostoYMargen(req, res) {
  try {
    const { productoId } = req.params;

    const producto = await productosRepository.obtenerPorId(productoId);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const costo = await recetasRepository.calcularCostoProducto(productoId);
    const precioVenta = Number(producto.precio);
    const gananciaAbsoluta = precioVenta - costo;
    const margenPorcentual = costo > 0 ? ((gananciaAbsoluta / precioVenta) * 100) : null;

    res.json({
      producto: producto.nombre,
      precioVenta,
      costo,
      gananciaAbsoluta,
      margenPorcentual: margenPorcentual !== null ? Number(margenPorcentual.toFixed(1)) : null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular costo y margen' });
  }
}

module.exports = { obtener, guardar, obtenerCostoYMargen };