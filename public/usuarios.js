requiereAdmin();

const API_URL = window.location.origin;

const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!usuario) {
  window.location.href = 'login.html';
}

document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-caja', 'link-usuarios', 'link-sucursales', 'link-clientes', 'link-dashboard']);

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch(`${API_URL}/usuarios/logout`, {
    method: 'POST',
    credentials: 'include'
  });
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

let editandoId = null;

// Sucursales para el selector. Mientras haya una sola, el campo queda oculto y todo se ve como siempre.
let sucursales = [];

// ---- Estado de la tabla (buscador, filtro por rol y paginación) ----
const USUARIOS_POR_PAGINA = 10;
let todosLosUsuarios = [];
let usuariosCargados = false;
const filtros = { texto: '', rol: 'todos', pagina: 1 };

// Para buscar sin importar mayúsculas ni tildes.
function normalizarTexto(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function cargarSucursales() {
  const respuesta = await fetch(`${API_URL}/usuarios/sucursales`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return;
  if (!respuesta.ok) return; // sin lista, el panel sigue funcionando (el servidor asigna la sucursal por defecto)

  sucursales = await respuesta.json();

  const select = document.getElementById('sucursal');
  select.innerHTML = '';
  sucursales.forEach(s => {
    const opcion = document.createElement('option');
    opcion.value = s.id;
    opcion.textContent = s.activa ? s.nombre : `${s.nombre} (inactiva)`;
    select.appendChild(opcion);
  });

  document.getElementById('campo-sucursal').classList.toggle('oculto', sucursales.length <= 1);
  elegirSucursalPorDefecto();
}

// Al crear un usuario nuevo, por defecto va a la sucursal del administrador que lo está creando.
function elegirSucursalPorDefecto() {
  const select = document.getElementById('sucursal');
  if (usuario.sucursal_id && [...select.options].some(o => Number(o.value) === Number(usuario.sucursal_id))) {
    select.value = String(usuario.sucursal_id);
  }
}

function nombreDeSucursal(id) {
  const encontrada = sucursales.find(s => Number(s.id) === Number(id));
  return encontrada ? encontrada.nombre : `Sucursal ${id}`;
}

// Valor a enviar al servidor: solo si el selector tiene opciones (si no, no se manda y el servidor decide).
function sucursalElegida() {
  const select = document.getElementById('sucursal');
  return select.options.length > 0 ? Number(select.value) : undefined;
}

async function cargarUsuarios() {
  const respuesta = await fetch(`${API_URL}/usuarios`, {
    credentials: 'include'
  });

  if (manejarNoAutorizado(respuesta)) return;

  todosLosUsuarios = await respuesta.json();
  usuariosCargados = true;
  mostrarUsuarios();
}

function usuariosFiltrados() {
  const texto = normalizarTexto(filtros.texto.trim());
  return todosLosUsuarios.filter(u => {
    if (filtros.rol !== 'todos' && u.rol !== filtros.rol) return false;
    if (texto && !(normalizarTexto(u.nombre).includes(texto) || normalizarTexto(u.email).includes(texto))) return false;
    return true;
  });
}

function mostrarUsuarios() {
  if (!usuariosCargados) return;

  const muestraSucursal = sucursales.length > 1;
  document.getElementById('columna-sucursal').classList.toggle('oculto', !muestraSucursal);

  // Botones de rol con su cantidad (los que existan en la lista).
  const roles = [...new Set(todosLosUsuarios.map(u => u.rol))];
  const chips = document.getElementById('chips-rol');
  chips.innerHTML = '';
  [{ id: 'todos', nombre: 'Todos', cantidad: todosLosUsuarios.length }].concat(
    roles.map(r => ({ id: r, nombre: r, cantidad: todosLosUsuarios.filter(u => u.rol === r).length }))
  ).forEach(opcion => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'chip';
    boton.dataset.rol = opcion.id;
    boton.setAttribute('aria-pressed', String(filtros.rol === opcion.id));
    boton.textContent = `${opcion.nombre} ${opcion.cantidad}`;
    chips.appendChild(boton);
  });

  const filtrados = usuariosFiltrados();
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / USUARIOS_POR_PAGINA));
  if (filtros.pagina > totalPaginas) filtros.pagina = totalPaginas;
  const desde = (filtros.pagina - 1) * USUARIOS_POR_PAGINA;
  const visibles = filtrados.slice(desde, desde + USUARIOS_POR_PAGINA);

  const contenedor = document.getElementById('contenedor-usuarios');
  contenedor.innerHTML = '';

  visibles.forEach(u => {
    const fila = document.createElement('tr');
    fila.dataset.id = u.id;
    const esElMismo = Number(u.id) === usuario.id;
    fila.innerHTML = `
      <td><strong>${escapeHtml(u.nombre)}</strong>${esElMismo ? '<small>Sos vos</small>' : ''}</td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="estado ${u.rol === 'admin' ? 'estado-ok' : ''}">${escapeHtml(u.rol)}</span></td>
      ${muestraSucursal ? `<td>${escapeHtml(nombreDeSucursal(u.sucursal_id))}</td>` : ''}
      <td class="col-acciones">
        <button type="button" class="btn-tabla btn-editar-usuario" data-id="${u.id}" data-nombre="${escapeHtml(u.nombre)}" data-email="${escapeHtml(u.email)}" data-rol="${escapeHtml(u.rol)}" data-sucursal="${u.sucursal_id ?? ''}" aria-label="Editar ${escapeHtml(u.nombre)}">Editar</button>
        <button type="button" class="btn-tabla btn-peligro btn-eliminar" data-id="${u.id}" data-nombre="${escapeHtml(u.nombre)}">Eliminar</button>
      </td>
    `;
    contenedor.appendChild(fila);
  });

  marcarFilaEditando();

  document.getElementById('sin-usuarios').classList.toggle('oculto', todosLosUsuarios.length > 0);
  document.getElementById('sin-resultados-usuarios').classList.toggle('oculto', todosLosUsuarios.length === 0 || filtrados.length > 0);

  document.getElementById('rango-usuarios').textContent = filtrados.length === 0
    ? 'Sin resultados'
    : `Mostrando ${desde + 1} a ${desde + visibles.length} de ${filtrados.length}`;

  const paginacion = document.getElementById('paginacion-usuarios');
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

