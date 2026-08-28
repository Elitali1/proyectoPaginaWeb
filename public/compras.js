const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

const usuario = JSON.parse(localStorage.getItem('usuario'));
document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-compras', 'link-caja', 'link-usuarios']);

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

function mostrarCompras(compras) {
  const contenedor = document.getElementById('contenedor-compras');
  contenedor.innerHTML = '';

  let total = 0;

  compras.forEach(compra => {
    total += Number(compra.monto);

    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${compra.proveedor}</strong> - $${compra.monto}<br>
      ${compra.concepto || ''} | Fecha: ${compra.fecha.split('T')[0]}
      <button type="button" class="btn-eliminar" data-id="${compra.id}">Eliminar</button>
    `;
    contenedor.appendChild(div);
  });

  document.getElementById('total-filtrado').textContent = `Total: $${total}`;

  document.querySelectorAll('.btn-eliminar').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      await fetch(`${API_URL}/facturas-compra/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      cargarCompras();
    });
  });
}

async function cargarCompras() {
  const respuesta = await fetch(`${API_URL}/facturas-compra`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const compras = await respuesta.json();
  mostrarCompras(compras);
}

document.getElementById('btn-filtrar').addEventListener('click', async () => {
  const desde = document.getElementById('filtro-desde').value;
  const hasta = document.getElementById('filtro-hasta').value;

  if (!desde || !hasta) {
    alert('Elegí ambas fechas para filtrar');
    return;
  }

  const respuesta = await fetch(`${API_URL}/facturas-compra?desde=${desde}&hasta=${hasta}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const compras = await respuesta.json();
  mostrarCompras(compras);
});

document.getElementById('btn-limpiar-filtro').addEventListener('click', () => {
  document.getElementById('filtro-desde').value = '';
  document.getElementById('filtro-hasta').value = '';
  cargarCompras();
});

document.getElementById('formulario-compra').addEventListener('submit', async (event) => {
  event.preventDefault();

  const nuevaCompra = {
    proveedor: document.getElementById('proveedor').value,
    concepto: document.getElementById('concepto').value || null,
    monto: Number(document.getElementById('monto').value),
    fecha: document.getElementById('fecha').value,
    subido_por: usuario.id
  };

  await fetch(`${API_URL}/facturas-compra`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(nuevaCompra)
  });

  document.getElementById('formulario-compra').reset();
  cargarCompras();
});

cargarCompras();