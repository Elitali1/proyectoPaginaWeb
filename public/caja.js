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

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

async function cargarCierres() {
  const respuesta = await fetch(`${API_URL}/cierre-caja`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const cierres = await respuesta.json();

  const contenedor = document.getElementById('contenedor-cierres');
  contenedor.innerHTML = '';

  cierres.forEach(cierre => {
    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${cierre.fecha.split('T')[0]}</strong><br>
      Efectivo: $${formatearPrecio(cierre.total_efectivo)} | Transferencia: $${formatearPrecio(cierre.total_transferencia)}<br>
      <strong>Total: $${formatearPrecio(cierre.total_general)}</strong>
    `;
    contenedor.appendChild(div);
  });
}

async function cargarGastos() {
  const respuesta = await fetch(`${API_URL}/gastos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const gastos = await respuesta.json();

  const contenedor = document.getElementById('contenedor-gastos');
  contenedor.innerHTML = '';

  gastos.forEach(gasto => {
    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${gasto.concepto}</strong> - $${formatearPrecio(gasto.monto)}
      ${gasto.categoria ? ` (${gasto.categoria})` : ''} - ${gasto.fecha.split('T')[0]}
      <button type="button" class="btn-eliminar-gasto" data-id="${gasto.id}">Eliminar</button>
    `;
    contenedor.appendChild(div);
  });

  document.querySelectorAll('.btn-eliminar-gasto').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      await fetch(`${API_URL}/gastos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      cargarGastos();
    });
  });
}

document.getElementById('formulario-gasto').addEventListener('submit', async (event) => {
  event.preventDefault();

  const nuevoGasto = {
    concepto: document.getElementById('gasto-concepto').value,
    categoria: document.getElementById('gasto-categoria').value || null,
    monto: Number(document.getElementById('gasto-monto').value),
    fecha: document.getElementById('gasto-fecha').value
  };

  await fetch(`${API_URL}/gastos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(nuevoGasto)
  });

  document.getElementById('formulario-gasto').reset();
  cargarGastos();
});

document.getElementById('formulario-balance').addEventListener('submit', async (event) => {
  event.preventDefault();

  const desde = document.getElementById('balance-desde').value;
  const hasta = document.getElementById('balance-hasta').value;

  const respuesta = await fetch(`${API_URL}/cierre-caja/balance?desde=${desde}&hasta=${hasta}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const contenedor = document.getElementById('resultado-balance');

  if (!respuesta.ok) {
    const error = await respuesta.json();
    contenedor.innerHTML = `<p>${error.error || 'Error al calcular el balance'}</p>`;
    return;
  }

  const balance = await respuesta.json();

  const claseResultado = balance.gananciaNeta >= 0 ? 'balance-positivo' : 'balance-negativo';

  contenedor.innerHTML = `
    <div class="pedido">
      <p>Período: ${balance.desde} al ${balance.hasta}</p>
      <p>Ventas: $${formatearPrecio(balance.ventas)}</p>
      <p>Compras de mercadería: -$${formatearPrecio(balance.compras)}</p>
      <p>Gastos: -$${formatearPrecio(balance.gastos)}</p>
      <p class="${claseResultado}"><strong>Ganancia neta: $${formatearPrecio(balance.gananciaNeta)}</strong></p>
    </div>
  `;
});

document.getElementById('formulario-cierre').addEventListener('submit', async (event) => {
  event.preventDefault();

  const mensaje = document.getElementById('mensaje-cierre');
  mensaje.classList.add('oculto');

  const fecha = document.getElementById('fecha-cierre').value;

  const respuesta = await fetch(`${API_URL}/cierre-caja`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ fecha, cerrado_por: usuario.id })
  });

  if (!respuesta.ok) {
    const error = await respuesta.json();
    mensaje.textContent = error.error || 'Error al cerrar la caja';
    mensaje.classList.remove('oculto');
    return;
  }

  document.getElementById('formulario-cierre').reset();
  cargarCierres();
});

cargarCierres();
cargarGastos();