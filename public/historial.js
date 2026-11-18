const API_URL = window.location.origin;

const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
if (!usuario) {
  window.location.href = "login.html";
}

document.getElementById("info-usuario").textContent =
  `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin([
  "link-productos",
  "link-insumos",
  "link-compras",
  "link-caja",
  "link-usuarios",
  "link-sucursales",
  "link-clientes",
  "link-dashboard",
]);

document.getElementById("btn-logout").addEventListener("click", async () => {
  await fetch(`${API_URL}/usuarios/logout`, {
    method: "POST",
    credentials: "include",
  });
  localStorage.removeItem("usuario");
  window.location.href = "login.html";
});

function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearPrecio(numero) {
  return Number(numero).toLocaleString("es-AR");
}

// Para buscar sin importar mayúsculas ni tildes.
function normalizarTexto(texto) {
  return String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// El "día comercial" arranca a las 6 de la mañana: antes de esa hora todavía cuenta como el día anterior.
// Se arma la fecha con el día LOCAL (antes se usaba toISOString, que pasa a UTC y entre las 3 y las 6 de la
// madrugada daba el día equivocado).
function obtenerFechaComercial(offsetDias = 0) {
  const ahora = new Date();
  ahora.setHours(ahora.getHours() - 6);
  ahora.setDate(ahora.getDate() + offsetDias);
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

// ---- Estado de la pantalla ----
const PEDIDOS_POR_PAGINA = 10;
let pedidosDelDia = [];
let pedidosCargados = false;
let fechaMostrada = null;
let pedidoAbiertoId = null;
let ultimaCarga = 0; // para ignorar respuestas viejas si se cambia de fecha rápido
const filtros = { texto: "", estado: "todos", factura: "todos", canal: "todos", pagina: 1 };

function estadoFactura(pedido) {
  if (!pedido.requiere_factura) return "no";
  return pedido.ya_facturado ? "emitida" : "pendiente";
}

function textoEntrega(pedido) {
  return pedido.tipo_entrega === "envio"
    ? `Envío - ${escapeHtml(pedido.direccion_entrega) || "sin dirección"}`
    : "Retiro en local";
}

async function cargarHistorial(fecha) {
  if (!fecha) return;
  const numeroCarga = ++ultimaCarga;

  const respuesta = await fetch(`${API_URL}/pedidos/por-fecha?fecha=${fecha}`, {
    credentials: "include",
  });

  if (manejarNoAutorizado(respuesta)) return;
  if (numeroCarga !== ultimaCarga) return;

  const aviso = document.getElementById("mensaje-historial");

  if (!respuesta.ok) {
    aviso.textContent = "No se pudieron cargar los pedidos. Probá de nuevo.";
    aviso.classList.remove("oculto");
    return;
  }
  aviso.classList.add("oculto");

  const pedidos = await respuesta.json();
  if (numeroCarga !== ultimaCarga) return;

  // Si se cambió de fecha, se arranca de cero (filtros y detalle abierto).
  if (fecha !== fechaMostrada) {
    filtros.texto = "";
    filtros.estado = "todos";
    filtros.factura = "todos";
    filtros.canal = "todos";
    filtros.pagina = 1;
    document.getElementById("buscar-pedido").value = "";
    document.getElementById("filtro-factura-pedido").value = "todos";
    cerrarPanel();
  }

  fechaMostrada = fecha;
  pedidosDelDia = pedidos;
  pedidosCargados = true;
  renderizarTabla();

  // Si había un pedido abierto (por ejemplo, recién facturado), el detalle se actualiza.
  if (pedidoAbiertoId !== null) {
    if (pedidosDelDia.some((p) => String(p.id) === String(pedidoAbiertoId))) {
      renderizarDetalle();
    } else {
      cerrarPanel();
    }
  }
}

function pedidosFiltrados() {
  const texto = normalizarTexto(filtros.texto.trim().replace(/^#/, ""));
  return pedidosDelDia.filter((p) => {
    if (filtros.canal !== "todos" && p.canal !== filtros.canal) return false;
    if (filtros.estado !== "todos" && p.estado !== filtros.estado) return false;
    if (filtros.factura !== "todos" && estadoFactura(p) !== filtros.factura) return false;
    if (texto && !(normalizarTexto(p.cliente).includes(texto) || String(p.id).includes(texto))) return false;
    return true;
  });
}

function renderizarTabla() {
  if (!pedidosCargados) return;

  // Estados y canales que aparezcan en los pedidos de esa fecha.
  const estados = [...new Set(pedidosDelDia.map((p) => p.estado))];
  const selectEstado = document.getElementById("filtro-estado-pedido");
  selectEstado.innerHTML = '<option value="todos">Todos</option>' +
    estados.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
  if (!estados.includes(filtros.estado)) filtros.estado = "todos";
  selectEstado.value = filtros.estado;

  const canales = [...new Set(pedidosDelDia.map((p) => p.canal))];
  const chips = document.getElementById("chips-canal");
  chips.innerHTML = "";
  [{ id: "todos", nombre: "Todos", cantidad: pedidosDelDia.length }].concat(
    canales.map((c) => ({ id: c, nombre: c, cantidad: pedidosDelDia.filter((p) => p.canal === c).length }))
  ).forEach((opcion) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "chip";
    boton.dataset.canal = opcion.id;
    boton.setAttribute("aria-pressed", String(filtros.canal === opcion.id));
    boton.textContent = `${opcion.nombre} ${opcion.cantidad}`;
    chips.appendChild(boton);
  });

  const filtrados = pedidosFiltrados();
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PEDIDOS_POR_PAGINA));
  if (filtros.pagina > totalPaginas) filtros.pagina = totalPaginas;
  const desde = (filtros.pagina - 1) * PEDIDOS_POR_PAGINA;
  const visibles = filtrados.slice(desde, desde + PEDIDOS_POR_PAGINA);

  const suma = filtrados.reduce((acumulado, p) => acumulado + Number(p.total), 0);
  document.getElementById("resumen-historial").textContent = filtrados.length === 0
    ? ""
    : `${filtrados.length} ${filtrados.length === 1 ? "pedido" : "pedidos"} - Total: $${formatearPrecio(suma)}`;

  const contenedor = document.getElementById("contenedor-historial");
  contenedor.innerHTML = "";

  visibles.forEach((pedido) => {
    let facturaHtml = '<span class="col-suave">—</span>';
    if (pedido.requiere_factura) {
      facturaHtml = pedido.ya_facturado
        ? `<span class="estado estado-ok">Facturado</span>${pedido.tiene_nota_credito ? "<small>Con nota de crédito</small>" : ""}`
        : '<span class="estado estado-pendiente">Sin emitir</span>';
    }

    const estadoClase = /cancel|anul/i.test(pedido.estado) ? "estado-no" : "";
    const botonFacturar = pedido.requiere_factura && !pedido.ya_facturado
      ? `<button type="button" class="btn-tabla btn-amarillo-chico btn-facturar-historial" data-id="${pedido.id}">Facturar</button>`
      : "";

    const fila = document.createElement("tr");
    fila.dataset.id = pedido.id;
    if (String(pedido.id) === String(pedidoAbiertoId)) fila.classList.add("fila-editando");
    fila.innerHTML = `
      <td class="col-nowrap"><strong>#${pedido.id}</strong><small>${formatearFecha(pedido.creado_en)}</small></td>
      <td><strong>${escapeHtml(pedido.cliente)}</strong><small>${pedido.tipo_entrega === "envio" ? "Envío" : "Retiro en local"}</small></td>
      <td>${escapeHtml(pedido.canal)}<small>${escapeHtml(pedido.medio_pago)}</small></td>
      <td class="col-precio">$${formatearPrecio(pedido.total)}</td>
      <td><span class="estado ${estadoClase}">${escapeHtml(pedido.estado)}</span></td>
      <td>${facturaHtml}</td>
      <td class="col-acciones">
        ${botonFacturar}
        <button type="button" class="btn-tabla btn-ver-detalle" data-id="${pedido.id}" aria-label="Ver detalle del pedido ${pedido.id}">Ver detalle</button>
      </td>
    `;
    contenedor.appendChild(fila);
  });

  document.getElementById("sin-pedidos").classList.toggle("oculto", pedidosDelDia.length > 0);
  document.getElementById("sin-resultados-pedidos").classList.toggle("oculto", pedidosDelDia.length === 0 || filtrados.length > 0);

  document.getElementById("rango-pedidos").textContent = filtrados.length === 0
    ? "Sin resultados"
    : `Mostrando ${desde + 1} a ${desde + visibles.length} de ${filtrados.length}`;

  const paginacion = document.getElementById("paginacion-pedidos");
  paginacion.innerHTML = "";
  const agregarBotonPagina = (textoBoton, pagina, { activa = false, deshabilitada = false, etiqueta = "" } = {}) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "pagina";
    boton.dataset.pagina = pagina;
    boton.textContent = textoBoton;
    boton.disabled = deshabilitada;
    if (etiqueta) boton.setAttribute("aria-label", etiqueta);
    if (activa) boton.setAttribute("aria-current", "page");
    paginacion.appendChild(boton);
  };
  agregarBotonPagina("Anterior", filtros.pagina - 1, { deshabilitada: filtros.pagina <= 1 });
  for (let n = 1; n <= totalPaginas; n++) {
    agregarBotonPagina(String(n), n, { activa: n === filtros.pagina, etiqueta: `Página ${n}` });
  }
  agregarBotonPagina("Siguiente", filtros.pagina + 1, { deshabilitada: filtros.pagina >= totalPaginas });
}

// ---- Panel de detalle del pedido ----
const panelPedido = document.getElementById("panel-pedido");

function renderizarDetalle() {
  const pedido = pedidosDelDia.find((p) => String(p.id) === String(pedidoAbiertoId));
  if (!pedido) return;

  document.getElementById("titulo-detalle-pedido").textContent = `Pedido #${pedido.id}`;

  const productos = (pedido.productos || [])
    .map((item) => {
      const nombre = item.nombre_producto_2
        ? `Mitad ${escapeHtml(item.nombre_producto)} / Mitad ${escapeHtml(item.nombre_producto_2)}`
        : escapeHtml(item.nombre_producto);
      return `<li>${item.cantidad} x ${nombre}</li>`;
    })
    .join("");

  let facturaHtml = "<p>Este pedido no requiere factura.</p>";
  if (pedido.requiere_factura) {
    if (pedido.ya_facturado) {
      const vencimiento = pedido.vencimiento_cae ? pedido.vencimiento_cae.split("T")[0] : "";
      facturaHtml = `
        <p>Factura N° ${escapeHtml(pedido.numero_comprobante)} - CAE: ${escapeHtml(pedido.cae)} (vto: ${vencimiento})</p>
        <div class="pro-botones">
          <button type="button" class="btn-pro btn-ver-pdf" data-id="${pedido.id}">Ver PDF</button>
          ${pedido.tiene_nota_credito ? `<button type="button" class="btn-sec btn-ver-nc" data-id="${pedido.id}">Ver nota de crédito</button>` : ""}
          <button type="button" class="btn-sec btn-anular-factura" data-id="${pedido.id}" data-total="${pedido.total}">Anular factura</button>
        </div>`;
    } else {
      facturaHtml = `
        <p>Requiere factura - sin emitir</p>
        <div class="pro-botones">
          <button type="button" class="btn-pro btn-amarillo btn-facturar-historial" data-id="${pedido.id}">Facturar</button>
        </div>`;
    }
  }

  document.getElementById("contenido-detalle-pedido").innerHTML = `
    <dl class="detalle-datos">
      <dt>Cliente</dt><dd>${escapeHtml(pedido.cliente)}</dd>
      <dt>Fecha</dt><dd>${formatearFecha(pedido.creado_en)}</dd>
      <dt>Canal</dt><dd>${escapeHtml(pedido.canal)}</dd>
      <dt>Pago</dt><dd>${escapeHtml(pedido.medio_pago)}</dd>
      <dt>Entrega</dt><dd>${textoEntrega(pedido)}</dd>
      <dt>Estado</dt><dd>${escapeHtml(pedido.estado)}</dd>
      <dt>Total</dt><dd>$${formatearPrecio(pedido.total)}</dd>
    </dl>
    <h3>Productos</h3>
    <ul class="detalle-productos">${productos || "<li>Sin productos</li>"}</ul>
    <h3>Factura</h3>
    <div class="detalle-bloque">${facturaHtml}</div>
  `;
}

