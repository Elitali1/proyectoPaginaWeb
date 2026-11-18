const API_URL = window.location.origin;

const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!usuario) {
  window.location.href = 'login.html';
}

document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-caja', 'link-usuarios', 'link-sucursales', 'link-clientes', 'link-dashboard']);

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch(`${API_URL}/usuarios/logout`, { method: 'POST', credentials: 'include' });
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

// Para buscar sin importar mayúsculas ni tildes.
function normalizarTexto(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Fechas con el día LOCAL (toISOString pasa a UTC y después de las 21 hs daba el día siguiente).
function fechaLocal(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// De "2026-11-18T00:00:00.000Z" o "2026-11-18" a "18/11/2026".
function formatearFechaCompra(fecha) {
  const [anio, mes, dia] = String(fecha).split('T')[0].split('-');
  return `${dia}/${mes}/${anio}`;
}

let insumos = [];
let itemsDetalleCompra = [];
let facturaCompraIdActual = null;
let montoCompraActual = 0;

// ---- Estado de la tabla ----
const COMPRAS_POR_PAGINA = 10;
let comprasCargadas = [];
let comprasListas = false;
let verTodas = false; // true cuando se apretó "Ver todas" (sin rango de fechas)
const filtros = { texto: '', pagina: 1 };

function mostrarCompras(compras) {
  comprasCargadas = compras;
  comprasListas = true;
  filtros.pagina = 1;
  renderizarTabla();
}

function comprasFiltradas() {
  const texto = normalizarTexto(filtros.texto.trim());
  if (!texto) return comprasCargadas;
  return comprasCargadas.filter(c =>
    normalizarTexto(c.proveedor).includes(texto) || normalizarTexto(c.concepto).includes(texto)
  );
}

function renderizarTabla() {
  if (!comprasListas) return;

  const filtradas = comprasFiltradas();
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / COMPRAS_POR_PAGINA));
  if (filtros.pagina > totalPaginas) filtros.pagina = totalPaginas;
  const desde = (filtros.pagina - 1) * COMPRAS_POR_PAGINA;
  const visibles = filtradas.slice(desde, desde + COMPRAS_POR_PAGINA);

  const total = filtradas.reduce((acumulado, c) => acumulado + Number(c.monto), 0);
  document.getElementById('total-filtrado').textContent = `Total: $${formatearPrecio(total)}`;

  const contenedor = document.getElementById('contenedor-compras');
  contenedor.innerHTML = '';

  visibles.forEach(compra => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${formatearFechaCompra(compra.fecha)}</td>
      <td><strong>${escapeHtml(compra.proveedor)}</strong></td>
      <td class="col-suave">${compra.concepto ? escapeHtml(compra.concepto) : '—'}</td>
      <td class="col-precio">$${formatearPrecio(compra.monto)}</td>
      <td class="col-acciones">
        <button type="button" class="btn-tabla btn-peligro btn-eliminar" data-id="${compra.id}" data-proveedor="${escapeHtml(compra.proveedor)}" data-monto="${compra.monto}">Eliminar</button>
      </td>
    `;
    contenedor.appendChild(fila);
  });

  document.getElementById('sin-compras').classList.toggle('oculto', comprasCargadas.length > 0);
  document.getElementById('sin-resultados-compras').classList.toggle('oculto', comprasCargadas.length === 0 || filtradas.length > 0);

  document.getElementById('rango-compras').textContent = filtradas.length === 0
    ? 'Sin resultados'
    : `Mostrando ${desde + 1} a ${desde + visibles.length} de ${filtradas.length}`;

  const paginacion = document.getElementById('paginacion-compras');
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

// Eliminar una compra (con confirmación y chequeando que el servidor la haya borrado).
document.getElementById('contenedor-compras').addEventListener('click', async (event) => {
  const boton = event.target.closest('button.btn-eliminar');
  if (!boton) return;

  if (!confirm(`¿Eliminar la compra de "${boton.dataset.proveedor}" por $${formatearPrecio(boton.dataset.monto)}?`)) return;

  const respuesta = await fetch(`${API_URL}/facturas-compra/${boton.dataset.id}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (manejarNoAutorizado(respuesta)) return;

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    alert(error.error || 'No se pudo eliminar la compra');
    return;
  }

  actualizarListaCompras();
});

