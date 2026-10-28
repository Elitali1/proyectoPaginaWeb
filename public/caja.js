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
      detalleVentasHtml += `<strong>${escapeHtml(categoria)}</strong><br>`;
      grupos[categoria].forEach(item => {
        detalleVentasHtml += `${escapeHtml(item.producto_nombre)}: ${escapeHtml(item.cantidad_vendida)}<br>`;
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
    const sinClasificar = gasto.tipo !== 'fijo' && gasto.tipo !== 'variable';
    div.innerHTML = `
      <strong>${escapeHtml(gasto.concepto)}</strong> - $${formatearPrecio(gasto.monto)}
      ${gasto.categoria ? ` (${escapeHtml(gasto.categoria)})` : ''} - ${gasto.fecha.split('T')[0]}
      - <em class="${sinClasificar ? 'balance-negativo' : ''}">${sinClasificar ? 'SIN CLASIFICAR' : escapeHtml(gasto.tipo)}</em>
      ${sinClasificar ? `
        <select class="select-clasificar-gasto" data-id="${gasto.id}">
          <option value="">Marcar como...</option>
          <option value="fijo">Fijo</option>
          <option value="variable">Variable</option>
        </select>
        <button type="button" class="btn-clasificar-gasto" data-id="${gasto.id}">Guardar tipo</button>` : ''}
      <button type="button" class="btn-eliminar-gasto" data-id="${gasto.id}">Eliminar</button>
    `;
    contenedor.appendChild(div);
  });

  // Clasificar un gasto viejo que quedó "sin clasificar" (fijo o variable).
  document.querySelectorAll('.btn-clasificar-gasto').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      const select = document.querySelector(`.select-clasificar-gasto[data-id="${id}"]`);
      if (!select.value) {
        alert('Elegí si el gasto es fijo o variable');
        return;
      }
      const respuesta = await fetch(`${API_URL}/gastos/${id}/clasificacion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tipo: select.value })
      });
      if (!respuesta.ok) {
        const error = await respuesta.json().catch(() => ({}));
        alert(error.error || 'No se pudo clasificar el gasto');
        return;
      }
      cargarGastos(document.getElementById('gastos-desde').value, document.getElementById('gastos-hasta').value);
    });
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

// ---- Categorías sugeridas (con su tipo por defecto) ----
let categoriasGasto = [];

async function cargarCategorias() {
  const respuesta = await fetch(`${API_URL}/gastos/categorias`, { credentials: 'include' });
  if (!respuesta.ok) return;
  categoriasGasto = await respuesta.json();

  const lista = document.getElementById('lista-categorias');
  lista.innerHTML = '';
  categoriasGasto.forEach(c => {
    const option = document.createElement('option');
    option.value = c.nombre;
    lista.appendChild(option);
  });
}

// Al elegir una categoría conocida, se propone su tipo (se puede cambiar).
function proponerTipo(inputCategoria, selectTipo) {
  inputCategoria.addEventListener('input', () => {
    const texto = inputCategoria.value.trim().toLowerCase();
    const conocida = categoriasGasto.find(c => c.nombre.toLowerCase() === texto);
    if (conocida && conocida.tipo) selectTipo.value = conocida.tipo;
  });
}

proponerTipo(document.getElementById('gasto-categoria'), document.getElementById('gasto-tipo'));
proponerTipo(document.getElementById('recurrente-categoria'), document.getElementById('recurrente-tipo'));

document.getElementById('formulario-gasto').addEventListener('submit', async (event) => {
  event.preventDefault();

  const mensaje = document.getElementById('mensaje-gasto');
  mensaje.classList.add('oculto');

  const nuevoGasto = {
    concepto: document.getElementById('gasto-concepto').value,
    categoria: document.getElementById('gasto-categoria').value || null,
    tipo: document.getElementById('gasto-tipo').value || null,
    monto: Number(document.getElementById('gasto-monto').value),
    fecha: document.getElementById('gasto-fecha').value
  };

  const respuesta = await fetch(`${API_URL}/gastos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(nuevoGasto)
  });

  if (manejarNoAutorizado(respuesta)) return;

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    mensaje.textContent = error.error || 'No se pudo guardar el gasto';
    mensaje.classList.remove('oculto');
    return;
  }

  document.getElementById('formulario-gasto').reset();
  const desdeActual = document.getElementById('gastos-desde').value;
  const hastaActual = document.getElementById('gastos-hasta').value;
  cargarGastos(desdeActual, hastaActual);
});

