requiereAdmin();

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

let editandoId = null;

// ---- Estado de la tabla (buscador, filtros y paginación) ----
const INSUMOS_POR_PAGINA = 10;
let todosLosInsumos = [];
let insumosCargados = false;
const filtros = { texto: '', estado: 'todos', unidad: 'todas', pagina: 1 };

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

// Cantidades de stock: sin ceros de más (42.000 se ve como 42 y 2.500 como 2,5).
function formatearCantidad(numero) {
  return Number(numero).toLocaleString('es-AR', { maximumFractionDigits: 3 });
}

// Para buscar sin importar mayúsculas ni tildes.
function normalizarTexto(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tieneStockBajo(insumo) {
  return Number(insumo.stock_minimo) > 0 && Number(insumo.stock_actual) < Number(insumo.stock_minimo);
}

async function cargarInsumos() {
  const respuesta = await fetch(`${API_URL}/insumos`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return;
  todosLosInsumos = await respuesta.json();
  insumosCargados = true;

  mostrarAlertasStock(todosLosInsumos);
  renderizarTabla();
  actualizarInfoAjuste();
}

// Dibuja los botones de unidad, la tabla (ya filtrada y de a 10) y la paginación.
function renderizarTabla() {
  if (!insumosCargados) return;

  // Botones de unidad con su cantidad de insumos (las 4 de siempre y cualquier otra que aparezca).
  const unidades = ['kg', 'litro', 'unidad', 'paquete'];
  todosLosInsumos.forEach(i => { if (!unidades.includes(i.unidad_medida)) unidades.push(i.unidad_medida); });
  const chips = document.getElementById('chips-unidad');
  chips.innerHTML = '';
  [{ id: 'todas', nombre: 'Todas', cantidad: todosLosInsumos.length }].concat(
    unidades.map(u => ({ id: u, nombre: u, cantidad: todosLosInsumos.filter(i => i.unidad_medida === u).length }))
  ).forEach(opcion => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'chip';
    boton.dataset.unidad = opcion.id;
    boton.setAttribute('aria-pressed', String(filtros.unidad === opcion.id));
    boton.textContent = `${opcion.nombre} ${opcion.cantidad}`;
    chips.appendChild(boton);
  });

  // Filtros: texto, estado y unidad.
  const texto = normalizarTexto(filtros.texto.trim());
  const filtrados = todosLosInsumos.filter(i => {
    if (filtros.unidad !== 'todas' && i.unidad_medida !== filtros.unidad) return false;
    if (texto && !normalizarTexto(i.nombre).includes(texto)) return false;
    if (filtros.estado === 'bajo') return tieneStockBajo(i);
    if (filtros.estado === 'activos') return i.activo;
    if (filtros.estado === 'inactivos') return !i.activo;
    return true;
  });

  // Paginación.
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / INSUMOS_POR_PAGINA));
  if (filtros.pagina > totalPaginas) filtros.pagina = totalPaginas;
  const desde = (filtros.pagina - 1) * INSUMOS_POR_PAGINA;
  const visibles = filtrados.slice(desde, desde + INSUMOS_POR_PAGINA);

  const contenedor = document.getElementById('contenedor-insumos');
  contenedor.innerHTML = '';

  visibles.forEach(insumo => {
    const stockBajo = tieneStockBajo(insumo);
    let estadoTexto = 'Stock al día';
    let estadoClase = 'estado-ok';
    if (!insumo.activo) {
      estadoTexto = 'Inactivo';
      estadoClase = 'estado-fuera';
    } else if (stockBajo) {
      estadoTexto = '⚠ STOCK BAJO';
      estadoClase = 'estado-bajo';
    }

    const unidad = escapeHtml(insumo.unidad_medida);
    const fila = document.createElement('tr');
    fila.dataset.id = insumo.id;
    if (stockBajo) fila.classList.add('fila-stock-bajo');
    fila.innerHTML = `
      <td><strong>${escapeHtml(insumo.nombre)}</strong><small>${unidad}</small></td>
      <td class="col-precio ${stockBajo ? 'col-stock-bajo' : ''}">${formatearCantidad(insumo.stock_actual)} ${unidad}</td>
      <td class="col-precio">${formatearCantidad(insumo.stock_minimo)} ${unidad}</td>
      <td class="col-precio">$${formatearPrecio(insumo.costo_unitario)} por ${unidad}</td>
      <td><span class="estado ${estadoClase}">${estadoTexto}</span></td>
      <td class="col-acciones">
        <button type="button" class="btn-tabla btn-editar-insumo" data-id="${insumo.id}" data-nombre="${escapeHtml(insumo.nombre)}" data-unidad="${unidad}" data-minimo="${escapeHtml(insumo.stock_minimo)}" aria-label="Editar ${escapeHtml(insumo.nombre)}">Editar</button>
        <button type="button" class="btn-tabla btn-amarillo-chico btn-ajustar-stock" data-id="${insumo.id}" data-nombre="${escapeHtml(insumo.nombre)}" data-unidad="${unidad}" data-minimo="${escapeHtml(insumo.stock_minimo)}" aria-label="Ajustar stock de ${escapeHtml(insumo.nombre)}">Ajustar stock</button>
        <button type="button" class="btn-tabla btn-toggle-activo" data-id="${insumo.id}" data-nombre="${escapeHtml(insumo.nombre)}" data-activo="${insumo.activo}">
          ${insumo.activo ? 'Desactivar' : 'Reactivar'}
        </button>
      </td>
    `;
    contenedor.appendChild(fila);
  });

  marcarFilaEditando();

  document.getElementById('sin-insumos').classList.toggle('oculto', todosLosInsumos.length > 0);
  document.getElementById('sin-resultados-insumos').classList.toggle('oculto', todosLosInsumos.length === 0 || filtrados.length > 0);

  document.getElementById('rango-insumos').textContent = filtrados.length === 0
    ? 'Sin resultados'
    : `Mostrando ${desde + 1} a ${desde + visibles.length} de ${filtrados.length}`;

  const paginacion = document.getElementById('paginacion-insumos');
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