async function cargarCompras() {
  const respuesta = await fetch(`${API_URL}/facturas-compra`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return;
  const compras = await respuesta.json();
  mostrarCompras(compras);
}

async function cargarComprasFiltradas(desde, hasta) {
  const respuesta = await fetch(`${API_URL}/facturas-compra?desde=${desde}&hasta=${hasta}`, {
    credentials: 'include'
  });
  if (manejarNoAutorizado(respuesta)) return;
  const compras = await respuesta.json();
  mostrarCompras(compras);
}

// Se usa después de crear o borrar una compra: respeta el rango de fechas que está elegido
// (o, si se había apretado "Ver todas", vuelve a mostrar todas).
function actualizarListaCompras() {
  const desde = document.getElementById('filtro-desde').value;
  const hasta = document.getElementById('filtro-hasta').value;

  if (desde && hasta) {
    cargarComprasFiltradas(desde, hasta);
  } else if (verTodas) {
    cargarCompras();
  } else {
    aplicarRango('30dias');
  }
}

document.getElementById('btn-filtrar').addEventListener('click', () => {
  const desde = document.getElementById('filtro-desde').value;
  const hasta = document.getElementById('filtro-hasta').value;

  if (!desde || !hasta) {
    alert('Elegí ambas fechas para filtrar');
    return;
  }

  verTodas = false;
  cargarComprasFiltradas(desde, hasta);
});

document.getElementById('btn-limpiar-filtro').addEventListener('click', () => {
  document.getElementById('filtro-desde').value = '';
  document.getElementById('filtro-hasta').value = '';
  verTodas = true;
  cargarCompras();
});

// Rangos rápidos: completan las fechas y filtran.
function aplicarRango(rango) {
  const hoy = new Date();
  let desde;
  let hasta = hoy;

  if (rango === 'mes') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  } else if (rango === 'mespasado') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  } else {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 30);
  }

  document.getElementById('filtro-desde').value = fechaLocal(desde);
  document.getElementById('filtro-hasta').value = fechaLocal(hasta);
  verTodas = false;
  cargarComprasFiltradas(fechaLocal(desde), fechaLocal(hasta));
}

document.getElementById('chips-rango').addEventListener('click', (event) => {
  const boton = event.target.closest('button[data-rango]');
  if (boton) aplicarRango(boton.dataset.rango);
});

document.getElementById('buscar-compra').addEventListener('input', (event) => {
  filtros.texto = event.target.value;
  filtros.pagina = 1;
  renderizarTabla();
});

document.getElementById('btn-limpiar-busqueda-compras').addEventListener('click', () => {
  filtros.texto = '';
  filtros.pagina = 1;
  document.getElementById('buscar-compra').value = '';
  renderizarTabla();
});

document.getElementById('paginacion-compras').addEventListener('click', (event) => {
  const boton = event.target.closest('button[data-pagina]');
  if (!boton || boton.disabled) return;
  filtros.pagina = Number(boton.dataset.pagina);
  renderizarTabla();
});

