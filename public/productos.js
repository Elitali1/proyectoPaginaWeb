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
let categorias = [];
let insumosDisponibles = [];
let itemsReceta = [];

// ---- Estado del catálogo (lista con buscador, filtros y paginación) ----
const PRODUCTOS_POR_PAGINA = 10;
let todosLosProductos = [];
let catalogoCargado = false;
const filtros = { texto: '', estado: 'todos', categoria: 'todas', pagina: 1 };

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

// Para buscar sin importar mayúsculas ni tildes ("jamon" encuentra "Jamón").
function normalizarTexto(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function cargarCategorias() {
  const respuesta = await fetch(`${API_URL}/categorias`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return;
  categorias = await respuesta.json();

  const select = document.getElementById('categoria');
  select.innerHTML = '';
  categorias.forEach(categoria => {
    const option = document.createElement('option');
    option.value = categoria.id;
    option.textContent = categoria.nombre;
    select.appendChild(option);
  });

  // Los botones de filtro por categoría salen de esta misma lista.
  renderizarCatalogo();
}

async function cargarInsumosParaReceta() {
  const respuesta = await fetch(`${API_URL}/insumos`, { credentials: 'include' });
  insumosDisponibles = (await respuesta.json()).filter(i => i.activo);

  const select = document.getElementById('receta-insumo');
  select.innerHTML = '';
  insumosDisponibles.forEach(insumo => {
    const option = document.createElement('option');
    option.value = insumo.id;
    option.textContent = `${insumo.nombre} (${insumo.unidad_medida})`;
    select.appendChild(option);
  });
}

async function cargarProductos() {
  const respuesta = await fetch(`${API_URL}/productos`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return;
  todosLosProductos = await respuesta.json();
  catalogoCargado = true;
  renderizarCatalogo();
}

// Dibuja los botones de categoría, la tabla (ya filtrada y de a 10) y la paginación.
function renderizarCatalogo() {
  if (!catalogoCargado) return;

  // Botones de categoría con su cantidad de productos.
  const chips = document.getElementById('chips-categoria');
  chips.innerHTML = '';
  const opcionesChips = [{ id: 'todas', nombre: 'Todas', cantidad: todosLosProductos.length }].concat(
    categorias.map(c => ({
      id: String(c.id),
      nombre: c.nombre,
      cantidad: todosLosProductos.filter(p => String(p.categoria_id) === String(c.id)).length
    }))
  );
  opcionesChips.forEach(opcion => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'chip';
    boton.dataset.categoria = opcion.id;
    boton.setAttribute('aria-pressed', String(String(filtros.categoria) === opcion.id));
    boton.textContent = `${opcion.nombre} ${opcion.cantidad}`;
    chips.appendChild(boton);
  });

  // Filtros: texto, estado y categoría.
  const texto = normalizarTexto(filtros.texto.trim());
  const filtrados = todosLosProductos.filter(p => {
    if (filtros.categoria !== 'todas' && String(p.categoria_id) !== String(filtros.categoria)) return false;
    if (texto && !normalizarTexto(p.nombre).includes(texto)) return false;
    if (filtros.estado === 'disponibles') return p.en_sucursal && p.disponible;
    if (filtros.estado === 'nodisp') return p.en_sucursal && !p.disponible;
    if (filtros.estado === 'noaca') return !p.en_sucursal;
    return true;
  });

  // Paginación.
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PRODUCTOS_POR_PAGINA));
  if (filtros.pagina > totalPaginas) filtros.pagina = totalPaginas;
  const desde = (filtros.pagina - 1) * PRODUCTOS_POR_PAGINA;
  const visibles = filtrados.slice(desde, desde + PRODUCTOS_POR_PAGINA);

  const contenedor = document.getElementById('contenedor-productos');
  contenedor.innerHTML = '';

  visibles.forEach(producto => {
    let estadoTexto = 'Disponible';
    let estadoClase = 'estado-ok';
    if (!producto.en_sucursal) {
      estadoTexto = 'No se vende acá';
      estadoClase = 'estado-fuera';
    } else if (!producto.disponible) {
      estadoTexto = 'No disponible';
      estadoClase = 'estado-no';
    }

    const fila = document.createElement('tr');
    fila.dataset.id = producto.id;
    fila.innerHTML = `
      <td>
        <strong>${escapeHtml(producto.nombre)}</strong>
        ${producto.imagen ? `<br><small>Imagen: ${escapeHtml(producto.imagen)}</small>` : ''}
      </td>
      <td>${producto.categoria_nombre ? escapeHtml(producto.categoria_nombre) : ''}</td>
      <td class="col-precio">${producto.en_sucursal ? `$${formatearPrecio(producto.precio)}` : 'Sin precio'}</td>
      <td><span class="estado ${estadoClase}">${estadoTexto}</span></td>
      <td class="col-acciones">
        <button type="button" class="btn-editar" data-id="${producto.id}" data-nombre="${escapeHtml(producto.nombre)}" data-precio="${escapeHtml(producto.precio)}" data-disponible="${producto.disponible}" data-imagen="${escapeHtml(producto.imagen)}" data-categoria="${producto.categoria_id || ''}" aria-label="Editar ${escapeHtml(producto.nombre)}">Editar</button>
        ${producto.en_sucursal ? `<button type="button" class="btn-toggle" data-id="${producto.id}" data-disponible="${producto.disponible}">
          ${producto.disponible ? 'Marcar no disponible' : 'Reactivar'}
        </button>` : ''}
      </td>
    `;
    contenedor.appendChild(fila);
  });

  marcarFilaEditando();

  document.getElementById('sin-resultados').classList.toggle('oculto', filtrados.length > 0);

  document.getElementById('rango-productos').textContent = filtrados.length === 0
    ? 'Sin resultados'
    : `Mostrando ${desde + 1} a ${desde + visibles.length} de ${filtrados.length}`;

  const paginacion = document.getElementById('paginacion');
  paginacion.innerHTML = '';
  const agregarBotonPagina = (texto, pagina, { activa = false, deshabilitada = false, etiqueta = '' } = {}) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'pagina';
    boton.dataset.pagina = pagina;
    boton.textContent = texto;
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

// Resalta en la tabla el producto que se está editando.
function marcarFilaEditando() {
  document.querySelectorAll('#contenedor-productos tr').forEach(fila => {
    fila.classList.toggle('fila-editando', editandoId !== null && String(fila.dataset.id) === String(editandoId));
  });
}

// ---- Buscador, filtros y paginación ----
document.getElementById('buscar-producto').addEventListener('input', (e) => {
  filtros.texto = e.target.value;
  filtros.pagina = 1;
  renderizarCatalogo();
});

document.getElementById('filtro-estado').addEventListener('change', (e) => {
  filtros.estado = e.target.value;
  filtros.pagina = 1;
  renderizarCatalogo();
});

document.getElementById('chips-categoria').addEventListener('click', (e) => {
  const boton = e.target.closest('button[data-categoria]');
  if (!boton) return;
  filtros.categoria = boton.dataset.categoria;
  filtros.pagina = 1;
  renderizarCatalogo();
});

document.getElementById('paginacion').addEventListener('click', (e) => {
  const boton = e.target.closest('button[data-pagina]');
  if (!boton || boton.disabled) return;
  filtros.pagina = Number(boton.dataset.pagina);
  renderizarCatalogo();
});

document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
  filtros.texto = '';
  filtros.estado = 'todos';
  filtros.categoria = 'todas';
  filtros.pagina = 1;
  document.getElementById('buscar-producto').value = '';
  document.getElementById('filtro-estado').value = 'todos';
  renderizarCatalogo();
});

