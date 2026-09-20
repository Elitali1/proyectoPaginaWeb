const gastosRepository = require('../repositories/gastos.repository.js');

async function listar(req, res) {
  try {
    const { desde, hasta } = req.query;

    if (desde && hasta) {
      const gastos = await gastosRepository.obtenerPorRangoFechas(desde, hasta);
      return res.json(gastos);
    }

    const gastos = await gastosRepository.obtenerTodos();
    res.json(gastos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
}

async function crear(req, res) {
  try {
    const { concepto, categoria, monto, fecha } = req.body;
    if (typeof concepto !== 'string' || concepto.trim().length < 2 ||
        typeof categoria !== 'string' || categoria.trim().length < 2 ||
        !Number.isFinite(Number(monto)) || Number(monto) <= 0 ||
        !fecha || Number.isNaN(new Date(fecha).getTime())) {
      return res.status(400).json({ error: 'Datos de gasto inválidos' });
    }
    const nuevoGasto = await gastosRepository.crear({ concepto: concepto.trim(), categoria: categoria.trim(), monto, fecha });
    res.status(201).json(nuevoGasto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const gastoEliminado = await gastosRepository.eliminar(id);

    if (!gastoEliminado) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    res.json({ mensaje: 'Gasto eliminado', gasto: gastoEliminado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
}

module.exports = { listar, crear, eliminar };