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

// ---------------------------------------------------------------------------
// Estado de la pantalla
// ---------------------------------------------------------------------------
let productosDelPedido = [];   // el "carrito" del formulario
let catalogoProductos = [];
let editandoPedidoId = null;
let pedidosActivos = [];       // últimos pedidos traídos del servidor
let tabEstado = 'todos';       // todos | pendiente | en preparación
let primerGustoPendiente = null; // producto elegido cuando "Combinar dos gustos" está tildado
let contadorCargas = 0;        // para ignorar respuestas viejas de cargarPedidos

const CLAVE_ATAJOS = 'pedidos_atajos_uso';
const CANTIDAD_ATAJOS = 6;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function $(id) { return document.getElementById(id); }

function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

// Sin tildes y en minúscula, para que "empanada" encuentre "Empanáda"
function normalizarTexto(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function textoMasa(tipo) {
  return tipo ? (tipo === 'molde' ? 'Al molde' : 'A la piedra') : '';
}

function mostrarAviso(texto) {
  $('pp-aviso-texto').textContent = texto;
  $('pp-aviso').classList.remove('oculto');
}
$('pp-aviso-cerrar').addEventListener('click', () => $('pp-aviso').classList.add('oculto'));

function mostrarError(texto) {
  const caja = $('error-pedido');
  caja.textContent = texto;
  caja.classList.toggle('oculto', !texto);
}

// ---------------------------------------------------------------------------
// Botones de opción (canal, medio de pago, entrega)
// Cada grupo escribe su valor en un input oculto con el id de siempre
// (canal, medio_pago, tipo_entrega), así el resto del código no cambia.
// ---------------------------------------------------------------------------
function elegirOpcion(campo, valor) {
  $(campo).value = valor;
  document.querySelectorAll(`.pp-chips[data-campo="${campo}"] .pp-chip`).forEach(chip => {
    chip.setAttribute('aria-pressed', String(chip.dataset.valor === valor));
  });

  if (campo === 'medio_pago') {
    const esMixto = valor === 'mixto';
    $('seccion-pago-mixto').classList.toggle('oculto', !esMixto);
    if (!esMixto) {
      $('monto-efectivo').value = '';
      $('monto-transferencia').value = '';
      $('mensaje-validacion-mixto').textContent = '';
    } else {
      validarPagoMixto();
    }
  }

  if (campo === 'tipo_entrega') {
    $('label-direccion').classList.toggle('oculto', valor !== 'envio');
  }
}

document.querySelectorAll('.pp-chips .pp-chip').forEach(chip => {
  chip.addEventListener('click', () => elegirOpcion(chip.parentElement.dataset.campo, chip.dataset.valor));
});

// ---------------------------------------------------------------------------
// Cliente por teléfono
// ---------------------------------------------------------------------------
$('telefono-cliente').addEventListener('blur', async (event) => {
  const telefono = event.target.value.trim();
  const mensaje = $('mensaje-cliente-encontrado');
  mensaje.textContent = '';

  if (!telefono) return;

  const respuesta = await fetch(`${API_URL}/clientes/telefono/${encodeURIComponent(telefono)}`, {
    credentials: 'include'
  });

  if (!respuesta.ok) {
    mensaje.textContent = 'Cliente nuevo (se va a guardar con este pedido)';
    return;
  }

  const cliente = await respuesta.json();

  $('cliente').value = cliente.nombre;

  if (cliente.direccion) {
    $('direccion_entrega').value = cliente.direccion;
    elegirOpcion('tipo_entrega', 'envio');
  }

  mensaje.textContent = `Cliente encontrado: ${cliente.nombre}`;
});

// ---------------------------------------------------------------------------
// Pago mixto
// ---------------------------------------------------------------------------
function totalDelCarrito() {
  return productosDelPedido.reduce((suma, item) => suma + (item.precio * item.cantidad), 0);
}

function validarPagoMixto() {
  const totalPedido = totalDelCarrito();
  const montoEfectivo = Number($('monto-efectivo').value) || 0;
  const montoTransferencia = Number($('monto-transferencia').value) || 0;
  const suma = montoEfectivo + montoTransferencia;
  const mensaje = $('mensaje-validacion-mixto');

  if (montoEfectivo === 0 && montoTransferencia === 0) {
    mensaje.textContent = '';
    mensaje.className = 'pp-msg-mixto';
    return true;
  }

  if (suma !== totalPedido) {
    mensaje.textContent = `La suma ($${formatearPrecio(suma)}) no coincide con el total del pedido ($${formatearPrecio(totalPedido)})`;
    mensaje.className = 'pp-msg-mixto balance-negativo pp-mal';
    return false;
  }

  mensaje.textContent = `Correcto: suma $${formatearPrecio(suma)}`;
  mensaje.className = 'pp-msg-mixto balance-positivo pp-ok';
  return true;
}

$('monto-efectivo').addEventListener('input', validarPagoMixto);
$('monto-transferencia').addEventListener('input', validarPagoMixto);

// ---------------------------------------------------------------------------
// Pedidos activos (columna derecha)
// ---------------------------------------------------------------------------
async function cargarPedidos() {
  const numeroDeCarga = ++contadorCargas;
  const respuesta = await fetch(`${API_URL}/pedidos?activos=1`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return;
  if (!respuesta.ok) {
    alert('No se pudieron cargar los pedidos. Actualizá la página.');
    return;
  }
  const pedidos = await respuesta.json();
  if (numeroDeCarga !== contadorCargas) return; // llegó una carga más nueva

  pedidosActivos = pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');
  actualizarOpcionesCanal();
  renderizarPedidos();
}

// El filtro de canal se arma con los canales que realmente hay en los pedidos
function actualizarOpcionesCanal() {
  const select = $('filtro-pedidos-canal');
  const actual = select.value;
  const canales = new Set(['WhatsApp', 'presencial']);
  pedidosActivos.forEach(p => { if (p.canal) canales.add(p.canal); });

  select.innerHTML = '<option value="todos">Todos</option>';
  canales.forEach(canal => {
    const option = document.createElement('option');
    option.value = canal;
    option.textContent = canal === 'presencial' ? 'Presencial' : canal;
    select.appendChild(option);
  });
  select.value = canales.has(actual) ? actual : 'todos';
}

function renderizarPedidos() {
  const contenedor = $('contenedor-pedidos');
  contenedor.innerHTML = '';

  const texto = normalizarTexto($('filtro-pedidos-texto').value.trim());
  const canal = $('filtro-pedidos-canal').value;

  const cuenta = { todos: pedidosActivos.length, pendiente: 0, 'en preparación': 0 };
  pedidosActivos.forEach(p => { if (cuenta[p.estado] !== undefined) cuenta[p.estado]++; });
  document.querySelectorAll('.pp-tab').forEach(tab => {
    const nombre = { todos: 'Todos', pendiente: 'Pendientes', 'en preparación': 'En preparación' }[tab.dataset.estado];
    tab.textContent = `${nombre} (${cuenta[tab.dataset.estado]})`;
    tab.setAttribute('aria-selected', String(tab.dataset.estado === tabEstado));
  });
  $('contador-pedidos').textContent = `${cuenta.todos} ${cuenta.todos === 1 ? 'pedido' : 'pedidos'}`;

  const visibles = pedidosActivos.filter(p =>
    (tabEstado === 'todos' || p.estado === tabEstado) &&
    (canal === 'todos' || p.canal === canal) &&
    (texto === '' || normalizarTexto(p.cliente).includes(texto) || String(p.id).includes(texto))
  );

  if (visibles.length === 0) {
    const vacio = document.createElement('div');
    vacio.className = 'pp-vacio';
    vacio.textContent = pedidosActivos.length === 0
      ? 'No hay pedidos activos.'
      : 'No hay pedidos con esos filtros.';
    contenedor.appendChild(vacio);
    return;
  }

  visibles.forEach(pedido => {
    const div = document.createElement('article');
    div.className = 'pp-pedido ' + (pedido.estado === 'pendiente' ? 'pp-pedido-pendiente' : 'pp-pedido-preparacion');
    if (String(pedido.id) === String(editandoPedidoId)) div.classList.add('pp-pedido-editando');

    const entrega = pedido.tipo_entrega === 'envio'
      ? `Envío - ${escapeHtml(pedido.direccion_entrega) || 'sin dirección'}`
      : 'Retiro en local';

    const detalleProductos = pedido.productos.map(item => {
      const masa = textoMasa(item.tipo_masa);
      const aclaracionTexto = item.aclaraciones ? ` (${escapeHtml(item.aclaraciones)})` : '';
      const nombre = item.nombre_producto_2
        ? `Mitad ${escapeHtml(item.nombre_producto)} / Mitad ${escapeHtml(item.nombre_producto_2)}`
        : escapeHtml(item.nombre_producto);
      return `<div>${item.cantidad} x ${nombre}${masa ? ' - ' + masa : ''}${aclaracionTexto}</div>`;
    }).join('');

    const infoPago = pedido.medio_pago === 'mixto'
      ? `Mixto (Efectivo: $${formatearPrecio(pedido.monto_efectivo)} / Transferencia: $${formatearPrecio(pedido.monto_transferencia)})`
      : pedido.medio_pago;

    const botonFactura = pedido.requiere_factura
      ? (pedido.ya_facturado
          ? `<button type="button" class="pp-btn pp-btn-sec pp-btn-chico" disabled>Ya facturado</button>`
          : `<button type="button" class="pp-btn pp-btn-amarillo pp-btn-chico btn-facturar" data-id="${pedido.id}">Facturar</button>`)
      : '';

    // Una vez impresa, el botón queda deshabilitado para no mandar la misma comanda dos veces a la
    // impresora. Se vuelve a habilitar automáticamente si el pedido se modifica (botón "Modificar").
    const botonComanda = pedido.ya_impreso
      ? `<span class="pp-impresa" title="Ya se imprimió. Modificá el pedido si necesitás otra copia.">Ya impresa ✓</span>`
      : `<button type="button" class="pp-link btn-comanda" data-id="${pedido.id}">Imprimir comanda</button>`;

    const siguiente = pedido.estado === 'pendiente' ? 'en preparación' : 'entregado';
    const textoAvanzar = pedido.estado === 'pendiente' ? 'Pasar a preparación' : 'Marcar entregado';

    div.innerHTML = `
      <div class="pp-pedido-cab">
        <div class="pp-pedido-titulo"><strong>#${pedido.id} - ${escapeHtml(pedido.cliente)}</strong> <span>| ${formatearFecha(pedido.creado_en)}</span></div>
        <span class="pp-pedido-estado">${escapeHtml(pedido.estado)}</span>
      </div>
      <div class="pp-pedido-datos">${escapeHtml(pedido.canal)} • ${escapeHtml(infoPago)} • ${entrega}</div>
      <div class="pp-pedido-items">${detalleProductos}</div>
      <div class="pp-pedido-total">Total: $${formatearPrecio(pedido.total)}</div>
      <div class="pp-pedido-acciones">
        ${botonFactura}
        <button type="button" class="pp-btn pp-btn-chico btn-avanzar" data-id="${pedido.id}" data-estado="${siguiente}">${textoAvanzar}</button>
        <select class="pp-input pp-input-chico pp-select-estado cambiar-estado" data-id="${pedido.id}" aria-label="Estado del pedido ${pedido.id}">
          <option value="pendiente" ${pedido.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="en preparación" ${pedido.estado === 'en preparación' ? 'selected' : ''}>En preparación</option>
          <option value="entregado" ${pedido.estado === 'entregado' ? 'selected' : ''}>Entregado</option>
        </select>
      </div>
      <div class="pp-pedido-links">
        ${botonComanda}
        <button type="button" class="pp-link btn-modificar" data-id="${pedido.id}">Modificar</button>
        <button type="button" class="pp-link pp-link-rojo btn-cancelar" data-id="${pedido.id}">Cancelar pedido</button>
      </div>
    `;
    contenedor.appendChild(div);
  });
}

async function cambiarEstadoPedido(id, nuevoEstado) {
  const respuestaEstado = await fetch(`${API_URL}/pedidos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ estado: nuevoEstado })
  });

  if (!respuestaEstado.ok) {
    const error = await respuestaEstado.json().catch(() => ({}));
    alert(error.error || 'No se pudo cambiar el estado del pedido');
  }

  cargarPedidos();
}

// Un solo listener para todos los botones de las tarjetas (se re-dibujan seguido)
$('contenedor-pedidos').addEventListener('click', async (event) => {
  const boton = event.target.closest('button');
  if (!boton || boton.disabled) return;
  const id = boton.dataset.id;

  if (boton.classList.contains('btn-avanzar')) {
    boton.disabled = true;
    await cambiarEstadoPedido(id, boton.dataset.estado);
    return;
  }

  if (boton.classList.contains('btn-facturar')) {
    boton.disabled = true;
    boton.textContent = 'Facturando...';

    const respuesta = await fetch(`${API_URL}/pedidos/${id}/facturar`, {
      method: 'POST',
      credentials: 'include'
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      alert(datos.error || 'Error al facturar');
      boton.disabled = false;
      boton.textContent = 'Facturar';
      return;
    }

    alert(`Factura emitida. CAE: ${datos.cae}`);
    cargarPedidos();
    return;
  }

  if (boton.classList.contains('btn-comanda')) {
    imprimirComanda(id, boton);
    return;
  }

  if (boton.classList.contains('btn-modificar')) {
    await cargarPedidoParaEditar(id);
    return;
  }

  if (boton.classList.contains('btn-cancelar')) {
    const confirmar = confirm('¿Seguro que querés cancelar este pedido?');
    if (!confirmar) return;

    const respuestaCancelar = await fetch(`${API_URL}/pedidos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ estado: 'cancelado' })
    });

    if (!respuestaCancelar.ok) {
      const error = await respuestaCancelar.json().catch(() => ({}));
      alert(error.error || 'No se pudo cancelar el pedido');
    }

    cargarPedidos();
  }
});

