const clientesRepository = require('../repositories/clientes.repository.js');
const { ErrorNegocio, responderError } = require('../utils/errores.js');
const { esTexto, textoOpcional, normalizarCuit, esCuitValido } = require('../utils/validaciones.js');

function validarDatosCliente(body) {
  const { nombre, telefono, direccion, cuit } = body || {};

  if (!esTexto(nombre, { max: 120 })) throw new ErrorNegocio('El nombre del cliente es obligatorio');
  if (!esTexto(telefono, { max: 30 })) throw new ErrorNegocio('El teléfono es obligatorio');

  const datos = {
    nombre: nombre.trim(),
    telefono: telefono.trim(),
    direccion: textoOpcional(direccion, 200)
  };

  // CUIT opcional: si no viene en el cuerpo no se toca; si viene vacío se borra; si viene, tiene que ser válido.
  if (cuit !== undefined) {
    const cuitNormalizado = normalizarCuit(cuit);
    if (cuitNormalizado && !esCuitValido(cuitNormalizado)) {
      throw new ErrorNegocio('El CUIT no es válido');
    }
    datos.cuit = cuitNormalizado;
  }

  return datos;
}

// Mensaje claro según qué dato repetido rechazó la base (teléfono o CUIT).
function mensajeDuplicado(error) {
  return String(error.constraint || '').includes('cuit')
    ? 'Ya existe un cliente con ese CUIT'
    : 'Ya existe un cliente con ese teléfono';
}

async function listar(req, res) {
  try {
    const clientes = await clientesRepository.obtenerTodos();
    res.json(clientes);
  } catch (error) {
    responderError(res, error, 'Error al obtener clientes');
  }
}

async function obtenerUno(req, res) {
  try {
    const { id } = req.params;
    const cliente = await clientesRepository.obtenerPorId(id);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
  } catch (error) {
    responderError(res, error, 'Error al obtener cliente');
  }
}

async function crear(req, res) {
  try {
    const datos = validarDatosCliente(req.body);

    const nuevoCliente = await clientesRepository.crear(datos);

    res.status(201).json(nuevoCliente);
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ error: mensajeDuplicado(error) });
    }
    responderError(res, error, 'Error al crear cliente');
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const datos = validarDatosCliente(req.body);

    const clienteActualizado = await clientesRepository.actualizar(id, datos);

    if (!clienteActualizado) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(clienteActualizado);
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ error: mensajeDuplicado(error) });
    }
    responderError(res, error, 'Error al actualizar cliente');
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const clienteEliminado = await clientesRepository.eliminar(id);

    if (!clienteEliminado) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json({ mensaje: 'Cliente eliminado', cliente: clienteEliminado });
  } catch (error) {
    responderError(res, error, 'Error al eliminar cliente');
  }
}
async function buscarPorTelefono(req, res) {
  try {
    const { telefono } = req.params;
    const cliente = await clientesRepository.obtenerPorTelefono(telefono);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
  } catch (error) {
    responderError(res, error, 'Error al buscar cliente');
  }
}

module.exports = { listar, obtenerUno, crear, actualizar, eliminar, buscarPorTelefono };