// ---- Pestañas de la pantalla (Catálogo / Categorías) ----
function mostrarVista(vista) {
  const verCategorias = vista === 'categorias';
  document.getElementById('vista-catalogo').classList.toggle('vista-oculta', verCategorias);
  document.getElementById('seccion-categorias').classList.toggle('vista-oculta', !verCategorias);
  document.getElementById('tab-catalogo').setAttribute('aria-selected', String(!verCategorias));
  document.getElementById('tab-categorias').setAttribute('aria-selected', String(verCategorias));
}
document.getElementById('tab-catalogo').addEventListener('click', () => mostrarVista('catalogo'));
document.getElementById('tab-categorias').addEventListener('click', () => mostrarVista('categorias'));

// ---- Panel de Agregar / Editar producto ----
// Las secciones Foto, Receta y Dónde se vende siguen usando la clase "oculto" como siempre
// (el código de más abajo la prende y la apaga igual que antes). Acá solo se decide cuál
// de las que están disponibles se muestra, según la pestaña elegida.
const panelProducto = document.getElementById('panel-producto');

function activarPestana(nombre) {
  document.querySelectorAll('.pestana').forEach(seccion => {
    seccion.classList.toggle('activa', seccion.dataset.pestana === nombre);
  });
  document.querySelectorAll('.tab-panel').forEach(boton => {
    boton.setAttribute('aria-selected', String(boton.dataset.tab === nombre));
  });
}