$('contenedor-pedidos').addEventListener('change', (event) => {
  if (event.target.classList.contains('cambiar-estado')) {
    cambiarEstadoPedido(event.target.dataset.id, event.target.value);
  }
});

document.querySelectorAll('.pp-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    tabEstado = tab.dataset.estado;
    renderizarPedidos();
  });
});
$('filtro-pedidos-texto').addEventListener('input', renderizarPedidos);
$('filtro-pedidos-canal').addEventListener('change', renderizarPedidos);

async function imprimirComanda(pedidoId, boton) {
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Imprimiendo...';

  try {
    const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}/imprimir-comanda`, {
      method: 'POST',
      credentials: 'include'
    });

    if (!respuesta.ok) {
      const error = await respuesta.json();
      alert(error.error || 'No se pudo imprimir la comanda');
      return;
    }
  } catch (error) {
    alert('Error al conectar con la impresora');
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

// ---------------------------------------------------------------------------
// Modificar un pedido existente
// ---------------------------------------------------------------------------
function resetearFormulario() {
  editandoPedidoId = null;
  productosDelPedido = [];
  primerGustoPendiente = null;
  $('formulario-pedido').reset();
  elegirOpcion('canal', 'WhatsApp');
  elegirOpcion('medio_pago', 'efectivo');
  elegirOpcion('tipo_entrega', 'retiro');
  $('titulo-formulario').textContent = 'Nuevo pedido';
  $('btn-guardar-pedido').textContent = 'Crear pedido';
  $('btn-cancelar-edicion-pedido').classList.add('oculto');
  $('label-cuit').classList.add('oculto');
  $('mensaje-cliente-encontrado').textContent = '';
  $('mensaje-validacion-mixto').textContent = '';
  $('producto-seleccionado-id').value = '';
  $('producto-seleccionado-precio').value = '';
  $('producto-seleccionado-nombre').value = '';
  $('resultados-busqueda').classList.add('oculto');
  actualizarAvisoCombinar();
  mostrarError('');
  renderizarListaProductos();
  renderizarPedidos();
}

async function cargarPedidoParaEditar(pedidoId) {
  const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}`, { credentials: 'include' });

  if (!respuesta.ok) {
    alert('No se pudo cargar el pedido para editar');
    return;
  }

  const pedido = await respuesta.json();

  editandoPedidoId = pedidoId;
  primerGustoPendiente = null;
  $('check-combinar').checked = false;
  actualizarAvisoCombinar();
  mostrarError('');

  $('cliente').value = pedido.cliente;
  elegirOpcion('canal', pedido.canal);
  elegirOpcion('medio_pago', pedido.medio_pago);
  elegirOpcion('tipo_entrega', pedido.tipo_entrega);
  $('direccion_entrega').value = pedido.direccion_entrega || '';
  $('cuit_receptor').value = pedido.cuit_receptor || '';

  if (pedido.medio_pago === 'mixto') {
    $('monto-efectivo').value = pedido.monto_efectivo || '';
    $('monto-transferencia').value = pedido.monto_transferencia || '';
  }

  if (pedido.cuit_receptor) {
    $('check-facturar-cuit').checked = true;
    $('label-cuit').classList.remove('oculto');
  }

  productosDelPedido = pedido.productos.map(item => {
    const nombre = item.nombre_producto_2
      ? `Mitad ${item.nombre_producto} / Mitad ${item.nombre_producto_2}`
      : item.nombre_producto;

    return {
      producto_id: item.producto_id,
      producto_id_2: item.producto_id_2 || undefined,
      cantidad: item.cantidad,
      precio: Number(item.precio_unitario),
      nombre,
      tipo_masa: item.tipo_masa,
      aclaraciones: item.aclaraciones,
      requiere_masa: !!item.tipo_masa
    };
  });

  renderizarListaProductos();
  validarPagoMixto();

  $('titulo-formulario').textContent = `Modificar pedido #${pedidoId}`;
  $('btn-guardar-pedido').textContent = 'Guardar cambios';
  $('btn-cancelar-edicion-pedido').classList.remove('oculto');
  renderizarPedidos();

  $('formulario-pedido').scrollIntoView({ behavior: 'smooth' });
}

