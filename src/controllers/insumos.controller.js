const insumosRepository = require('../repositories/insumos.repository.js');
const { ErrorNegocio, responderError } = require('../utils/errores.js');
const { esTexto, esNumero, textoOpcional } = require('../utils/validaciones.js');

async function listar(req, res) {
  try {
    const insumos = await insumosRepository.obtenerTodos();
    res.json(insumos);
  } catch (error) {
    responderError(res, error, 'Error al obtener insumos');
  }
}

function validarStockMinimo(valor) {
  if (valor === undefined || valor === null || valor === '') return 0;
  if (!esNumero(valor) || Number(valor) < 0) {
    throw new ErrorNegocio('El stock mínimo debe ser un número mayor o igual a cero');
  }
  return Number(valor);
}

function validarDatosInsumo(body) {
  if (!esTexto(body.nombre, { max: 100 })) throw new ErrorNegocio('El nombre del insumo es obligatorio');
  if (!esTexto(body.unidad_medida, { max: 30 })) throw new ErrorNegocio('La unidad de medida es obligatoria');
  return { nombre: body.nombre.trim(), unidad_medida: body.unidad_medida.trim() };
}

async function crear(req, res) {
  try {
    const datos = validarDatosInsumo(req.body);
    const stock_minimo = validarStockMinimo(req.body.stock_minimo);
    const nuevoInsumo = await insumosRepository.crear({ ...datos, stock_minimo });
    res.status(201).json(nuevoInsumo);
  } catch (error) {
    responderError(res, error, 'Error al crear insumo');
  }
}

async function ajustarStockManual(req, res) {
  try {
    const { id } = req.params;
    const { cantidad, motivo } = req.body;

    if (!esNumero(cantidad) || Number(cantidad) === 0) {
      return res.status(400).json({ error: 'La cantidad debe ser un número distinto de cero' });
    }

    const delta = Number(cantidad);
    const insumoActualizado = await insumosRepository.ajustarStockManual(id, delta);

    if (!insumoActualizado) {
      const existente = await insumosRepository.obtenerPorId(id);
      if (!existente) return res.status(404).json({ error: 'Insumo no encontrado' });
      return res.status(400).json({ error: `No se puede descontar ${Math.abs(delta)}: el stock actual es ${existente.stock_actual}` });
    }

    console.log(`Ajuste manual de stock — Insumo #${id} por usuario #${req.usuario.id}: ${delta > 0 ? '+' : ''}${delta}. Motivo: ${textoOpcional(motivo, 200) || 'sin especificar'}`);

    res.json(insumoActualizado);
  } catch (error) {
    responderError(res, error, 'Error al ajustar stock');
  }
}
async function alternarActivo(req, res) {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El campo activo debe ser verdadero o falso' });
    }

    const insumoActualizado = await insumosRepository.alternarActivo(id, activo);

    if (!insumoActualizado) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    res.json(insumoActualizado);
  } catch (error) {
    responderError(res, error, 'Error al actualizar el insumo');
  }
}
async function actualizarStockMinimo(req, res) {
  try {
    const { id } = req.params;
    const stock_minimo = validarStockMinimo(req.body.stock_minimo);

    const insumoActualizado = await insumosRepository.actualizarStockMinimo(id, stock_minimo);

    if (!insumoActualizado) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    res.json(insumoActualizado);
  } catch (error) {
    responderError(res, error, 'Error al actualizar el stock mínimo');
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const datos = validarDatosInsumo(req.body);

    const insumoActualizado = await insumosRepository.actualizar(id, datos);

    if (!insumoActualizado) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    res.json(insumoActualizado);
  } catch (error) {
    responderError(res, error, 'Error al actualizar el insumo');
  }
}

module.exports = { listar, crear, ajustarStockManual, alternarActivo, actualizarStockMinimo, actualizar };