// Muestra solo las pestañas de las secciones disponibles (ej.: "Dónde se vende" no aparece con una sola sucursal).
function actualizarPestanas() {
  let hayOtras = false;
  document.querySelectorAll('.tab-panel').forEach(boton => {
    const seccion = document.querySelector(`.pestana[data-pestana="${boton.dataset.tab}"]`);
    const disponible = !seccion.classList.contains('oculto');
    boton.classList.toggle('oculto', !disponible);
    if (boton.dataset.tab !== 'datos' && disponible) hayOtras = true;
  });
  document.getElementById('tabs-panel').classList.toggle('oculto', !hayOtras);

  const activa = document.querySelector('.tab-panel[aria-selected="true"]');
  if (!activa || activa.classList.contains('oculto')) activarPestana('datos');
}

document.querySelectorAll('.tab-panel').forEach(boton => {
  boton.addEventListener('click', () => activarPestana(boton.dataset.tab));
});

// Cada vez que otra parte del código muestra u oculta una sección, se actualizan las pestañas.
const observador = new MutationObserver(actualizarPestanas);
['seccion-subir-foto', 'seccion-receta', 'seccion-sucursales'].forEach(id => {
  observador.observe(document.getElementById(id), { attributes: true, attributeFilter: ['class'] });
});