// ---- Gastos recurrentes (se cargan una vez y se convierten en gastos cada mes) ----
async function cargarRecurrentes() {
  const respuesta = await fetch(`${API_URL}/gastos/recurrentes`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return;
  if (!respuesta.ok) return;
  const recurrentes = await respuesta.json();

  const contenedor = document.getElementById('contenedor-recurrentes');
  contenedor.innerHTML = '';

  if (recurrentes.length === 0) {
    contenedor.innerHTML = '<p>Todavía no cargaste gastos recurrentes en esta sucursal.</p>';
    return;
  }

  recurrentes.forEach(r => {
    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${escapeHtml(r.concepto)}</strong> - $${formatearPrecio(r.monto)}
      ${r.categoria ? ` (${escapeHtml(r.categoria)})` : ''} - ${escapeHtml(r.tipo)}
      <button type="button" class="btn-eliminar-recurrente" data-id="${r.id}">Quitar</button>
    `;
    contenedor.appendChild(div);
  });

  document.querySelectorAll('.btn-eliminar-recurrente').forEach(boton => {
    boton.addEventListener('click', async () => {
      await fetch(`${API_URL}/gastos/recurrentes/${boton.dataset.id}`, { method: 'DELETE', credentials: 'include' });
      cargarRecurrentes();
    });
  });
}

document.getElementById('formulario-recurrente').addEventListener('submit', async (event) => {
  event.preventDefault();

  const mensaje = document.getElementById('mensaje-recurrente');
  mensaje.classList.add('oculto');

  const respuesta = await fetch(`${API_URL}/gastos/recurrentes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      concepto: document.getElementById('recurrente-concepto').value,
      categoria: document.getElementById('recurrente-categoria').value || null,
      tipo: document.getElementById('recurrente-tipo').value || null,
      monto: Number(document.getElementById('recurrente-monto').value)
    })
  });

  if (manejarNoAutorizado(respuesta)) return;

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    mensaje.textContent = error.error || 'No se pudo guardar el gasto recurrente';
    mensaje.classList.remove('oculto');
    return;
  }

  document.getElementById('formulario-recurrente').reset();
  cargarRecurrentes();
});

document.getElementById('btn-cargar-recurrentes').addEventListener('click', async () => {
  const fecha = document.getElementById('recurrentes-fecha').value;
  if (!fecha) {
    alert('Elegí la fecha con la que se van a cargar los gastos');
    return;
  }

  const respuesta = await fetch(`${API_URL}/gastos/recurrentes/cargar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ fecha })
  });

  if (manejarNoAutorizado(respuesta)) return;

  const resultado = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    alert(resultado.error || 'No se pudieron cargar los gastos');
    return;
  }

  alert(`Gastos cargados: ${resultado.creados}. Omitidos por estar ya cargados ese mes: ${resultado.omitidos}.`);
  cargarGastos(document.getElementById('gastos-desde').value, document.getElementById('gastos-hasta').value);
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
    contenedor.innerHTML = `<p>${escapeHtml(error.error || 'Error al calcular el balance')}</p>`;
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
    body: JSON.stringify({ fecha })
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

// Los campos de fecha arrancan con el último mes como sugerencia, pero no se trae nada
// automáticamente: hay que apretar "Filtrar" (antes se mostraban solos apenas se abría la página).
const rangoInicial = obtenerRangoUltimoMes();

document.getElementById('cierres-desde').value = rangoInicial.desde;
document.getElementById('cierres-hasta').value = rangoInicial.hasta;
document.getElementById('contenedor-cierres').innerHTML = '<p>Elegí un rango de fechas y apretá "Filtrar" para ver los cierres.</p>';

document.getElementById('gastos-desde').value = rangoInicial.desde;
document.getElementById('gastos-hasta').value = rangoInicial.hasta;
document.getElementById('contenedor-gastos').innerHTML = '<p>Elegí un rango de fechas y apretá "Filtrar" para ver los gastos.</p>';

cargarCategorias();
cargarRecurrentes();