// Resalta en la tabla el insumo que se está editando.
function marcarFilaEditando() {
  document.querySelectorAll('#contenedor-insumos tr').forEach(fila => {
    fila.classList.toggle('fila-editando', editandoId !== null && String(fila.dataset.id) === String(editandoId));
  });
}

function mostrarAlertasStock(insumos) {
  const conStockBajo = insumos.filter(i => i.activo && tieneStockBajo(i));

  const seccion = document.getElementById('seccion-alertas-stock');
  const contenedor = document.getElementById('contenedor-alertas-stock');

  if (conStockBajo.length === 0) {
    seccion.classList.add('oculto');
    return;
  }

  seccion.classList.remove('oculto');
  document.getElementById('titulo-alertas-stock').textContent = `⚠ Insumos con stock bajo (${conStockBajo.length})`;
  contenedor.innerHTML = '';

  conStockBajo.forEach(insumo => {
    const p = document.createElement('p');
    p.className = 'balance-negativo';
    p.innerHTML = `<strong>${escapeHtml(insumo.nombre)}</strong>: quedan ${formatearCantidad(insumo.stock_actual)} ${escapeHtml(insumo.unidad_medida)} (mínimo: ${formatearCantidad(insumo.stock_minimo)} ${escapeHtml(insumo.unidad_medida)})`;
    contenedor.appendChild(p);
  });
}

// ---- Buscador, filtros y paginación ----
document.getElementById('buscar-insumo').addEventListener('input', (e) => {
  filtros.texto = e.target.value;
  filtros.pagina = 1;
  renderizarTabla();
});

document.getElementById('filtro-estado-insumo').addEventListener('change', (e) => {
  filtros.estado = e.target.value;
  filtros.pagina = 1;
  renderizarTabla();
});

document.getElementById('chips-unidad').addEventListener('click', (e) => {
  const boton = e.target.closest('button[data-unidad]');
  if (!boton) return;
  filtros.unidad = boton.dataset.unidad;
  filtros.pagina = 1;
  renderizarTabla();
});

document.getElementById('paginacion-insumos').addEventListener('click', (e) => {
  const boton = e.target.closest('button[data-pagina]');
  if (!boton || boton.disabled) return;
  filtros.pagina = Number(boton.dataset.pagina);
  renderizarTabla();
});

function limpiarFiltros() {
  filtros.texto = '';
  filtros.estado = 'todos';
  filtros.unidad = 'todas';
  filtros.pagina = 1;
  document.getElementById('buscar-insumo').value = '';
  document.getElementById('filtro-estado-insumo').value = 'todos';
  renderizarTabla();
}
document.getElementById('btn-limpiar-filtros-insumos').addEventListener('click', limpiarFiltros);