function mostrarPanel() {
  panelProducto.classList.remove('oculto');
  activarPestana('datos');
  actualizarPestanas();
  panelProducto.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function ocultarPanel() {
  panelProducto.classList.add('oculto');
}

// "Cerrar" sirve desde cualquier pestaña del panel: hace lo mismo que Cancelar.
document.getElementById('btn-cerrar-panel').addEventListener('click', () => {
  document.getElementById('btn-cancelar-edicion').click();
});

document.getElementById('btn-agregar-producto').addEventListener('click', () => {
  // Cancelar deja el formulario limpio y en modo "Agregar"; después se abre el panel.
  document.getElementById('btn-cancelar-edicion').click();
  mostrarPanel();
  document.getElementById('nombre').focus();
});

// ---- Acciones de cada fila del catálogo (Editar y Marcar no disponible / Reactivar) ----
document.getElementById('contenedor-productos').addEventListener('click', async (event) => {
  const botonToggle = event.target.closest('button.btn-toggle');
  if (botonToggle) {
    const id = botonToggle.dataset.id;
    const disponibleActual = botonToggle.dataset.disponible === 'true';

    const producto = todosLosProductos.find(p => p.id === Number(id));

    await fetch(`${API_URL}/productos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        nombre: producto.nombre,
        precio: producto.precio,
        disponible: !disponibleActual,
        imagen: producto.imagen,
        categoria_id: producto.categoria_id
      })
    });

    cargarProductos();
    return;
  }

  const botonEditar = event.target.closest('button.btn-editar');
  if (botonEditar) {
    editandoId = botonEditar.dataset.id;
    document.getElementById('nombre').value = botonEditar.dataset.nombre;
    document.getElementById('precio').value = botonEditar.dataset.precio;
    document.getElementById('imagen').value = botonEditar.dataset.imagen;
    document.getElementById('categoria').value = botonEditar.dataset.categoria;
    document.getElementById('disponible').checked = botonEditar.dataset.disponible === 'true';
    document.getElementById('titulo-formulario').textContent = 'Editar producto';
    document.getElementById('btn-guardar').textContent = 'Guardar cambios';
    document.getElementById('seccion-subir-foto').classList.remove('oculto');
    document.getElementById('seccion-receta').classList.remove('oculto');
    mostrarPanel();
    marcarFilaEditando();

    await cargarRecetaDeProducto(editandoId);
    await cargarSucursalesDeProducto(editandoId);
  }
});

async function cargarRecetaDeProducto(productoId) {
  const respuesta = await fetch(`${API_URL}/recetas/${productoId}`, { credentials: 'include' });
  const receta = await respuesta.json();

  itemsReceta = receta.map(linea => ({
    insumo_id: linea.insumo_id,
    cantidad: Number(linea.cantidad)
  }));

  renderizarListaReceta();
  await mostrarCostoYMargen(productoId);
}

function renderizarListaReceta() {
  const lista = document.getElementById('lista-receta');
  lista.innerHTML = '';

  itemsReceta.forEach((item, index) => {
    const insumo = insumosDisponibles.find(i => i.id === item.insumo_id);
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${insumo ? escapeHtml(insumo.nombre) : 'Insumo'}: ${item.cantidad} ${insumo ? escapeHtml(insumo.unidad_medida) : ''}</span>
      <button type="button" class="btn-quitar-receta" data-index="${index}">Quitar</button>
    `;
    lista.appendChild(li);
  });

  document.querySelectorAll('.btn-quitar-receta').forEach(boton => {
    boton.addEventListener('click', () => {
      const index = Number(boton.dataset.index);
      itemsReceta.splice(index, 1);
      renderizarListaReceta();
    });
  });
}

document.getElementById('btn-agregar-item-receta').addEventListener('click', () => {
  const insumoId = Number(document.getElementById('receta-insumo').value);
  const cantidad = Number(document.getElementById('receta-cantidad').value);

  if (!insumoId || !cantidad) {
    alert('Elegí un insumo y una cantidad');
    return;
  }

  itemsReceta.push({ insumo_id: insumoId, cantidad });
  document.getElementById('receta-cantidad').value = '';
  renderizarListaReceta();
});

document.getElementById('btn-guardar-receta').addEventListener('click', async () => {
  if (!editandoId) {
    alert('Primero seleccioná un producto para editar');
    return;
  }

  const respuestaReceta = await fetch(`${API_URL}/recetas/${editandoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ items: itemsReceta })
  });

  if (!respuestaReceta.ok) {
    const error = await respuestaReceta.json().catch(() => ({}));
    alert(error.error || 'No se pudo guardar la receta');
    return;
  }

  await mostrarCostoYMargen(editandoId);
  alert('Receta guardada');
});

async function mostrarCostoYMargen(productoId) {
  const respuesta = await fetch(`${API_URL}/recetas/${productoId}/costo`, { credentials: 'include' });
  const datos = await respuesta.json();

  const contenedor = document.getElementById('resultado-costo');

  if (datos.costo === 0) {
    contenedor.innerHTML = '<p>Todavía no hay receta cargada para calcular el costo.</p>';
    return;
  }

  contenedor.innerHTML = `
    <p>Costo de fabricación: $${formatearPrecio(datos.costo.toFixed(2))}</p>
    <p>Precio de venta: $${formatearPrecio(datos.precioVenta)}</p>
    <p><strong>Margen de ganancia: ${datos.margenPorcentual}%</strong> ($${formatearPrecio(datos.gananciaAbsoluta.toFixed(2))})</p>
  `;
}

document.getElementById('btn-cancelar-edicion').addEventListener('click', () => {
  editandoId = null;
  itemsReceta = [];
  document.getElementById('formulario-producto').reset();
  document.getElementById('titulo-formulario').textContent = 'Agregar producto';
  document.getElementById('btn-guardar').textContent = 'Guardar';
  document.getElementById('seccion-subir-foto').classList.add('oculto');
  document.getElementById('seccion-receta').classList.add('oculto');
  document.getElementById('seccion-sucursales').classList.add('oculto');
  document.getElementById('lista-receta').innerHTML = '';
  document.getElementById('resultado-costo').innerHTML = '';
  ocultarPanel();
  marcarFilaEditando();
});

document.getElementById('formulario-producto').addEventListener('submit', async (event) => {
  event.preventDefault();

  const datosProducto = {
    nombre: document.getElementById('nombre').value,
    precio: Number(document.getElementById('precio').value),
    disponible: document.getElementById('disponible').checked,
    imagen: document.getElementById('imagen').value || null,
    categoria_id: Number(document.getElementById('categoria').value)
  };

  if (editandoId) {
    await fetch(`${API_URL}/productos/${editandoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(datosProducto)
    });
    editandoId = null;
    itemsReceta = [];
    document.getElementById('titulo-formulario').textContent = 'Agregar producto';
    document.getElementById('btn-guardar').textContent = 'Guardar';
    document.getElementById('seccion-receta').classList.add('oculto');
    document.getElementById('seccion-sucursales').classList.add('oculto');
    // Al guardar los cambios el panel se cierra y la tabla se actualiza.
    ocultarPanel();
  } else {
  const respuesta = await fetch(`${API_URL}/productos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(datosProducto)
  });

  const productoCreado = await respuesta.json();

  editandoId = productoCreado.id;
  document.getElementById('titulo-formulario').textContent = 'Editar producto';
  document.getElementById('btn-guardar').textContent = 'Guardar cambios';
  document.getElementById('seccion-subir-foto').classList.remove('oculto');
  document.getElementById('seccion-receta').classList.remove('oculto');
  cargarSucursalesDeProducto(editandoId);

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
    credentials: 'include',
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

// ---- Dónde se vende el producto (sucursales y precio de cada una) ----
// Solo aparece al editar un producto y cuando hay más de una sucursal activa. El precio y la
// disponibilidad del formulario de arriba son los de la sucursal en la que estás trabajando;
// acá se decide en qué sucursales se vende y a qué precio en cada una.
let sucursalesDelProducto = [];

async function cargarSucursalesDeProducto(productoId) {
  const seccion = document.getElementById('seccion-sucursales');

  const respuesta = await fetch(`${API_URL}/productos/${productoId}/sucursales`, { credentials: 'include' });
  if (!respuesta.ok) {
    seccion.classList.add('oculto');
    return;
  }
  sucursalesDelProducto = await respuesta.json();

  // Con una sola sucursal no hay nada que elegir: el panel se ve como siempre.
  if (sucursalesDelProducto.length <= 1) {
    seccion.classList.add('oculto');
    return;
  }

  const lista = document.getElementById('lista-sucursales-producto');
  lista.innerHTML = '';

  sucursalesDelProducto.forEach(s => {
    const fila = document.createElement('div');
    fila.className = 'fila-sucursal';
    fila.innerHTML = `
      <label class="pro-check">
        <input type="checkbox" class="chk-sucursal" data-id="${s.sucursal_id}" ${s.en_sucursal ? 'checked' : ''}>
        ${escapeHtml(s.nombre)}
      </label>
      <label class="pro-campo-inline">Precio <input type="number" class="precio-sucursal" data-id="${s.sucursal_id}" min="0" step="any" value="${s.en_sucursal ? escapeHtml(s.precio) : ''}"></label>
    `;
    lista.appendChild(fila);
  });

  // Al tildar una sucursal sin precio, se sugiere el que está cargado arriba en el formulario.
  document.querySelectorAll('.chk-sucursal').forEach(chk => {
    chk.addEventListener('change', () => {
      const campo = document.querySelector(`.precio-sucursal[data-id="${chk.dataset.id}"]`);
      if (chk.checked && campo.value === '') {
        campo.value = document.getElementById('precio').value;
      }
    });
  });

  seccion.classList.remove('oculto');
}

document.getElementById('btn-guardar-sucursales').addEventListener('click', async () => {
  if (!editandoId) {
    alert('Primero seleccioná un producto para editar');
    return;
  }

  const elegidas = [];
  for (const chk of document.querySelectorAll('.chk-sucursal')) {
    if (!chk.checked) continue;
    const campo = document.querySelector(`.precio-sucursal[data-id="${chk.dataset.id}"]`);
    if (campo.value === '' || Number(campo.value) < 0) {
      alert('Poné el precio de cada sucursal que tengas tildada');
      return;
    }
    elegidas.push({ sucursal_id: Number(chk.dataset.id), precio: Number(campo.value) });
  }

  if (elegidas.length === 0) {
    alert('El producto tiene que venderse en al menos una sucursal');
    return;
  }

  // Si se destilda una sucursal donde hoy se vende, se pide confirmación.
  const idsElegidos = elegidas.map(e => e.sucursal_id);
  const quitadas = sucursalesDelProducto.filter(s => s.en_sucursal && !idsElegidos.includes(Number(s.sucursal_id)));
  if (quitadas.length > 0) {
    const nombres = quitadas.map(s => s.nombre).join(', ');
    if (!confirm(`Vas a dejar de vender este producto en: ${nombres}. ¿Seguro?`)) return;
  }

  const respuesta = await fetch(`${API_URL}/productos/${editandoId}/sucursales`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sucursales: elegidas })
  });

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    alert(error.error || 'No se pudieron guardar las sucursales');
    return;
  }

  await cargarSucursalesDeProducto(editandoId);
  await cargarProductos();
  alert('Sucursales guardadas');
});

cargarCategorias();
cargarInsumosParaReceta();
cargarProductos();
