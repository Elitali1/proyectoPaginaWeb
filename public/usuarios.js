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

  const usuarios = await respuesta.json();

  const contenedor = document.getElementById('contenedor-usuarios');
  contenedor.innerHTML = '';

  usuarios.forEach(u => {
    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${escapeHtml(u.nombre)}</strong> - ${escapeHtml(u.email)} (${escapeHtml(u.rol)})${sucursales.length > 1 ? ` · ${escapeHtml(nombreDeSucursal(u.sucursal_id))}` : ''}
      <button type="button" class="btn-editar-usuario" data-id="${u.id}" data-nombre="${escapeHtml(u.nombre)}" data-email="${escapeHtml(u.email)}" data-rol="${escapeHtml(u.rol)}" data-sucursal="${u.sucursal_id ?? ''}">Editar</button>
      <button type="button" class="btn-eliminar" data-id="${u.id}">Eliminar</button>
    `;
    contenedor.appendChild(div);
  });

  document.querySelectorAll('.btn-eliminar').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;

      if (Number(id) === usuario.id) {
        alert('No podés eliminar tu propio usuario');
        return;
      }

      const respuestaBorrar = await fetch(`${API_URL}/usuarios/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!respuestaBorrar.ok) {
        const error = await respuestaBorrar.json().catch(() => ({}));
        alert(error.error || 'No se pudo eliminar el usuario');
      }
      cargarUsuarios();
    });
  });

  document.querySelectorAll('.btn-editar-usuario').forEach(boton => {
    boton.addEventListener('click', () => {
      editandoId = boton.dataset.id;
      document.getElementById('nombre').value = boton.dataset.nombre;
      document.getElementById('email').value = boton.dataset.email;
      document.getElementById('rol').value = boton.dataset.rol;
      if (boton.dataset.sucursal) document.getElementById('sucursal').value = boton.dataset.sucursal;
      document.getElementById('password').value = '';
      document.getElementById('titulo-formulario').textContent = 'Editar usuario';
      document.getElementById('btn-guardar').textContent = 'Guardar cambios';
      document.getElementById('etiqueta-password-opcional').textContent = ' (dejar vacío para no cambiarla)';
      document.getElementById('btn-cancelar-edicion').classList.remove('oculto');
    });
  });
}

document.getElementById('btn-cancelar-edicion').addEventListener('click', () => {
  editandoId = null;
  document.getElementById('formulario-usuario').reset();
  elegirSucursalPorDefecto();
  document.getElementById('titulo-formulario').textContent = 'Crear nuevo usuario';
  document.getElementById('btn-guardar').textContent = 'Crear usuario';
  document.getElementById('etiqueta-password-opcional').textContent = '';
  document.getElementById('btn-cancelar-edicion').classList.add('oculto');
});

document.getElementById('formulario-usuario').addEventListener('submit', async (event) => {
  event.preventDefault();

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
      const error = await respuesta.json();
      alert(error.error || 'Error al actualizar el usuario');
      return;
    }

    editandoId = null;
    document.getElementById('titulo-formulario').textContent = 'Crear nuevo usuario';
    document.getElementById('btn-guardar').textContent = 'Crear usuario';
    document.getElementById('etiqueta-password-opcional').textContent = '';
    document.getElementById('btn-cancelar-edicion').classList.add('oculto');
  } else {
    if (!password) {
      alert('La contraseña es obligatoria para crear un usuario nuevo');
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
      const error = await respuesta.json();
      alert(error.error || 'Error al crear el usuario');
      return;
    }
  }

  document.getElementById('formulario-usuario').reset();
  elegirSucursalPorDefecto();
  cargarUsuarios();
});

// Primero las sucursales (para poder mostrar el nombre en la lista) y después los usuarios.
cargarSucursales().catch(() => {}).then(cargarUsuarios);