// Desde el aviso de arriba: deja la tabla mostrando solo los insumos con stock bajo.
document.getElementById('btn-ver-bajos').addEventListener('click', () => {
  limpiarFiltros();
  filtros.estado = 'bajo';
  document.getElementById('filtro-estado-insumo').value = 'bajo';
  renderizarTabla();
  document.getElementById('contenedor-insumos').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ---- Panel de Agregar / Editar / Ajustar stock ----
// Las dos secciones (Datos y Ajustar stock) se muestran según la pestaña elegida.
// "Ajustar stock" solo existe cuando hay un insumo elegido (no al agregar uno nuevo).
const panelInsumo = document.getElementById('panel-insumo');

function activarPestana(nombre) {
  document.querySelectorAll('#panel-insumo .pestana').forEach(seccion => {
    seccion.classList.toggle('activa', seccion.dataset.pestana === nombre);
  });
  document.querySelectorAll('#panel-insumo .tab-panel').forEach(boton => {
    boton.setAttribute('aria-selected', String(boton.dataset.tab === nombre));
  });
  document.getElementById('titulo-formulario-insumo').textContent =
    nombre === 'ajuste' ? 'Ajustar stock' : (editandoId ? 'Editar insumo' : 'Agregar insumo');
  ocultarMensajePanel();
}

function mostrarMensajePanel(texto, esError) {
  const mensaje = document.getElementById('mensaje-panel-insumo');
  mensaje.textContent = texto;
  mensaje.classList.toggle('pro-aviso-error', Boolean(esError));
  mensaje.classList.remove('oculto');
}

function ocultarMensajePanel() {
  document.getElementById('mensaje-panel-insumo').classList.add('oculto');
}

function abrirPanel(pestana) {
  const hayInsumo = editandoId !== null;
  document.getElementById('tabs-panel-insumo').classList.toggle('oculto', !hayInsumo);
  document.getElementById('seccion-ajuste-stock').classList.toggle('oculto', !hayInsumo);
  panelInsumo.classList.remove('oculto');
  activarPestana(pestana);
  marcarFilaEditando();
  panelInsumo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cerrarPanel() {
  editandoId = null;
  document.getElementById('formulario-insumo').reset();
  document.getElementById('btn-guardar-insumo').textContent = 'Guardar insumo';
  document.getElementById('titulo-formulario-insumo').textContent = 'Agregar insumo';
  document.getElementById('ajuste-cantidad').value = '';
  document.getElementById('ajuste-motivo').value = '';
  ocultarMensajePanel();
  panelInsumo.classList.add('oculto');
  marcarFilaEditando();
}

document.getElementById('btn-cancelar-edicion-insumo').addEventListener('click', cerrarPanel);
document.getElementById('btn-cancelar-ajuste').addEventListener('click', cerrarPanel);
// "Cerrar" sirve desde cualquier pestaña: hace lo mismo que Cancelar.
document.getElementById('btn-cerrar-panel-insumo').addEventListener('click', cerrarPanel);

document.querySelectorAll('#panel-insumo .tab-panel').forEach(boton => {
  boton.addEventListener('click', () => activarPestana(boton.dataset.tab));
});

document.getElementById('btn-agregar-insumo').addEventListener('click', () => {
  cerrarPanel();
  abrirPanel('datos');
  document.getElementById('insumo-nombre').focus();
});

// Carga el insumo elegido en el formulario (igual que hacía el botón Editar) y abre el panel.
function elegirInsumo(boton, pestana) {
  editandoId = boton.dataset.id;
  document.getElementById('insumo-nombre').value = boton.dataset.nombre;
  document.getElementById('insumo-unidad').value = boton.dataset.unidad;
  document.getElementById('insumo-stock-minimo').value = boton.dataset.minimo;
  document.getElementById('btn-guardar-insumo').textContent = 'Guardar cambios';
  document.getElementById('ajuste-cantidad').value = '';
  document.getElementById('ajuste-motivo').value = '';
  abrirPanel(pestana);
  actualizarInfoAjuste();
}

// ---- Acciones de cada fila (Editar, Ajustar stock y Desactivar / Reactivar) ----
document.getElementById('contenedor-insumos').addEventListener('click', async (event) => {
  const botonEditar = event.target.closest('button.btn-editar-insumo');
  if (botonEditar) {
    elegirInsumo(botonEditar, 'datos');
    return;
  }

  const botonAjustar = event.target.closest('button.btn-ajustar-stock');
  if (botonAjustar) {
    elegirInsumo(botonAjustar, 'ajuste');
    document.getElementById('ajuste-cantidad').focus();
    return;
  }

  const botonToggle = event.target.closest('button.btn-toggle-activo');
  if (botonToggle) {
    const id = botonToggle.dataset.id;
    const activoActual = botonToggle.dataset.activo === 'true';

    // Desactivar saca al insumo de las recetas y de los avisos, así que se pide confirmación.
    if (activoActual && !confirm(`¿Desactivar "${botonToggle.dataset.nombre}"? Deja de aparecer al armar recetas y de avisar por stock bajo.`)) return;

    const respuesta = await fetch(`${API_URL}/insumos/${id}/activo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ activo: !activoActual })
    });

    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      alert(error.error || 'No se pudo cambiar el estado del insumo');
      return;
    }

    cargarInsumos();
  }
});

// ---- Ajustar stock ----
// Antes eran dos ventanas del navegador (prompt); ahora es una pestaña del panel con las mismas reglas:
// positivo suma, negativo resta, cero no se acepta y el motivo es opcional.
function actualizarInfoAjuste() {
  if (editandoId === null) return;
  const insumo = todosLosInsumos.find(i => String(i.id) === String(editandoId));
  if (!insumo) return;

  const unidad = insumo.unidad_medida;
  const cantidad = Number(document.getElementById('ajuste-cantidad').value) || 0;
  const resultante = Number(insumo.stock_actual) + cantidad;

  document.getElementById('descripcion-ajuste').textContent =
    `Ajustar stock de "${insumo.nombre}" (${unidad}). Usá un número positivo para sumar, negativo para restar (ej: -5 o 10).`;
  document.getElementById('ajuste-stock-actual').textContent = `Stock actual: ${formatearCantidad(insumo.stock_actual)} ${unidad}`;

  const lugarResultante = document.getElementById('ajuste-resultante');
  lugarResultante.textContent = `Quedaría en: ${formatearCantidad(resultante)} ${unidad}`;
  lugarResultante.style.color = resultante < 0 ? '#7A1F16' : '';
}

document.getElementById('ajuste-cantidad').addEventListener('input', actualizarInfoAjuste);

document.getElementById('btn-aplicar-ajuste').addEventListener('click', async () => {
  if (!editandoId) return;

  const cantidad = Number(document.getElementById('ajuste-cantidad').value);

  if (!cantidad || cantidad === 0) {
    mostrarMensajePanel('Ingresá un número distinto de cero', true);
    return;
  }

  const motivo = document.getElementById('ajuste-motivo').value || null;

  const respuesta = await fetch(`${API_URL}/insumos/${editandoId}/ajustar-stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ cantidad, motivo })
  });

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    mostrarMensajePanel(error.error || 'Error al ajustar el stock', true);
    return;
  }

  document.getElementById('ajuste-cantidad').value = '';
  document.getElementById('ajuste-motivo').value = '';
  await cargarInsumos();
  mostrarMensajePanel('Stock ajustado.', false);
});

