requiereAdmin();

const API_URL = window.location.origin;

const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!usuario) {
  window.location.href = 'login.html';
}

document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-clientes', 'link-caja', 'link-usuarios', 'link-sucursales', 'link-dashboard']);

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch(`${API_URL}/usuarios/logout`, {
    method: 'POST',
    credentials: 'include'
  });
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

let editandoId = null;
let clientesCache = [];
let clientesCargados = false;

// ---- Buscador y paginación (se hacen en el navegador, con la lista que ya se descargó) ----
const CLIENTES_POR_PAGINA = 10;
const filtros = { texto: '', pagina: 1 };

// Para buscar sin importar mayúsculas ni tildes.
function normalizarTexto(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function cargarClientes() {
  const respuesta = await fetch(`${API_URL}/clientes`, {
    credentials: 'include'
  });

  if (manejarNoAutorizado(respuesta)) return;

  clientesCache = await respuesta.json();
  clientesCargados = true;
  mostrarClientes();
}

function clientesFiltrados() {
  const texto = normalizarTexto(filtros.texto.trim());
  const soloDigitos = filtros.texto.replace(/\D/g, '');
  if (!texto) return clientesCache;

  return clientesCache.filter(c =>
    normalizarTexto(c.nombre).includes(texto) ||
    String(c.telefono || '').includes(filtros.texto.trim()) ||
    (soloDigitos && String(c.telefono || '').replace(/\D/g, '').includes(soloDigitos))
  );
}

function mostrarClientes() {
  if (!clientesCargados) return;

  const filtrados = clientesFiltrados();
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / CLIENTES_POR_PAGINA));
  if (filtros.pagina > totalPaginas) filtros.pagina = totalPaginas;
  const desde = (filtros.pagina - 1) * CLIENTES_POR_PAGINA;
  const visibles = filtrados.slice(desde, desde + CLIENTES_POR_PAGINA);

  const contenedor = document.getElementById('contenedor-clientes');
  contenedor.innerHTML = '';

  visibles.forEach(cliente => {
    const fila = document.createElement('tr');
    fila.dataset.id = cliente.id;
    fila.innerHTML = `
      <td><strong>${escapeHtml(cliente.nombre)}</strong></td>
      <td>${escapeHtml(cliente.telefono)}</td>
      <td class="col-suave">${cliente.direccion ? escapeHtml(cliente.direccion) : '—'}</td>
      <td class="col-suave">${cliente.cuit ? escapeHtml(cliente.cuit) : '—'}</td>
      <td class="col-acciones">
        <button type="button" class="btn-tabla btn-editar-cliente" data-id="${cliente.id}" data-nombre="${escapeHtml(cliente.nombre)}" data-telefono="${escapeHtml(cliente.telefono)}" data-direccion="${escapeHtml(cliente.direccion)}" data-cuit="${escapeHtml(cliente.cuit)}" aria-label="Editar ${escapeHtml(cliente.nombre)}">Editar</button>
      </td>
    `;
    contenedor.appendChild(fila);
  });

  marcarFilaEditando();

  document.getElementById('sin-clientes').classList.toggle('oculto', clientesCache.length > 0);
  document.getElementById('sin-resultados-clientes').classList.toggle('oculto', clientesCache.length === 0 || filtrados.length > 0);

  document.getElementById('rango-clientes').textContent = filtrados.length === 0
    ? 'Sin resultados'
    : `Mostrando ${desde + 1} a ${desde + visibles.length} de ${filtrados.length}`;

  const paginacion = document.getElementById('paginacion-clientes');
  paginacion.innerHTML = '';
  const agregarBotonPagina = (textoBoton, pagina, { activa = false, deshabilitada = false, etiqueta = '' } = {}) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'pagina';
    boton.dataset.pagina = pagina;
    boton.textContent = textoBoton;
    boton.disabled = deshabilitada;
    if (etiqueta) boton.setAttribute('aria-label', etiqueta);
    if (activa) boton.setAttribute('aria-current', 'page');
    paginacion.appendChild(boton);
  };
  agregarBotonPagina('Anterior', filtros.pagina - 1, { deshabilitada: filtros.pagina <= 1 });
  for (let n = 1; n <= totalPaginas; n++) {
    agregarBotonPagina(String(n), n, { activa: n === filtros.pagina, etiqueta: `Página ${n}` });
  }
  agregarBotonPagina('Siguiente', filtros.pagina + 1, { deshabilitada: filtros.pagina >= totalPaginas });
}

