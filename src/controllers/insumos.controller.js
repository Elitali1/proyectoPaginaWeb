const insumosRepository = require('../repositories/insumos.repository.js');

async function listar(req, res) {
  try {
    const insumos = await insumosRepository.obtenerTodos();
    res.json(insumos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener insumos' });
  }
}

async function crear(req, res) {
  try {
    const { nombre, unidad_medida, stock_minimo } = req.body;
    const nuevoInsumo = await insumosRepository.crear({ nombre, unidad_medida, stock_minimo });
    res.status(201).json(nuevoInsumo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear insumo' });
  }
}

async function ajustarStockManual(req, res) {
  try {
    const { id } = req.params;
    const { cantidad, motivo } = req.body;

    if (!cantidad || cantidad === 0) {
      return res.status(400).json({ error: 'La cantidad debe ser distinta de cero' });
    }

    const insumoActualizado = await insumosRepository.ajustarStock(id, cantidad);

    if (!insumoActualizado) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    console.log(`Ajuste manual de stock — Insumo #${id}: ${cantidad > 0 ? '+' : ''}${cantidad}. Motivo: ${motivo || 'sin especificar'}`);

    res.json(insumoActualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al ajustar stock' });
  }
}
async function alternarActivo(req, res) {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    const insumoActualizado = await insumosRepository.alternarActivo(id, activo);

    if (!insumoActualizado) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    res.json(insumoActualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el insumo' });
  }
}
async function actualizarStockMinimo(req, res) {
  try {
    const { id } = req.params;
    const { stock_minimo } = req.body;

    const insumoActualizado = await insumosRepository.actualizarStockMinimo(id, stock_minimo);

    if (!insumoActualizado) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    res.json(insumoActualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el stock mínimo' });
  }
}
module.exports = { listar, crear, ajustarStockManual, alternarActivo, actualizarStockMinimo };