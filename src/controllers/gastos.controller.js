const gastosRepository = require('../repositories/gastos.repository.js');
const { ErrorNegocio, responderError } = require('../utils/errores.js');
const { esTexto, esNumero, esFechaISO, textoOpcional } = require('../utils/validaciones.js');

async function listar(req, res) {
  try {
    const { desde, hasta } = req.query;

    if (desde && hasta) {
      if (!esFechaISO(desde) || !esFechaISO(hasta)) {
        return res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD' });
      }
      const gastos = await gastosRepository.obtenerPorRangoFechas(desde, hasta);
      return res.json(gastos);
    }

    const gastos = await gastosRepository.obtenerTodos();
    res.json(gastos);
  } catch (error) {
    responderError(res, error, 'Error al obtener gastos');
  }
}

async function crear(req, res) {
  try {
    const { concepto, categoria, monto, fecha } = req.body || {};

    if (!esTexto(concepto, { max: 200 })) throw new ErrorNegocio('El concepto es obligatorio');
    if (!esNumero(monto) || Number(monto) <= 0) throw new ErrorNegocio('El monto debe ser un número mayor a cero');
    if (!esFechaISO(fecha)) throw new ErrorNegocio('La fecha es obligatoria (AAAA-MM-DD)');

    const nuevoGasto = await gastosRepository.crear({
      concepto: concepto.trim(),
      categoria: textoOpcional(categoria, 100),
      monto: Number(monto),
      fecha
    });
    res.status(201).json(nuevoGasto);
  } catch (error) {
    responderError(res, error, 'Error al crear gasto');
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
    responderError(res, error, 'Error al eliminar gasto');
  }
}

module.exports = { listar, crear, eliminar };