$('btn-cancelar-edicion-pedido').addEventListener('click', resetearFormulario);

// ---------------------------------------------------------------------------
// Catálogo, búsqueda y atajos
// ---------------------------------------------------------------------------
async function cargarProductosEnFormulario() {
  const respuesta = await fetch(`${API_URL}/productos`, { credentials: 'include' });
  const todosLosProductos = await respuesta.json();
  catalogoProductos = todosLosProductos.filter(p => p.disponible);
  renderizarAtajos();
}

function leerUsoAtajos() {
  try { return JSON.parse(localStorage.getItem(CLAVE_ATAJOS) || '{}'); } catch (e) { return {}; }
}

function anotarUsoAtajo(productoId) {
  try {
    const uso = leerUsoAtajos();
    uso[productoId] = (uso[productoId] || 0) + 1;
    localStorage.setItem(CLAVE_ATAJOS, JSON.stringify(uso));
  } catch (e) { /* si el navegador no deja guardar, los atajos siguen andando igual */ }
}

// Los atajos son los productos que más se agregaron en esta computadora.
// Si todavía no hay historial, se muestran los primeros del catálogo.
function renderizarAtajos() {
  const uso = leerUsoAtajos();
  const ordenados = catalogoProductos
    .map((p, i) => ({ p, i, veces: uso[p.id] || 0 }))
    .sort((a, b) => (b.veces - a.veces) || (a.i - b.i))
    .slice(0, CANTIDAD_ATAJOS);

  const contenedor = $('atajos-productos');
  contenedor.innerHTML = '';
  ordenados.forEach(({ p }) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'pp-chip pp-chip-suave';
    boton.textContent = `+ ${p.nombre}`;
    boton.addEventListener('click', () => elegirProducto(p));
    contenedor.appendChild(boton);
  });
}

