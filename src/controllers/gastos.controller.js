const gastosRepository = require('../repositories/gastos.repository.js');
const gastosRecurrentesRepository = require('../repositories/gastosRecurrentes.repository.js');
const { ErrorNegocio, responderError } = require('../utils/errores.js');
const { esFechaISO } = require('../utils/validaciones.js');
const { validarGasto, validarClasificacion, validarRecurrente, CATEGORIAS } = require('../utils/gastos.js');

function leerId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('Id inválido');
  return id;
}

async function listar(req, res) {
  try {
    const { desde, hasta } = req.query;

    if (desde && hasta) {
      if (!esFechaISO(desde) || !esFechaISO(hasta)) {
        return res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD' });
      }
      const gastos = await gastosRepository.obtenerPorRangoFechas(desde, hasta, req.sucursalId);
      return res.json(gastos);
    }

    const gastos = await gastosRepository.obtenerTodos(req.sucursalId);
    res.json(gastos);
  } catch (error) {
    responderError(res, error, 'Error al obtener gastos');
  }
}

// Las categorías sugeridas y su tipo por defecto, para armar el formulario.
function listarCategorias(req, res) {
  res.json(CATEGORIAS);
}

async function crear(req, res) {
  try {
    const datos = validarGasto(req.body);
    const nuevoGasto = await gastosRepository.crear(datos, req.sucursalId);
    res.status(201).json(nuevoGasto);
  } catch (error) {
    responderError(res, error, 'Error al crear gasto');
  }
}

async function clasificar(req, res) {
  try {
    const id = leerId(req);
    const datos = validarClasificacion(req.body);
    const gasto = await gastosRepository.clasificar(id, datos, req.sucursalId);
    if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });
    res.json(gasto);
  } catch (error) {
    responderError(res, error, 'Error al clasificar el gasto');
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const gastoEliminado = await gastosRepository.eliminar(id, req.sucursalId);

    if (!gastoEliminado) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    res.json({ mensaje: 'Gasto eliminado', gasto: gastoEliminado });
  } catch (error) {
    responderError(res, error, 'Error al eliminar gasto');
  }
}

// ---- Gastos recurrentes (plantilla mensual) ----
async function listarRecurrentes(req, res) {
  try {
    res.json(await gastosRecurrentesRepository.listar(req.sucursalId));
  } catch (error) {
    responderError(res, error, 'Error al obtener los gastos recurrentes');
  }
}

async function crearRecurrente(req, res) {
  try {
    const datos = validarRecurrente(req.body);
    res.status(201).json(await gastosRecurrentesRepository.crear(datos, req.sucursalId));
  } catch (error) {
    responderError(res, error, 'Error al crear el gasto recurrente');
  }
}

async function eliminarRecurrente(req, res) {
  try {
    const eliminado = await gastosRecurrentesRepository.eliminar(leerId(req), req.sucursalId);
    if (!eliminado) return res.status(404).json({ error: 'Gasto recurrente no encontrado' });
    res.json({ mensaje: 'Gasto recurrente eliminado' });
  } catch (error) {
    responderError(res, error, 'Error al eliminar el gasto recurrente');
  }
}

async function cargarRecurrentes(req, res) {
  try {
    const { fecha } = req.body || {};
    if (!esFechaISO(fecha)) throw new ErrorNegocio('La fecha es obligatoria (AAAA-MM-DD)');
    res.json(await gastosRecurrentesRepository.cargarDelMes(fecha, req.sucursalId));
  } catch (error) {
    responderError(res, error, 'Error al cargar los gastos recurrentes');
  }
}

module.exports = { listar, listarCategorias, crear, clasificar, eliminar, listarRecurrentes, crearRecurrente, eliminarRecurrente, cargarRecurrentes };