// Resalta en la tabla el usuario que se está editando.
function marcarFilaEditando() {
  document.querySelectorAll('#contenedor-usuarios tr').forEach(fila => {
    fila.classList.toggle('fila-editando', editandoId !== null && String(fila.dataset.id) === String(editandoId));
  });
}

// ---- Buscador, filtro por rol y paginación ----
document.getElementById('buscar-usuario').addEventListener('input', (event) => {
  filtros.texto = event.target.value;
  filtros.pagina = 1;
  mostrarUsuarios();
});

document.getElementById('chips-rol').addEventListener('click', (event) => {
  const boton = event.target.closest('button[data-rol]');
  if (!boton) return;
  filtros.rol = boton.dataset.rol;
  filtros.pagina = 1;
  mostrarUsuarios();
});

document.getElementById('paginacion-usuarios').addEventListener('click', (event) => {
  const boton = event.target.closest('button[data-pagina]');
  if (!boton || boton.disabled) return;
  filtros.pagina = Number(boton.dataset.pagina);
  mostrarUsuarios();
});

document.getElementById('btn-limpiar-filtros-usuarios').addEventListener('click', () => {
  filtros.texto = '';
  filtros.rol = 'todos';
  filtros.pagina = 1;
  document.getElementById('buscar-usuario').value = '';
  mostrarUsuarios();
});

// ---- Panel de Crear / Editar ----
const panelUsuario = document.getElementById('panel-usuario');

function mostrarMensajePanel(texto) {
  const mensaje = document.getElementById('mensaje-panel-usuario');
  mensaje.textContent = texto;
  mensaje.classList.remove('oculto');
}

function ocultarMensajePanel() {
  document.getElementById('mensaje-panel-usuario').classList.add('oculto');
}