$('buscador-producto').addEventListener('input', (event) => {
  const texto = normalizarTexto(event.target.value.trim());
  const resultados = $('resultados-busqueda');

  if (texto.length < 2) {
    resultados.classList.add('oculto');
    return;
  }

  const coincidencias = catalogoProductos.filter(p => normalizarTexto(p.nombre).includes(texto));

  resultados.innerHTML = '';
  coincidencias.forEach(producto => {
    const li = document.createElement('li');
    li.textContent = `${producto.nombre} - $${formatearPrecio(producto.precio)}`;
    li.addEventListener('click', () => {
      resultados.classList.add('oculto');
      $('buscador-producto').value = '';
      elegirProducto(producto);
    });
    resultados.appendChild(li);
  });

  resultados.classList.toggle('oculto', coincidencias.length === 0);
});

// Al tocar cualquier campo del formulario se borra el error anterior
$('formulario-pedido').addEventListener('input', () => mostrarError(''));

// Enter en el buscador no debe mandar el pedido
$('buscador-producto').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') event.preventDefault();
});

// Si se toca afuera del buscador, se cierra la lista de resultados
document.addEventListener('click', (event) => {
  if (!event.target.closest('.pp-buscador')) $('resultados-busqueda').classList.add('oculto');
});

function actualizarAvisoCombinar() {
  const aviso = $('aviso-combinar');
  if (primerGustoPendiente) {
    $('texto-combinar').textContent = `Primer gusto: ${primerGustoPendiente.nombre}. Elegí el segundo gusto.`;
    aviso.classList.remove('oculto');
  } else {
    aviso.classList.add('oculto');
  }
}