function abrirDetalle(pedidoId) {
  pedidoAbiertoId = pedidoId;
  renderizarDetalle();
  panelPedido.classList.remove("oculto");
  renderizarTabla();
  panelPedido.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function cerrarPanel() {
  pedidoAbiertoId = null;
  panelPedido.classList.add("oculto");
  renderizarTabla();
}

document.getElementById("btn-cerrar-panel-pedido").addEventListener("click", cerrarPanel);

// ---- Acciones de factura (las mismas de siempre) ----
async function verPdf(pedidoId) {
  const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}/pdf`, {
    credentials: "include",
  });

  if (manejarNoAutorizado(respuesta)) return;

  if (!respuesta.ok) {
    alert("No se pudo obtener el PDF de la factura");
    return;
  }

  const blob = await respuesta.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

async function verNotaCredito(pedidoId) {
  const respuesta = await fetch(
    `${API_URL}/pedidos/${pedidoId}/pdf-nota-credito`,
    {
      credentials: "include",
    },
  );

  if (manejarNoAutorizado(respuesta)) return;

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    alert(error.error || "No se pudo obtener la nota de crédito");
    return;
  }

  const blob = await respuesta.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

async function anularFactura(pedidoId, totalFactura, fechaActual) {
  const montoTexto = prompt(
    `¿Qué monto querés acreditar? (Total facturado: $${formatearPrecio(totalFactura)})`,
    totalFactura,
  );

  if (montoTexto === null) return;

  const monto = Number(montoTexto);

  if (!monto || monto <= 0 || monto > totalFactura) {
    alert(
      "Monto inválido. Tiene que ser mayor a $0 y no superar el total de la factura.",
    );
    return;
  }

  const motivo = prompt("Motivo de la anulación (opcional):", "") || null;

  const confirmar = confirm(
    `⚠ ATENCIÓN — Acción irreversible ⚠\n\n` +
      `Vas a emitir una Nota de Crédito por $${formatearPrecio(monto)}, ` +
      `asociada al pedido #${pedidoId}.\n\n` +
      `Esto queda registrado formalmente ante ARCA y NO se puede deshacer ni editar después.\n\n` +
      `¿Estás seguro de que querés continuar?`,
  );
  if (!confirmar) return;

  const respuesta = await fetch(
    `${API_URL}/pedidos/${pedidoId}/anular-factura`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ monto, motivo }),
    },
  );

  if (manejarNoAutorizado(respuesta)) return;

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    alert(datos.error || "Error al emitir la nota de crédito");
    return;
  }

  alert(`Nota de crédito emitida. CAE: ${datos.cae}`);
  cargarHistorial(fechaActual);
}

