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
    if (typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.length > 100 ||
        typeof unidad_medida !== 'string' || unidad_medida.trim().length < 1 ||
        !Number.isFinite(Number(stock_minimo)) || Number(stock_minimo) < 0) {
      return res.status(400).json({ error: 'Datos de insumo inválidos' });
    }
    const nuevoInsumo = await insumosRepository.crear({ nombre: nombre.trim(), unidad_medida: unidad_medida.trim(), stock_minimo });
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

    if (!Number.isFinite(Number(cantidad)) || Number(cantidad) === 0) {
      return res.status(400).json({ error: 'La cantidad debe ser distinta de cero' });
    }

    const insumoActualizado = await insumosRepository.ajustarStock(id, Number(cantidad));

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
    if (typeof activo !== 'boolean') return res.status(400).json({ error: 'Estado inválido' });

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
    if (!Number.isFinite(Number(stock_minimo)) || Number(stock_minimo) < 0) {
      return res.status(400).json({ error: 'Stock mínimo inválido' });
    }

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

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, unidad_medida } = req.body;

    const insumoActualizado = await insumosRepository.actualizar(id, { nombre, unidad_medida });

    if (!insumoActualizado) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    res.json(insumoActualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el insumo' });
  }
}

module.exports = { listar, crear, ajustarStockManual, alternarActivo, actualizarStockMinimo, actualizar };