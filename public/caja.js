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

// Fecha de hoy según la hora de la compu (con toISOString pasadas las 21 hs ya sería "mañana").
function fechaDeHoy() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// Rango sugerido: los últimos 30 días hasta hoy, con la hora de la compu (no la UTC).
function obtenerRangoUltimoMes() {
  const haceUnMes = new Date();
  haceUnMes.setDate(haceUnMes.getDate() - 30);
  const mes = String(haceUnMes.getMonth() + 1).padStart(2, '0');
  const dia = String(haceUnMes.getDate()).padStart(2, '0');

  return {
    desde: `${haceUnMes.getFullYear()}-${mes}-${dia}`,
    hasta: fechaDeHoy()
  };
}

// ---- Pestañas de la pantalla (Cierres / Gastos / Balance) ----
function mostrarVista(vista) {
  ['cierres', 'gastos', 'balance'].forEach(nombre => {
    document.getElementById(`vista-${nombre}`).classList.toggle('vista-oculta', nombre !== vista);
    document.getElementById(`tab-${nombre}`).setAttribute('aria-selected', String(nombre === vista));
  });
}
['cierres', 'gastos', 'balance'].forEach(nombre => {
  document.getElementById(`tab-${nombre}`).addEventListener('click', () => mostrarVista(nombre));
});

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

  // Cada cierre es una fila de la tabla y, debajo, una fila escondida con sus ventas por producto.
  const tabla = document.createElement('div');
  tabla.className = 'pro-tabla-wrap';
  tabla.innerHTML = `
    <table class="pro-tabla">
      <thead>
        <tr>
          <th scope="col">Fecha</th>
          <th scope="col" class="col-precio">Efectivo</th>
          <th scope="col" class="col-precio">Transferencia</th>
          <th scope="col" class="col-precio">Total</th>
          <th scope="col" class="col-acciones">Ventas por producto</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  const cuerpo = tabla.querySelector('tbody');

  cierres.forEach((cierre, indice) => {
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
      detalleVentasHtml += `<div><strong>${escapeHtml(categoria)}</strong>`;
      grupos[categoria].forEach(item => {
        detalleVentasHtml += `${escapeHtml(item.producto_nombre)}: ${escapeHtml(item.cantidad_vendida)}<br>`;
      });
      detalleVentasHtml += '</div>';
    });
    if (!detalleVentasHtml) detalleVentasHtml = '<div>Sin ventas por producto.</div>';

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td><strong>${cierre.fecha.split('T')[0]}</strong></td>
      <td class="col-precio">$${formatearPrecio(cierre.total_efectivo)}</td>
      <td class="col-precio">$${formatearPrecio(cierre.total_transferencia)}</td>
      <td class="col-precio">$${formatearPrecio(cierre.total_general)}</td>
      <td class="col-acciones"><button type="button" class="btn-tabla btn-ver-detalle" data-indice="${indice}" aria-expanded="false">Ver detalle</button></td>
    `;
    const detalle = document.createElement('tr');
    detalle.className = 'fila-detalle oculto';
    detalle.dataset.indice = indice;
    detalle.innerHTML = `<td colspan="5"><div class="detalle-grupos">${detalleVentasHtml}</div></td>`;

    cuerpo.appendChild(fila);
    cuerpo.appendChild(detalle);
  });

  // Mostrar u ocultar el detalle de un cierre.
  cuerpo.addEventListener('click', (event) => {
    const boton = event.target.closest('button.btn-ver-detalle');
    if (!boton) return;
    const detalle = cuerpo.querySelector(`tr.fila-detalle[data-indice="${boton.dataset.indice}"]`);
    const abierto = detalle.classList.toggle('oculto') === false;
    boton.textContent = abierto ? 'Ocultar' : 'Ver detalle';
    boton.setAttribute('aria-expanded', String(abierto));
  });

  contenedor.appendChild(tabla);
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

  const tabla = document.createElement('div');
  tabla.className = 'pro-tabla-wrap';
  tabla.innerHTML = `
    <table class="pro-tabla">
      <thead>
        <tr>
          <th scope="col">Concepto</th>
          <th scope="col">Categoría</th>
          <th scope="col">Fecha</th>
          <th scope="col">Tipo</th>
          <th scope="col" class="col-precio">Monto</th>
          <th scope="col" class="col-acciones">Acciones</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  const cuerpo = tabla.querySelector('tbody');

  let total = 0;
  gastos.forEach(gasto => {
    total += Number(gasto.monto) || 0;
    const sinClasificar = gasto.tipo !== 'fijo' && gasto.tipo !== 'variable';
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td><strong>${escapeHtml(gasto.concepto)}</strong></td>
      <td>${gasto.categoria ? escapeHtml(gasto.categoria) : ''}</td>
      <td>${gasto.fecha.split('T')[0]}</td>
      <td>
        ${sinClasificar ? `
          <div class="celda-clasificar">
            <em class="balance-negativo sin-clasificar">SIN CLASIFICAR</em>
            <select class="select-clasificar-gasto" data-id="${gasto.id}" aria-label="Marcar ${escapeHtml(gasto.concepto)} como">
              <option value="">Marcar como...</option>
              <option value="fijo">Fijo</option>
              <option value="variable">Variable</option>
            </select>
            <button type="button" class="btn-tabla btn-amarillo-chico btn-clasificar-gasto" data-id="${gasto.id}">Guardar tipo</button>
          </div>` : `<span class="estado estado-ok">${escapeHtml(gasto.tipo)}</span>`}
      </td>
      <td class="col-precio">$${formatearPrecio(gasto.monto)}</td>
      <td class="col-acciones"><button type="button" class="btn-tabla btn-peligro btn-eliminar-gasto" data-id="${gasto.id}" data-concepto="${escapeHtml(gasto.concepto)}" aria-label="Eliminar ${escapeHtml(gasto.concepto)}">Eliminar</button></td>
    `;
    cuerpo.appendChild(fila);
  });

  contenedor.appendChild(tabla);

  const pie = document.createElement('div');
  pie.className = 'total-periodo';
  pie.textContent = `Total del período: $${formatearPrecio(total)}`;
  contenedor.appendChild(pie);

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
      if (!confirm(`¿Eliminar el gasto "${boton.dataset.concepto}"?`)) return;

      const respuesta = await fetch(`${API_URL}/gastos/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!respuesta.ok) {
        const error = await respuesta.json().catch(() => ({}));
        alert(error.error || 'No se pudo eliminar el gasto');
        return;
      }
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
  document.getElementById('gasto-fecha').value = fechaDeHoy();
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

  const tabla = document.createElement('div');
  tabla.className = 'pro-tabla-wrap';
  tabla.innerHTML = `
    <table class="pro-tabla">
      <thead>
        <tr>
          <th scope="col">Concepto</th>
          <th scope="col">Categoría</th>
          <th scope="col">Tipo</th>
          <th scope="col" class="col-precio">Monto mensual</th>
          <th scope="col" class="col-acciones">Acciones</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  const cuerpo = tabla.querySelector('tbody');

  recurrentes.forEach(r => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td><strong>${escapeHtml(r.concepto)}</strong></td>
      <td>${r.categoria ? escapeHtml(r.categoria) : ''}</td>
      <td><span class="estado estado-ok">${escapeHtml(r.tipo)}</span></td>
      <td class="col-precio">$${formatearPrecio(r.monto)}</td>
      <td class="col-acciones"><button type="button" class="btn-tabla btn-peligro btn-eliminar-recurrente" data-id="${r.id}" data-concepto="${escapeHtml(r.concepto)}" aria-label="Quitar ${escapeHtml(r.concepto)}">Quitar</button></td>
    `;
    cuerpo.appendChild(fila);
  });

  contenedor.appendChild(tabla);

  document.querySelectorAll('.btn-eliminar-recurrente').forEach(boton => {
    boton.addEventListener('click', async () => {
      if (!confirm(`¿Quitar "${boton.dataset.concepto}" de los gastos que se repiten?`)) return;

      const respuesta = await fetch(`${API_URL}/gastos/recurrentes/${boton.dataset.id}`, { method: 'DELETE', credentials: 'include' });
      if (!respuesta.ok) {
        const error = await respuesta.json().catch(() => ({}));
        alert(error.error || 'No se pudo quitar el gasto recurrente');
        return;
      }
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
    <p class="balance-periodo">Período: ${balance.desde} al ${balance.hasta}</p>
    <div class="balance-linea"><span>Ventas</span><strong>$${formatearPrecio(balance.ventas)}</strong></div>
    <div class="balance-linea"><span>Compras de insumos (materia prima)</span><strong>-$${formatearPrecio(balance.compras)}</strong></div>
    <div class="balance-linea"><span>Gastos</span><strong>-$${formatearPrecio(balance.gastos)}</strong></div>
    <div class="balance-neto ${claseResultado}"><span>Resultado neto</span><span>$${formatearPrecio(balance.gananciaNeta)}</span></div>
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
    mensaje.classList.add('pro-aviso-error');
    mensaje.classList.remove('oculto');
    return;
  }

  // Aviso de que se guardó. Si la fecha cerrada no cae en el rango del historial, hay que ajustarlo y filtrar.
  mensaje.textContent = `Caja del ${fecha} cerrada. Si no la ves en el historial, ajustá las fechas y apretá "Filtrar".`;
  mensaje.classList.remove('pro-aviso-error', 'oculto');

  document.getElementById('formulario-cierre').reset();
  document.getElementById('fecha-cierre').value = fechaDeHoy();
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

// Las fechas de "Cerrar caja" y "Cargar gasto" arrancan con hoy.
document.getElementById('fecha-cierre').value = fechaDeHoy();
document.getElementById('gasto-fecha').value = fechaDeHoy();

cargarCategorias();
cargarRecurrentes();