async function facturarDesdeHistorial(pedidoId, boton, fechaActual) {
  boton.disabled = true;
  boton.textContent = "Facturando...";

  const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}/facturar`, {
    method: "POST",
    credentials: "include",
  });

  if (manejarNoAutorizado(respuesta)) return;

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    alert(datos.error || "Error al facturar");
    boton.disabled = false;
    boton.textContent = "Facturar";
    return;
  }

  alert(`Factura emitida. CAE: ${datos.cae}`);
  cargarHistorial(fechaActual);
}

// Un solo manejador para los botones de la tabla y los del panel.
function manejarClickPedido(event) {
  const boton = event.target.closest("button");
  if (!boton) return;
  const id = boton.dataset.id;

  if (boton.classList.contains("btn-ver-detalle")) {
    abrirDetalle(id);
  } else if (boton.classList.contains("btn-ver-pdf")) {
    verPdf(id);
  } else if (boton.classList.contains("btn-ver-nc")) {
    verNotaCredito(id);
  } else if (boton.classList.contains("btn-anular-factura")) {
    anularFactura(id, Number(boton.dataset.total), fechaMostrada);
  } else if (boton.classList.contains("btn-facturar-historial")) {
    facturarDesdeHistorial(id, boton, fechaMostrada);
  }
}
document.getElementById("contenedor-historial").addEventListener("click", manejarClickPedido);
document.getElementById("contenido-detalle-pedido").addEventListener("click", manejarClickPedido);

// ---- Filtros y paginación ----
document.getElementById("buscar-pedido").addEventListener("input", (e) => {
  filtros.texto = e.target.value;
  filtros.pagina = 1;
  renderizarTabla();
});
document.getElementById("filtro-estado-pedido").addEventListener("change", (e) => {
  filtros.estado = e.target.value;
  filtros.pagina = 1;
  renderizarTabla();
});
document.getElementById("filtro-factura-pedido").addEventListener("change", (e) => {
  filtros.factura = e.target.value;
  filtros.pagina = 1;
  renderizarTabla();
});
document.getElementById("chips-canal").addEventListener("click", (e) => {
  const boton = e.target.closest("button[data-canal]");
  if (!boton) return;
  filtros.canal = boton.dataset.canal;
  filtros.pagina = 1;
  renderizarTabla();
});
document.getElementById("paginacion-pedidos").addEventListener("click", (e) => {
  const boton = e.target.closest("button[data-pagina]");
  if (!boton || boton.disabled) return;
  filtros.pagina = Number(boton.dataset.pagina);
  renderizarTabla();
});
document.getElementById("btn-limpiar-filtros-pedidos").addEventListener("click", () => {
  filtros.texto = "";
  filtros.estado = "todos";
  filtros.factura = "todos";
  filtros.canal = "todos";
  filtros.pagina = 1;
  document.getElementById("buscar-pedido").value = "";
  document.getElementById("filtro-factura-pedido").value = "todos";
  renderizarTabla();
});

// ---- Fecha ----
document.getElementById("filtro-fecha").addEventListener("change", (event) => {
  cargarHistorial(event.target.value);
});

document.getElementById("btn-hoy").addEventListener("click", () => {
  const fecha = obtenerFechaComercial(0);
  document.getElementById("filtro-fecha").value = fecha;
  cargarHistorial(fecha);
});

document.getElementById("btn-ayer").addEventListener("click", () => {
  const fecha = obtenerFechaComercial(-1);
  document.getElementById("filtro-fecha").value = fecha;
  cargarHistorial(fecha);
});

const fechaInicial = obtenerFechaComercial(0);
document.getElementById("filtro-fecha").value = fechaInicial;
cargarHistorial(fechaInicial);