async function cargarInsumosEnSelector() {
  const respuesta = await fetch(`${API_URL}/insumos`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return;
  const datos = await respuesta.json();
  insumos = Array.isArray(datos) ? datos.filter(i => i.activo) : [];

  const select = document.getElementById('detalle-insumo');
  select.innerHTML = '';
  insumos.forEach(insumo => {
    const option = document.createElement('option');
    option.value = insumo.id;
    option.textContent = `${insumo.nombre} (${insumo.unidad_medida})`;
    select.appendChild(option);
  });
}

// ---- Panel: paso 1 (datos de la factura) y paso 2 (itemizar) ----
const panelCompra = document.getElementById('panel-compra');

function mostrarMensajePanel(texto) {
  const mensaje = document.getElementById('mensaje-panel-compra');
  mensaje.textContent = texto;
  mensaje.classList.remove('oculto');
}

function ocultarMensajePanel() {
  document.getElementById('mensaje-panel-compra').classList.add('oculto');
}

function mostrarPaso(paso) {
  const enDetalle = paso === 'detalle';
  document.getElementById('formulario-compra').classList.toggle('activa', !enDetalle);
  const seccionDetalle = document.getElementById('seccion-detalle-compra');
  seccionDetalle.classList.toggle('oculto', !enDetalle);
  seccionDetalle.classList.toggle('activa', enDetalle);
  document.getElementById('titulo-panel-compra').textContent = enDetalle ? 'Itemizar esta compra' : 'Cargar factura de compra';
}

function abrirPanelNuevaCompra() {
  cerrarPanel();
  document.getElementById('fecha').value = fechaLocal(new Date());
  mostrarPaso('compra');
  panelCompra.classList.remove('oculto');
  panelCompra.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('proveedor').focus();
}

// Cerrar el panel sin terminar de itemizar equivale a "Omitir": la factura ya quedó guardada.
function cerrarPanel() {
  itemsDetalleCompra = [];
  facturaCompraIdActual = null;
  montoCompraActual = 0;
  document.getElementById('formulario-compra').reset();
  document.getElementById('lista-detalle-compra').innerHTML = '';
  document.getElementById('total-items').textContent = '';
  document.getElementById('alertas-precio').innerHTML = '';
  document.getElementById('bloque-carga-items').classList.add('activa');
  document.getElementById('bloque-carga-items').classList.remove('oculto');
  ocultarMensajePanel();
  mostrarPaso('compra');
  panelCompra.classList.add('oculto');
}

document.getElementById('btn-nueva-compra').addEventListener('click', abrirPanelNuevaCompra);
document.getElementById('btn-cancelar-compra').addEventListener('click', cerrarPanel);
document.getElementById('btn-cerrar-panel-compra').addEventListener('click', cerrarPanel);

document.getElementById('formulario-compra').addEventListener('submit', async (event) => {
  event.preventDefault();
  ocultarMensajePanel();

  const nuevaCompra = {
    proveedor: document.getElementById('proveedor').value,
    concepto: document.getElementById('concepto').value || null,
    monto: Number(document.getElementById('monto').value),
    fecha: document.getElementById('fecha').value
  };

  const respuesta = await fetch(`${API_URL}/facturas-compra`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(nuevaCompra)
  });

  if (manejarNoAutorizado(respuesta)) return;

  const facturaCreada = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    mostrarMensajePanel(facturaCreada.error || 'No se pudo guardar la compra');
    return;
  }
  facturaCompraIdActual = facturaCreada.id;
  montoCompraActual = nuevaCompra.monto;
  itemsDetalleCompra = [];

  document.getElementById('formulario-compra').reset();
  document.getElementById('lista-detalle-compra').innerHTML = '';
  document.getElementById('total-items').textContent = '';
  document.getElementById('alertas-precio').innerHTML = '';
  document.getElementById('resumen-compra-actual').textContent =
    `Compra guardada: ${nuevaCompra.proveedor} - $${formatearPrecio(nuevaCompra.monto)}`;
  mostrarPaso('detalle');

  actualizarListaCompras();
});