$('check-combinar').addEventListener('change', () => {
  primerGustoPendiente = null;
  actualizarAvisoCombinar();
});

$('btn-cambiar-primer-gusto').addEventListener('click', () => {
  primerGustoPendiente = null;
  actualizarAvisoCombinar();
});

// Se llama al tocar un resultado de búsqueda o un atajo
function elegirProducto(producto) {
  mostrarError('');

  if ($('check-combinar').checked) {
    if (!primerGustoPendiente) {
      primerGustoPendiente = producto;
      actualizarAvisoCombinar();
      return;
    }
    const primero = primerGustoPendiente;
    agregarAlCarrito({
      producto_id: Number(primero.id),
      producto_id_2: Number(producto.id),
      cantidad: 1,
      precio: (Number(primero.precio) / 2) + (Number(producto.precio) / 2) + 1000,
      nombre: `Mitad ${primero.nombre} / Mitad ${producto.nombre}`,
      tipo_masa: primero.requiere_masa ? 'piedra' : null,
      aclaraciones: null,
      requiere_masa: !!primero.requiere_masa
    });
    anotarUsoAtajo(primero.id);
    anotarUsoAtajo(producto.id);
    primerGustoPendiente = null;
    $('check-combinar').checked = false;
    actualizarAvisoCombinar();
    return;
  }

  agregarAlCarrito({
    producto_id: Number(producto.id),
    cantidad: 1,
    precio: Number(producto.precio),
    nombre: producto.nombre,
    tipo_masa: producto.requiere_masa ? 'piedra' : null,
    aclaraciones: null,
    requiere_masa: !!producto.requiere_masa
  });
  anotarUsoAtajo(producto.id);
}

