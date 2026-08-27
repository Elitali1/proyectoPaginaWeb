const clientesRepository = require('../repositories/clientes.repository.js');

async function listar(req, res) {
  try {
    const clientes = await clientesRepository.obtenerTodos();
    res.json(clientes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener clientes' });
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
    console.error(error);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
}

async function crear(req, res) {
  try {
    const { nombre, telefono, direccion } = req.body;

    const nuevoCliente = await clientesRepository.crear({ nombre, telefono, direccion });

    res.status(201).json(nuevoCliente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, telefono, direccion } = req.body;

    const clienteActualizado = await clientesRepository.actualizar(id, { nombre, telefono, direccion });

    if (!clienteActualizado) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(clienteActualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar cliente' });
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
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
}

module.exports = { listar, obtenerUno, crear, actualizar, eliminar };