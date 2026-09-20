requiereAdmin();

const API_URL = window.location.origin;

const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!usuario) {
  window.location.href = 'login.html';
}

document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-caja', 'link-usuarios', 'link-clientes', 'link-dashboard']);

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch(`${API_URL}/usuarios/logout`, {
    method: 'POST',
    credentials: 'include'
  });
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

let editandoId = null;

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
      <strong>${escaparHtml(u.nombre)}</strong> - ${escaparHtml(u.email)} (${escaparHtml(u.rol)})
      <button type="button" class="btn-editar-usuario" data-id="${u.id}" data-nombre="${escaparHtml(u.nombre)}" data-email="${escaparHtml(u.email)}" data-rol="${escaparHtml(u.rol)}">Editar</button>
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

      await fetch(`${API_URL}/usuarios/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      cargarUsuarios();
    });
  });

  document.querySelectorAll('.btn-editar-usuario').forEach(boton => {
    boton.addEventListener('click', () => {
      editandoId = boton.dataset.id;
      document.getElementById('nombre').value = boton.dataset.nombre;
      document.getElementById('email').value = boton.dataset.email;
      document.getElementById('rol').value = boton.dataset.rol;
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
    const datosUsuario = { nombre, email, rol };
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
      body: JSON.stringify({ nombre, email, password, rol })
    });

    if (manejarNoAutorizado(respuesta)) return;

    if (!respuesta.ok) {
      const error = await respuesta.json();
      alert(error.error || 'Error al crear el usuario');
      return;
    }
  }

  document.getElementById('formulario-usuario').reset();
  cargarUsuarios();
});

cargarUsuarios();