// Si ya hay una línea igual (mismo producto, masa y sin aclaraciones) le suma uno
function agregarAlCarrito(item) {
  const igual = productosDelPedido.find(x =>
    x.producto_id === item.producto_id &&
    (x.producto_id_2 || null) === (item.producto_id_2 || null) &&
    (x.tipo_masa || null) === (item.tipo_masa || null) &&
    !x.aclaraciones && !item.aclaraciones
  );
  if (igual) {
    igual.cantidad += item.cantidad;
  } else {
    productosDelPedido.push(item);
  }
  renderizarListaProductos();
  validarPagoMixto();
}

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------
function actualizarTotal() {
  $('total-pedido').textContent = `Total: $${formatearPrecio(totalDelCarrito())}`;
}

function renderizarListaProductos() {
  const lista = $('lista-productos-agregados');
  lista.innerHTML = '';

  if (productosDelPedido.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'pp-carrito-vacio';
    vacio.textContent = 'Todavía no agregaste productos. Buscá uno o tocá un atajo.';
    lista.appendChild(vacio);
  }

  productosDelPedido.forEach((item, index) => {
    const subtotal = item.precio * item.cantidad;
    const fila = document.createElement('div');
    fila.className = 'pp-linea';
    fila.dataset.index = index;

    const masaHtml = item.requiere_masa ? `
      <div class="pp-linea-masa">
        <span>Masa</span>
        <button type="button" class="pp-chip pp-chip-mini" data-accion="masa" data-valor="piedra" aria-pressed="${item.tipo_masa === 'piedra'}">A la piedra</button>
        <button type="button" class="pp-chip pp-chip-mini" data-accion="masa" data-valor="molde" aria-pressed="${item.tipo_masa === 'molde'}">Al molde</button>
      </div>` : '';

    fila.innerHTML = `
      <div class="pp-linea-fila">
        <div class="pp-linea-nombre">${escapeHtml(item.nombre)}</div>
        <div class="pp-linea-cantidad">
          <button type="button" class="pp-paso" data-accion="menos" aria-label="Quitar uno de ${escapeHtml(item.nombre)}">−</button>
          <input type="number" class="pp-cant" min="1" value="${item.cantidad}" aria-label="Cantidad de ${escapeHtml(item.nombre)}">
          <button type="button" class="pp-paso" data-accion="mas" aria-label="Sumar uno de ${escapeHtml(item.nombre)}">+</button>
        </div>
        <div class="pp-linea-subtotal">$${formatearPrecio(subtotal)}</div>
      </div>
      ${masaHtml}
      <input type="text" class="pp-input pp-input-chico pp-acl" placeholder="Aclaraciones (ej: bien cocida, sin orégano)" aria-label="Aclaraciones de ${escapeHtml(item.nombre)}" value="${escapeHtml(item.aclaraciones || '')}">
    `;
    lista.appendChild(fila);
  });

  actualizarTotal();
}