// ---- Agregar / editar insumo ----
document.getElementById('formulario-insumo').addEventListener('submit', async (event) => {
  event.preventDefault();

  const datosInsumo = {
    nombre: document.getElementById('insumo-nombre').value,
    unidad_medida: document.getElementById('insumo-unidad').value,
    stock_minimo: Number(document.getElementById('insumo-stock-minimo').value) || 0
  };

  if (editandoId) {
    const respuestaDatos = await fetch(`${API_URL}/insumos/${editandoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(datosInsumo)
    });

    if (!respuestaDatos.ok) {
      const error = await respuestaDatos.json().catch(() => ({}));
      mostrarMensajePanel(error.error || 'No se pudo guardar el insumo', true);
      return;
    }

    const respuestaMinimo = await fetch(`${API_URL}/insumos/${editandoId}/stock-minimo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ stock_minimo: datosInsumo.stock_minimo })
    });

    if (!respuestaMinimo.ok) {
      const error = await respuestaMinimo.json().catch(() => ({}));
      mostrarMensajePanel(error.error || 'No se pudo guardar el stock mínimo', true);
      return;
    }
  } else {
    const respuesta = await fetch(`${API_URL}/insumos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(datosInsumo)
    });

    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      mostrarMensajePanel(error.error || 'No se pudo guardar el insumo', true);
      return;
    }
  }

  // Si salió bien, el panel se cierra y la tabla se actualiza.
  cerrarPanel();
  cargarInsumos();
});

cargarInsumos();
