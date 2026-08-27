requiereAdmin();

const API_URL = 'http://localhost:3000';
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

const usuario = JSON.parse(localStorage.getItem('usuario'));
document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

let editandoId = null;

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

async function cargarProductos() {
  const respuesta = await fetch(`${API_URL}/productos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const productos = await respuesta.json();

  const contenedor = document.getElementById('contenedor-productos');
  contenedor.innerHTML = '';

  productos.forEach(producto => {
    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${producto.nombre}</strong> - $${formatearPrecio(producto.precio)}
      ${producto.disponible ? '' : ' (no disponible)'}
      ${producto.imagen ? `<br><small>Imagen: ${producto.imagen}</small>` : ''}
      <button type="button" class="btn-editar" data-id="${producto.id}" data-nombre="${producto.nombre}" data-precio="${producto.precio}" data-disponible="${producto.disponible}" data-imagen="${producto.imagen || ''}">Editar</button>
      <button type="button" class="btn-toggle" data-id="${producto.id}" data-disponible="${producto.disponible}">
        ${producto.disponible ? 'Marcar no disponible' : 'Reactivar'}
      </button>
    `;
    contenedor.appendChild(div);
  });

  document.querySelectorAll('.btn-toggle').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      const disponibleActual = boton.dataset.disponible === 'true';

      const producto = productos.find(p => p.id === Number(id));

      await fetch(`${API_URL}/productos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: producto.nombre,
          precio: producto.precio,
          disponible: !disponibleActual,
          imagen: producto.imagen
        })
      });

      cargarProductos();
    });
  });

  document.querySelectorAll('.btn-editar').forEach(boton => {
    boton.addEventListener('click', () => {
      editandoId = boton.dataset.id;
      document.getElementById('nombre').value = boton.dataset.nombre;
      document.getElementById('precio').value = boton.dataset.precio;
      document.getElementById('imagen').value = boton.dataset.imagen;
      document.getElementById('disponible').checked = boton.dataset.disponible === 'true';
      document.getElementById('titulo-formulario').textContent = 'Editar producto';
      document.getElementById('btn-guardar').textContent = 'Guardar cambios';
      document.getElementById('btn-cancelar-edicion').classList.remove('oculto');
      document.getElementById('seccion-subir-foto').classList.remove('oculto');
    });
  });
}

document.getElementById('btn-cancelar-edicion').addEventListener('click', () => {
  editandoId = null;
  document.getElementById('formulario-producto').reset();
  document.getElementById('titulo-formulario').textContent = 'Agregar producto';
  document.getElementById('btn-guardar').textContent = 'Guardar';
  document.getElementById('btn-cancelar-edicion').classList.add('oculto');
  document.getElementById('seccion-subir-foto').classList.add('oculto');
});

document.getElementById('formulario-producto').addEventListener('submit', async (event) => {
  event.preventDefault();

  const datosProducto = {
    nombre: document.getElementById('nombre').value,
    precio: Number(document.getElementById('precio').value),
    disponible: document.getElementById('disponible').checked,
    imagen: document.getElementById('imagen').value || null
  };

  if (editandoId) {
    await fetch(`${API_URL}/productos/${editandoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(datosProducto)
    });
    editandoId = null;
    document.getElementById('titulo-formulario').textContent = 'Agregar producto';
    document.getElementById('btn-guardar').textContent = 'Guardar';
    document.getElementById('btn-cancelar-edicion').classList.add('oculto');
  } else {
  const respuesta = await fetch(`${API_URL}/productos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(datosProducto)
  });

  const productoCreado = await respuesta.json();

  editandoId = productoCreado.id;
  document.getElementById('titulo-formulario').textContent = 'Editar producto';
  document.getElementById('btn-guardar').textContent = 'Guardar cambios';
  document.getElementById('btn-cancelar-edicion').classList.remove('oculto');
  document.getElementById('seccion-subir-foto').classList.remove('oculto');

  cargarProductos();
  return;
  }

  document.getElementById('formulario-producto').reset();
  cargarProductos();
});

document.getElementById('btn-subir-foto').addEventListener('click', async () => {
  if (!editandoId) {
    alert('Primero seleccioná un producto para editar');
    return;
  }

  const archivo = document.getElementById('archivo-imagen').files[0];
  if (!archivo) {
    alert('Elegí un archivo primero');
    return;
  }

  const mensaje = document.getElementById('mensaje-subida');
  mensaje.textContent = 'Subiendo...';

  const formData = new FormData();
  formData.append('imagen', archivo);

  const respuesta = await fetch(`${API_URL}/productos/${editandoId}/imagen`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (!respuesta.ok) {
    const error = await respuesta.json();
    mensaje.textContent = error.error || 'Error al subir la foto';
    return;
  }

  const productoActualizado = await respuesta.json();
  document.getElementById('imagen').value = productoActualizado.imagen;
  mensaje.textContent = '¡Foto subida!';
  cargarProductos();
});

cargarProductos();