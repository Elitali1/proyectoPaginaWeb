requiereAdmin();

const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

const usuario = JSON.parse(localStorage.getItem('usuario'));
document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-clientes', 'link-caja', 'link-usuarios']);

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

let editandoId = null;
let clientesCache = [];

async function cargarClientes() {
  const respuesta = await fetch(`${API_URL}/clientes`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  clientesCache = await respuesta.json();
  mostrarClientes(clientesCache);
}

function mostrarClientes(clientes) {
  const contenedor = document.getElementById('contenedor-clientes');
  contenedor.innerHTML = '';

  if (clientes.length === 0) {
    contenedor.innerHTML = '<p>No hay clientes cargados todavía.</p>';
    return;
  }

  clientes.forEach(cliente => {
    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${cliente.nombre}</strong> - ${cliente.telefono}<br>
      ${cliente.direccion ? `Dirección: ${cliente.direccion}<br>` : ''}
      ${cliente.cuit ? `CUIT: ${cliente.cuit}<br>` : ''}
      <button type="button" class="btn-editar-cliente" data-id="${cliente.id}" data-nombre="${cliente.nombre}" data-telefono="${cliente.telefono}" data-direccion="${cliente.direccion || ''}" data-cuit="${cliente.cuit || ''}">Editar</button>
    `;
    contenedor.appendChild(div);
  });

  document.querySelectorAll('.btn-editar-cliente').forEach(boton => {
    boton.addEventListener('click', () => {
      editandoId = boton.dataset.id;
      document.getElementById('cliente-nombre').value = boton.dataset.nombre;
      document.getElementById('cliente-telefono').value = boton.dataset.telefono;
      document.getElementById('cliente-direccion').value = boton.dataset.direccion;
      document.getElementById('cliente-cuit').value = boton.dataset.cuit;
      document.getElementById('titulo-formulario-cliente').textContent = 'Editar cliente';
      document.getElementById('btn-guardar-cliente').textContent = 'Guardar cambios';
      document.getElementById('btn-cancelar-edicion-cliente').classList.remove('oculto');
      document.getElementById('formulario-cliente').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

document.getElementById('buscador-clientes').addEventListener('input', (event) => {
  const texto = event.target.value.toLowerCase();
  const filtrados = clientesCache.filter(c =>
    c.nombre.toLowerCase().includes(texto) || c.telefono.includes(texto)
  );
  mostrarClientes(filtrados);
});

document.getElementById('btn-cancelar-edicion-cliente').addEventListener('click', () => {
  editandoId = null;
  document.getElementById('formulario-cliente').reset();
  document.getElementById('titulo-formulario-cliente').textContent = 'Agregar cliente';
  document.getElementById('btn-guardar-cliente').textContent = 'Guardar cliente';
  document.getElementById('btn-cancelar-edicion-cliente').classList.add('oculto');
});

document.getElementById('formulario-cliente').addEventListener('submit', async (event) => {
  event.preventDefault();

  const datosCliente = {
    nombre: document.getElementById('cliente-nombre').value,
    telefono: document.getElementById('cliente-telefono').value,
    direccion: document.getElementById('cliente-direccion').value || null,
    cuit: document.getElementById('cliente-cuit').value || null
  };

  if (editandoId) {
    await fetch(`${API_URL}/clientes/${editandoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(datosCliente)
    });

    editandoId = null;
    document.getElementById('titulo-formulario-cliente').textContent = 'Agregar cliente';
    document.getElementById('btn-guardar-cliente').textContent = 'Guardar cliente';
    document.getElementById('btn-cancelar-edicion-cliente').classList.add('oculto');
  } else {
    const respuesta = await fetch(`${API_URL}/clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(datosCliente)
    });

    if (!respuesta.ok) {
      const error = await respuesta.json();
      alert(error.error || 'Error al crear el cliente (¿el teléfono ya existe?)');
      return;
    }
  }

  document.getElementById('formulario-cliente').reset();
  cargarClientes();
});

cargarClientes();