function abrirPanel() {
  ocultarMensajePanel();
  panelUsuario.classList.remove('oculto');
  marcarFilaEditando();
  panelUsuario.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cerrarPanel() {
  editandoId = null;
  document.getElementById('formulario-usuario').reset();
  elegirSucursalPorDefecto();
  document.getElementById('titulo-formulario').textContent = 'Crear nuevo usuario';
  document.getElementById('btn-guardar').textContent = 'Crear usuario';
  document.getElementById('etiqueta-password-opcional').textContent = '';
  ocultarMensajePanel();
  panelUsuario.classList.add('oculto');
  marcarFilaEditando();
}

document.getElementById('btn-agregar-usuario').addEventListener('click', () => {
  cerrarPanel();
  abrirPanel();
  document.getElementById('nombre').focus();
});

// Cancelar y Cerrar hacen lo mismo: descartan lo escrito y cierran el panel.
document.getElementById('btn-cancelar-edicion').addEventListener('click', cerrarPanel);
document.getElementById('btn-cerrar-panel-usuario').addEventListener('click', cerrarPanel);

// Botones de cada fila: Editar y Eliminar.
document.getElementById('contenedor-usuarios').addEventListener('click', async (event) => {
  const botonEditar = event.target.closest('button.btn-editar-usuario');
  if (botonEditar) {
    editandoId = botonEditar.dataset.id;
    document.getElementById('nombre').value = botonEditar.dataset.nombre;
    document.getElementById('email').value = botonEditar.dataset.email;
    document.getElementById('rol').value = botonEditar.dataset.rol;
    if (botonEditar.dataset.sucursal) document.getElementById('sucursal').value = botonEditar.dataset.sucursal;
    document.getElementById('password').value = '';
    document.getElementById('titulo-formulario').textContent = 'Editar usuario';
    document.getElementById('btn-guardar').textContent = 'Guardar cambios';
    document.getElementById('etiqueta-password-opcional').textContent = ' (dejar vacío para no cambiarla)';
    abrirPanel();
    return;
  }

  const botonEliminar = event.target.closest('button.btn-eliminar');
  if (botonEliminar) {
    const id = botonEliminar.dataset.id;

    if (Number(id) === usuario.id) {
      alert('No podés eliminar tu propio usuario');
      return;
    }

    if (!confirm(`¿Eliminar al usuario "${botonEliminar.dataset.nombre}"? Ya no va a poder entrar al sistema.`)) return;

    const respuestaBorrar = await fetch(`${API_URL}/usuarios/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (manejarNoAutorizado(respuestaBorrar)) return;

    if (!respuestaBorrar.ok) {
      const error = await respuestaBorrar.json().catch(() => ({}));
      alert(error.error || 'No se pudo eliminar el usuario');
    }
    cargarUsuarios();
  }
});

document.getElementById('formulario-usuario').addEventListener('submit', async (event) => {
  event.preventDefault();
  ocultarMensajePanel();

  const nombre = document.getElementById('nombre').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const rol = document.getElementById('rol').value;

  if (editandoId) {
    const datosUsuario = { nombre, email, rol, sucursal_id: sucursalElegida() };
    if (password) {
      datosUsuario.password = password;
    }

    const respuesta = await fetch(`${API_URL}/usuarios/${editandoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(datosUsuario)
    });

    if (manejarNoAutorizado(respuesta)) return;

    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      mostrarMensajePanel(error.error || 'Error al actualizar el usuario');
      return;
    }
  } else {
    if (!password) {
      mostrarMensajePanel('La contraseña es obligatoria para crear un usuario nuevo');
      return;
    }

    const respuesta = await fetch(`${API_URL}/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ nombre, email, password, rol, sucursal_id: sucursalElegida() })
    });

    if (manejarNoAutorizado(respuesta)) return;

    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      mostrarMensajePanel(error.error || 'Error al crear el usuario');
      return;
    }
  }

  // Si salió bien, el panel se cierra y la tabla se actualiza.
  cerrarPanel();
  cargarUsuarios();
});

// Primero las sucursales (para poder mostrar el nombre en la lista) y después los usuarios.
cargarSucursales().catch(() => {}).then(cargarUsuarios);