const listaCarrito = $('lista-productos-agregados');

listaCarrito.addEventListener('click', (event) => {
  const boton = event.target.closest('button');
  if (!boton) return;
  const fila = boton.closest('.pp-linea');
  const index = Number(fila.dataset.index);
  const accion = boton.dataset.accion;

  if (accion === 'mas') {
    productosDelPedido[index].cantidad += 1;
  } else if (accion === 'menos') {
    productosDelPedido[index].cantidad -= 1;
    if (productosDelPedido[index].cantidad < 1) productosDelPedido.splice(index, 1);
  } else if (accion === 'masa') {
    productosDelPedido[index].tipo_masa = boton.dataset.valor;
  } else {
    return;
  }
  renderizarListaProductos();
  validarPagoMixto();
});

listaCarrito.addEventListener('change', (event) => {
  if (!event.target.classList.contains('pp-cant')) return;
  const index = Number(event.target.closest('.pp-linea').dataset.index);
  const cantidad = Math.floor(Number(event.target.value));
  productosDelPedido[index].cantidad = cantidad >= 1 ? cantidad : 1;
  renderizarListaProductos();
  validarPagoMixto();
});

// Las aclaraciones se guardan mientras se escribe, sin redibujar la lista
listaCarrito.addEventListener('input', (event) => {
  if (!event.target.classList.contains('pp-acl')) return;
  const index = Number(event.target.closest('.pp-linea').dataset.index);
  productosDelPedido[index].aclaraciones = event.target.value || null;
});