// Resalta en la tabla el cliente que se está editando.
function marcarFilaEditando() {
  document.querySelectorAll('#contenedor-clientes tr').forEach(fila => {
    fila.classList.toggle('fila-editando', editandoId !== null && String(fila.dataset.id) === String(editandoId));
  });
}

document.getElementById('buscador-clientes').addEventListener('input', (event) => {
  filtros.texto = event.target.value;
  filtros.pagina = 1;
  mostrarClientes();
});

document.getElementById('btn-limpiar-busqueda-clientes').addEventListener('click', () => {
  filtros.texto = '';
  filtros.pagina = 1;
  document.getElementById('buscador-clientes').value = '';
  mostrarClientes();
});

document.getElementById('paginacion-clientes').addEventListener('click', (event) => {
  const boton = event.target.closest('button[data-pagina]');
  if (!boton || boton.disabled) return;
  filtros.pagina = Number(boton.dataset.pagina);
  mostrarClientes();
});

// ---- Panel de Agregar / Editar ----
const panelCliente = document.getElementById('panel-cliente');

function mostrarMensajePanel(texto) {
  const mensaje = document.getElementById('mensaje-panel-cliente');
  mensaje.textContent = texto;
  mensaje.classList.remove('oculto');
}

function ocultarMensajePanel() {
  document.getElementById('mensaje-panel-cliente').classList.add('oculto');
}

function abrirPanel() {
  ocultarMensajePanel();
  panelCliente.classList.remove('oculto');
  marcarFilaEditando();
  panelCliente.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cerrarPanel() {
  editandoId = null;
  document.getElementById('formulario-cliente').reset();
  document.getElementById('titulo-formulario-cliente').textContent = 'Agregar cliente';
  document.getElementById('btn-guardar-cliente').textContent = 'Guardar cliente';
  ocultarMensajePanel();
  panelCliente.classList.add('oculto');
  marcarFilaEditando();
}

document.getElementById('btn-agregar-cliente').addEventListener('click', () => {
  cerrarPanel();
  abrirPanel();
  document.getElementById('cliente-nombre').focus();
});

// Cancelar edición y Cerrar hacen lo mismo: descartan lo escrito y cierran el panel.
document.getElementById('btn-cancelar-edicion-cliente').addEventListener('click', cerrarPanel);
document.getElementById('btn-cerrar-panel-cliente').addEventListener('click', cerrarPanel);

// Botón Editar de cada fila: carga los datos del cliente en el formulario.
document.getElementById('contenedor-clientes').addEventListener('click', (event) => {
  const boton = event.target.closest('button.btn-editar-cliente');
  if (!boton) return;

  editandoId = boton.dataset.id;
  document.getElementById('cliente-nombre').value = boton.dataset.nombre;
  document.getElementById('cliente-telefono').value = boton.dataset.telefono;
  document.getElementById('cliente-direccion').value = boton.dataset.direccion;
  document.getElementById('cliente-cuit').value = boton.dataset.cuit;
  document.getElementById('titulo-formulario-cliente').textContent = 'Editar cliente';
  document.getElementById('btn-guardar-cliente').textContent = 'Guardar cambios';
  abrirPanel();
});

document.getElementById('formulario-cliente').addEventListener('submit', async (event) => {
  event.preventDefault();
  ocultarMensajePanel();

  const datosCliente = {
    nombre: document.getElementById('cliente-nombre').value,
    telefono: document.getElementById('cliente-telefono').value,
    direccion: document.getElementById('cliente-direccion').value || null,
    cuit: document.getElementById('cliente-cuit').value || null
  };

  if (editandoId) {
    const respuesta = await fetch(`${API_URL}/clientes/${editandoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(datosCliente)
    });

    if (manejarNoAutorizado(respuesta)) return;

    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      mostrarMensajePanel(error.error || 'Error al actualizar el cliente');
      return;
    }
  } else {
    const respuesta = await fetch(`${API_URL}/clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(datosCliente)
    });

    if (manejarNoAutorizado(respuesta)) return;

    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      mostrarMensajePanel(error.error || 'Error al crear el cliente (¿el teléfono ya existe?)');
      return;
    }
  }

  // Si salió bien, el panel se cierra y la tabla se actualiza.
  cerrarPanel();
  cargarClientes();
});

cargarClientes();