function renderizarDetalleCompra() {
  const lista = document.getElementById('lista-detalle-compra');
  lista.innerHTML = '';

  let totalItems = 0;

  itemsDetalleCompra.forEach((item, index) => {
    totalItems += item.cantidad * item.precio_unitario;
    const insumo = insumos.find(i => i.id === item.insumo_id);
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${escapeHtml(insumo ? insumo.nombre : `Insumo #${item.insumo_id}`)}: ${item.cantidad} ${escapeHtml(insumo ? insumo.unidad_medida : '')} x $${formatearPrecio(item.precio_unitario)}</span>
      <button type="button" class="btn-quitar-detalle" data-index="${index}">Quitar</button>
    `;
    lista.appendChild(li);
  });

  // Ayuda para chequear que los items sumen más o menos lo que dice la factura.
  document.getElementById('total-items').textContent = itemsDetalleCompra.length === 0
    ? ''
    : `Suma de los items: $${formatearPrecio(Math.round(totalItems * 100) / 100)} (monto de la factura: $${formatearPrecio(montoCompraActual)})`;
}

document.getElementById('lista-detalle-compra').addEventListener('click', (event) => {
  const boton = event.target.closest('button.btn-quitar-detalle');
  if (!boton) return;
  itemsDetalleCompra.splice(Number(boton.dataset.index), 1);
  renderizarDetalleCompra();
});

function agregarItemDetalle() {
  const insumoId = Number(document.getElementById('detalle-insumo').value);
  const cantidad = Number(document.getElementById('detalle-cantidad').value);
  const precioUnitario = Number(document.getElementById('detalle-precio').value);

  if (!insumoId || !cantidad || !precioUnitario) {
    alert('Completá insumo, cantidad y precio');
    return;
  }

  itemsDetalleCompra.push({ insumo_id: insumoId, cantidad, precio_unitario: precioUnitario });

  document.getElementById('detalle-cantidad').value = '';
  document.getElementById('detalle-precio').value = '';

  renderizarDetalleCompra();
  document.getElementById('detalle-cantidad').focus();
}

document.getElementById('btn-agregar-detalle').addEventListener('click', agregarItemDetalle);
// Enter en el precio agrega el item (más rápido cuando se carga una factura larga).
document.getElementById('detalle-precio').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    agregarItemDetalle();
  }
});

document.getElementById('btn-guardar-detalle').addEventListener('click', async () => {
  if (itemsDetalleCompra.length === 0) {
    alert('Agregá al menos un item, o usá "Omitir" si esta compra no es de insumos');
    return;
  }

  const respuesta = await fetch(`${API_URL}/facturas-compra/${facturaCompraIdActual}/detalle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ items: itemsDetalleCompra })
  });

  if (manejarNoAutorizado(respuesta)) return;

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    alert(datos.error || 'Error al guardar el detalle de la compra');
    return;
  }

  const contenedorAlertas = document.getElementById('alertas-precio');
  contenedorAlertas.innerHTML = '';

  if (datos.alertas && datos.alertas.length > 0) {
    datos.alertas.forEach(alerta => {
      const insumo = insumos.find(i => i.id === alerta.insumo_id);
      const signo = alerta.variacionPorcentual > 0 ? '+' : '';
      const div = document.createElement('div');
      div.className = alerta.variacionPorcentual > 0 ? 'balance-negativo' : 'balance-positivo';
      div.innerHTML = `⚠ ${escapeHtml(insumo ? insumo.nombre : `Insumo #${alerta.insumo_id}`)}: ${signo}${alerta.variacionPorcentual}% (de $${formatearPrecio(alerta.precioAnterior)} a $${formatearPrecio(alerta.precioNuevo)})`;
      contenedorAlertas.appendChild(div);
    });
  } else {
    contenedorAlertas.innerHTML = '<p>Detalle guardado, sin variaciones de precio relevantes.</p>';
  }

  itemsDetalleCompra = [];
  document.getElementById('lista-detalle-compra').innerHTML = '';
  document.getElementById('total-items').textContent = '';
  facturaCompraIdActual = null;

  // Ya está guardado: se esconde la carga de items y queda el resultado, con el botón Cerrar arriba.
  document.getElementById('bloque-carga-items').classList.remove('activa');
});

document.getElementById('btn-omitir-detalle').addEventListener('click', cerrarPanel);

// Al abrir la pantalla se muestran los últimos 30 días (antes no se mostraba nada hasta elegir fechas).
// "Ver todas" sigue estando para el historial completo.
aplicarRango('30dias');
cargarInsumosEnSelector();