$('check-facturar-cuit').addEventListener('change', (event) => {
  $('label-cuit').classList.toggle('oculto', !event.target.checked);
});

// ---------------------------------------------------------------------------
// Guardar (crear o modificar)
// ---------------------------------------------------------------------------
$('formulario-pedido').addEventListener('submit', async (event) => {
  event.preventDefault();
  mostrarError('');

  if (productosDelPedido.length === 0) {
    mostrarError('Agregá al menos un producto');
    return;
  }

  if (!$('cliente').value.trim()) {
    mostrarError('Completá el nombre del cliente.');
    return;
  }

  const medioPago = $('medio_pago').value;
  let montoEfectivo = null;
  let montoTransferencia = null;

  if (medioPago === 'mixto') {
    montoEfectivo = Number($('monto-efectivo').value) || 0;
    montoTransferencia = Number($('monto-transferencia').value) || 0;

    if (montoEfectivo === 0 && montoTransferencia === 0) {
      mostrarError('En un pago mixto tenés que indicar cuánto va en efectivo y cuánto en transferencia');
      return;
    }
    if (!validarPagoMixto()) {
      mostrarError('La suma de efectivo y transferencia debe coincidir con el total del pedido');
      return;
    }
  }

  const datosGenerales = {
    cliente: $('cliente').value,
    canal: $('canal').value,
    medio_pago: medioPago,
    monto_efectivo: montoEfectivo,
    monto_transferencia: montoTransferencia,
    telefono: $('telefono-cliente').value || null,
    tipo_entrega: $('tipo_entrega').value,
    direccion_entrega: $('direccion_entrega').value || null,
    cuit_receptor: ($('check-facturar-cuit').checked && $('cuit_receptor').value) || null,
    // Se mandan solo los campos que el servidor conoce (sin los de uso interno de la pantalla)
    productos: productosDelPedido.map(item => ({
      producto_id: item.producto_id,
      producto_id_2: item.producto_id_2,
      cantidad: item.cantidad,
      precio: item.precio,
      nombre: item.nombre,
      tipo_masa: item.tipo_masa || null,
      aclaraciones: item.aclaraciones || null
    }))
  };

  const botonGuardar = $('btn-guardar-pedido');
  botonGuardar.disabled = true;

  try {
    if (editandoPedidoId) {
      const idEditado = editandoPedidoId;
      const respuesta = await fetch(`${API_URL}/pedidos/${idEditado}/productos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(datosGenerales)
      });

      if (!respuesta.ok) {
        const error = await respuesta.json().catch(() => ({}));
        mostrarError(error.error || 'Error al modificar el pedido');
        return;
      }

      resetearFormulario();
      mostrarAviso(`Pedido #${idEditado} modificado. La comanda se puede volver a imprimir.`);
      cargarPedidos();
      return;
    }

    const respuesta = await fetch(`${API_URL}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(datosGenerales)
    });

    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      mostrarError(error.error || 'Error al crear el pedido');
      return;
    }

    const creado = await respuesta.json().catch(() => ({}));
    resetearFormulario();
    mostrarAviso(creado && creado.id ? `Pedido #${creado.id} creado.` : 'Pedido creado.');
    cargarPedidos();
  } finally {
    botonGuardar.disabled = false;
  }
});

renderizarListaProductos();
cargarPedidos();
cargarProductosEnFormulario();
