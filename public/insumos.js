requiereAdmin();

const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

const usuario = JSON.parse(localStorage.getItem('usuario'));
document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-caja', 'link-usuarios']);

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

async function cargarInsumos() {
  const respuesta = await fetch(`${API_URL}/insumos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const insumos = await respuesta.json();

  const contenedor = document.getElementById('contenedor-insumos');
  contenedor.innerHTML = '';

  if (insumos.length === 0) {
    contenedor.innerHTML = '<p>No hay insumos cargados todavía.</p>';
    return;
  }

  insumos.forEach(insumo => {
    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${insumo.nombre}</strong> (${insumo.unidad_medida})
      ${insumo.activo ? '' : ' (inactivo)'}<br>
      Stock actual: ${insumo.stock_actual} ${insumo.unidad_medida}<br>
      Último costo: $${formatearPrecio(insumo.costo_unitario)} por ${insumo.unidad_medida}
      <button type="button" class="btn-toggle-activo" data-id="${insumo.id}" data-activo="${insumo.activo}">
        ${insumo.activo ? 'Desactivar' : 'Reactivar'}
      </button>
    `;
    contenedor.appendChild(div);
  });

  document.querySelectorAll('.btn-toggle-activo').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      const activoActual = boton.dataset.activo === 'true';

      await fetch(`${API_URL}/insumos/${id}/activo`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activo: !activoActual })
      });

      cargarInsumos();
    });
  });
}

document.getElementById('formulario-insumo').addEventListener('submit', async (event) => {
  event.preventDefault();

  const nuevoInsumo = {
    nombre: document.getElementById('insumo-nombre').value,
    unidad_medida: document.getElementById('insumo-unidad').value
  };

  await fetch(`${API_URL}/insumos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(nuevoInsumo)
  });

  document.getElementById('formulario-insumo').reset();
  cargarInsumos();
});

cargarInsumos();