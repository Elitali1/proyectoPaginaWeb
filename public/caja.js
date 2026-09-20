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

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

function obtenerRangoUltimoMes() {
  const hoy = new Date();
  const haceUnMes = new Date();
  haceUnMes.setDate(hoy.getDate() - 30);

  return {
    desde: haceUnMes.toISOString().split('T')[0],
    hasta: hoy.toISOString().split('T')[0]
  };
}

async function cargarCierres(desde, hasta) {
  const respuesta = await fetch(`${API_URL}/cierre-caja?desde=${desde}&hasta=${hasta}`, {
    credentials: 'include'
  });

  if (manejarNoAutorizado(respuesta)) return;

  const cierres = await respuesta.json();

  const contenedor = document.getElementById('contenedor-cierres');
  contenedor.innerHTML = '';

  if (cierres.length === 0) {
    contenedor.innerHTML = '<p>No hay cierres en este rango de fechas.</p>';
    return;
  }

  cierres.forEach(cierre => {
    const div = document.createElement('div');
    div.className = 'pedido';

    const grupos = {};
    (cierre.ventasPorProducto || []).forEach(item => {
      const categoria = item.categoria_nombre || 'Otros';
      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }
      grupos[categoria].push(item);
    });

    let detalleVentasHtml = '';
    Object.keys(grupos).forEach(categoria => {
      detalleVentasHtml += `<strong>${escaparHtml(categoria)}</strong><br>`;
      grupos[categoria].forEach(item => {
        detalleVentasHtml += `${escaparHtml(item.producto_nombre)}: ${item.cantidad_vendida}<br>`;
      });
    });

    div.innerHTML = `
      <strong>${cierre.fecha.split('T')[0]}</strong><br>
      ${detalleVentasHtml}
      Efectivo: $${formatearPrecio(cierre.total_efectivo)} | Transferencia: $${formatearPrecio(cierre.total_transferencia)}<br>
      <strong>Total: $${formatearPrecio(cierre.total_general)}</strong>
    `;
    contenedor.appendChild(div);
  });
}

async function cargarGastos(desde, hasta) {
  const respuesta = await fetch(`${API_URL}/gastos?desde=${desde}&hasta=${hasta}`, {
    credentials: 'include'
  });

  if (manejarNoAutorizado(respuesta)) return;

  const gastos = await respuesta.json();

  const contenedor = document.getElementById('contenedor-gastos');
  contenedor.innerHTML = '';

  if (gastos.length === 0) {
    contenedor.innerHTML = '<p>No hay gastos en este rango de fechas.</p>';
    return;
  }

  gastos.forEach(gasto => {
    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${escaparHtml(gasto.concepto)}</strong> - $${formatearPrecio(gasto.monto)}
      ${gasto.categoria ? ` (${escaparHtml(gasto.categoria)})` : ''} - ${gasto.fecha.split('T')[0]}
      <button type="button" class="btn-eliminar-gasto" data-id="${gasto.id}">Eliminar</button>
    `;
    contenedor.appendChild(div);
  });

  document.querySelectorAll('.btn-eliminar-gasto').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      await fetch(`${API_URL}/gastos/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const desdeActual = document.getElementById('gastos-desde').value;
      const hastaActual = document.getElementById('gastos-hasta').value;
      cargarGastos(desdeActual, hastaActual);
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
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(nuevoGasto)
  });

  document.getElementById('formulario-gasto').reset();
  const desdeActual = document.getElementById('gastos-desde').value;
  const hastaActual = document.getElementById('gastos-hasta').value;
  cargarGastos(desdeActual, hastaActual);
});

document.getElementById('formulario-balance').addEventListener('submit', async (event) => {
  event.preventDefault();

  const desde = document.getElementById('balance-desde').value;
  const hasta = document.getElementById('balance-hasta').value;

  const respuesta = await fetch(`${API_URL}/cierre-caja/balance?desde=${desde}&hasta=${hasta}`, {
    credentials: 'include'
  });

  if (manejarNoAutorizado(respuesta)) return;

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
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ fecha, cerrado_por: usuario.id })
  });

  if (manejarNoAutorizado(respuesta)) return;

  if (!respuesta.ok) {
    const error = await respuesta.json();
    mensaje.textContent = error.error || 'Error al cerrar la caja';
    mensaje.classList.remove('oculto');
    return;
  }

  document.getElementById('formulario-cierre').reset();
  const desdeActual = document.getElementById('cierres-desde').value;
  const hastaActual = document.getElementById('cierres-hasta').value;
  cargarCierres(desdeActual, hastaActual);
});

document.getElementById('btn-filtrar-cierres').addEventListener('click', () => {
  const desde = document.getElementById('cierres-desde').value;
  const hasta = document.getElementById('cierres-hasta').value;
  if (!desde || !hasta) {
    alert('Elegí ambas fechas para filtrar');
    return;
  }
  cargarCierres(desde, hasta);
});

document.getElementById('btn-filtrar-gastos').addEventListener('click', () => {
  const desde = document.getElementById('gastos-desde').value;
  const hasta = document.getElementById('gastos-hasta').value;
  if (!desde || !hasta) {
    alert('Elegí ambas fechas para filtrar');
    return;
  }
  cargarGastos(desde, hasta);
});

const rangoInicial = obtenerRangoUltimoMes();

document.getElementById('cierres-desde').value = rangoInicial.desde;
document.getElementById('cierres-hasta').value = rangoInicial.hasta;
cargarCierres(rangoInicial.desde, rangoInicial.hasta);

document.getElementById('gastos-desde').value = rangoInicial.desde;
document.getElementById('gastos-hasta').value = rangoInicial.hasta;
cargarGastos(rangoInicial.desde, rangoInicial.hasta);