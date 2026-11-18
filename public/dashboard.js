requiereAdmin();

const API_URL = window.location.origin;

const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!usuario) {
  window.location.href = 'login.html';
}

document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-clientes', 'link-caja', 'link-usuarios', 'link-sucursales', 'link-dashboard']);

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

// Fechas con el día LOCAL (toISOString pasa a UTC y después de las 21 hs daba el día siguiente).
function fechaLocal(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function obtenerRangoUltimoMes() {
  const hoy = new Date();
  const haceUnMes = new Date();
  haceUnMes.setDate(hoy.getDate() - 30);

  return {
    desde: fechaLocal(haceUnMes),
    hasta: fechaLocal(hoy)
  };
}

// ---- Estado de la pantalla ----
let vistaActual = 'sucursal';          // 'sucursal' o 'todas'
let consolidadoDisponible = false;     // solo hay vista "Todas" si hay más de una sucursal con movimiento
let dashboardCargado = false;
let numeroCarga = 0;                   // para ignorar respuestas viejas si se cambia de período rápido

// Muestra la vista elegida (y esconde la otra).
function mostrarVista() {
  if (vistaActual === 'todas' && !consolidadoDisponible) vistaActual = 'sucursal';

  document.getElementById('tabs-vista').classList.toggle('oculto', !consolidadoDisponible);
  document.querySelectorAll('#tabs-vista button').forEach(boton => {
    boton.setAttribute('aria-selected', String(boton.dataset.vista === vistaActual));
  });

  document.getElementById('mensaje-inicial').classList.toggle('oculto', dashboardCargado);
  document.getElementById('vista-sucursal').classList.toggle('oculto', !dashboardCargado || vistaActual !== 'sucursal');
  document.getElementById('seccion-consolidado').classList.toggle('oculto', !(consolidadoDisponible && vistaActual === 'todas'));
}

document.getElementById('tabs-vista').addEventListener('click', (event) => {
  const boton = event.target.closest('button[data-vista]');
  if (!boton) return;
  vistaActual = boton.dataset.vista;
  mostrarVista();
});

async function cargarDashboard(desde, hasta) {
  const esta = ++numeroCarga;

  // El consolidado se pide aparte: si falla, el dashboard de esta sucursal se muestra igual.
  cargarConsolidado(desde, hasta, esta);

  const respuesta = await fetch(`${API_URL}/dashboard?desde=${desde}&hasta=${hasta}`, {
    credentials: 'include'
  });

  if (manejarNoAutorizado(respuesta)) return;

  if (!respuesta.ok) {
    alert('Error al cargar el dashboard');
    return;
  }

  const datos = await respuesta.json();
  if (esta !== numeroCarga) return;

  mostrarResumen(datos.resumen, datos.pagos, datos.cuentaTransferencia, datos.estadoResultados, datos.balance);
  mostrarStockBajo(datos.stockBajo);
  mostrarProductosPorCategoria(datos.topProductos);
  mostrarClientesRecurrentes(datos.clientesRecurrentes);
  mostrarMejoresMargenes(datos.mejoresMargenes);
  mostrarBalance(datos.estadoResultados, datos.balance);
  mostrarCobros(datos.resumen, datos.pagos, datos.cuentaTransferencia);

  dashboardCargado = true;
  mostrarVista();
}

// ---- Pequeñas ayudas para armar los gráficos ----
function porcentajeAncho(valor, tope) {
  if (!tope || tope <= 0) return 0;
  return Math.max(0, Math.min(100, Math.abs(Number(valor)) / tope * 100));
}

function crearTarjeta(label, valor, clase, claseTarjeta) {
  const div = document.createElement('div');
  div.className = `dash-kpi tarjeta-metrica ${claseTarjeta || ''}`.trim();
  const l = document.createElement('p');
  l.className = 'metrica-label';
  l.textContent = label;
  const v = document.createElement('p');
  v.className = `metrica-valor ${clase || ''}`.trim();
  v.textContent = valor;
  div.appendChild(l);
  div.appendChild(v);
  return div;
}

// ---- Tarjetas de resumen ----
function mostrarResumen(resumen, pagos, cuentaTransferencia, estado, balanceViejo) {
  const contenedor = document.getElementById('tarjetas-resumen');
  contenedor.innerHTML = '';

  contenedor.appendChild(crearTarjeta('Pedidos', String(resumen.cantidadPedidos)));
  contenedor.appendChild(crearTarjeta('Ventas totales', `$${formatearPrecio(resumen.ventasTotales)}`));
  contenedor.appendChild(crearTarjeta('Ticket promedio', `$${formatearPrecio(resumen.ticketPromedio.toFixed(0))}`));
  contenedor.appendChild(crearTarjeta('Cobrado en efectivo', `$${formatearPrecio(pagos.efectivo)}`));
  contenedor.appendChild(crearTarjeta(`Cobrado en ${cuentaTransferencia || 'MercadoPago'}`, `$${formatearPrecio(pagos.mercadopago)}`));

  // Resultado neto del período: sale del estado de resultados (o del balance simple si el servidor es viejo).
  const neto = estado ? estado.resultadoNeto : (balanceViejo ? balanceViejo.gananciaNeta : null);
  if (neto !== null && neto !== undefined) {
    const porcentaje = estado ? ` (${formatearPorcentaje(estado.margenNetoPorcentual)})` : '';
    contenedor.appendChild(crearTarjeta(`Resultado neto${porcentaje}`, `$${formatearPrecio(neto)}`, claseSegunSigno(neto), neto >= 0 ? 'kpi-positivo' : 'kpi-negativo'));
  }
}

// ---- Cobros por medio de pago (dona) ----
function mostrarCobros(resumen, pagos, cuentaTransferencia) {
  const contenedor = document.getElementById('contenedor-dash-cobros');
  const cuenta = cuentaTransferencia || 'MercadoPago';
  const efectivo = Number(pagos.efectivo) || 0;
  const otros = Number(pagos.mercadopago) || 0;
  const total = efectivo + otros;

  if (total <= 0) {
    contenedor.innerHTML = '<p class="pro-ayuda">Todavía no hay cobros en este período.</p>';
    return;
  }

  const pctEfectivo = efectivo / total * 100;
  const redondear = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

  contenedor.innerHTML = `
    <div class="dash-cobros">
      <div class="dash-dona" aria-hidden="true" style="background: conic-gradient(var(--color-primary, #7A2E28) 0 ${pctEfectivo.toFixed(1)}%, #E8A33D ${pctEfectivo.toFixed(1)}% 100%)">
        <div>${escapeHtml(resumen.cantidadPedidos)}<span>pedidos</span></div>
      </div>
      <div class="dash-leyenda">
        <div>
          <div class="dash-leyenda-titulo"><i style="background: var(--color-primary, #7A2E28)"></i>Efectivo</div>
          <div class="dash-leyenda-detalle">$${formatearPrecio(efectivo)} · ${redondear(pctEfectivo)}%</div>
        </div>
        <div>
          <div class="dash-leyenda-titulo"><i style="background: #E8A33D"></i>${escapeHtml(cuenta)}</div>
          <div class="dash-leyenda-detalle">$${formatearPrecio(otros)} · ${redondear(100 - pctEfectivo)}%</div>
        </div>
      </div>
    </div>
  `;
}

// ---- Alertas de stock bajo ----
function mostrarStockBajo(stockBajo) {
  const seccion = document.getElementById('seccion-stock-bajo');
  const contenedor = document.getElementById('contenedor-dash-stock-bajo');

  if (!stockBajo || stockBajo.length === 0) {
    seccion.classList.add('oculto');
    return;
  }

  seccion.classList.remove('oculto');
  seccion.querySelector('h2').textContent = `⚠ Insumos con stock bajo (${stockBajo.length})`;
  contenedor.innerHTML = '';

  stockBajo.forEach(insumo => {
    const p = document.createElement('p');
    p.className = 'balance-negativo';
    p.innerHTML = `<strong>${escapeHtml(insumo.nombre)}</strong>: quedan ${escapeHtml(insumo.stock_actual)} ${escapeHtml(insumo.unidad_medida)} (mínimo: ${escapeHtml(insumo.stock_minimo)} ${escapeHtml(insumo.unidad_medida)})`;
    contenedor.appendChild(p);
  });
}

// ---- Productos más vendidos, agrupados por categoría ----
function mostrarProductosPorCategoria(topProductos) {
  const contenedor = document.getElementById('contenedor-dash-top-productos');
  contenedor.innerHTML = '';

  if (!topProductos || topProductos.length === 0) {
    contenedor.innerHTML = '<p>Todavía no hay ventas en este período.</p>';
    return;
  }

  // Agrupa manteniendo el orden en que llegan las categorías (el backend ya las ordena alfabéticamente).
  const categorias = new Map();
  topProductos.forEach(fila => {
    const categoria = fila.categoria_nombre || 'Sin categoría';
    if (!categorias.has(categoria)) categorias.set(categoria, []);
    categorias.get(categoria).push(fila);
  });

  categorias.forEach((productos, categoria) => {
    const seccion = document.createElement('div');
    seccion.className = 'categoria-top-productos';

    const titulo = document.createElement('h3');
    titulo.textContent = categoria;
    seccion.appendChild(titulo);

    // Por las dudas, se ordena también acá por cantidad vendida (de mayor a menor).
    const ordenados = productos
      .slice()
      .sort((a, b) => Number(b.cantidad_vendida) - Number(a.cantidad_vendida));
    const maximo = Math.max(...ordenados.map(p => Number(p.cantidad_vendida)));

    ordenados.forEach((producto, index) => {
      const fila = document.createElement('div');
      fila.className = 'dash-item';
      fila.innerHTML = `
        <span class="dash-puesto">#${index + 1}</span>
        <div class="dash-item-cuerpo">
          <div class="dash-item-linea"><span>${escapeHtml(producto.producto_nombre)}</span><span><strong>${escapeHtml(producto.cantidad_vendida)}</strong> unidades</span></div>
          <div class="dash-barra" aria-hidden="true"><i style="width: ${porcentajeAncho(producto.cantidad_vendida, maximo).toFixed(0)}%"></i></div>
        </div>
      `;
      seccion.appendChild(fila);
    });

    contenedor.appendChild(seccion);
  });
}

// ---- Clientes más recurrentes ----
function mostrarClientesRecurrentes(clientes) {
  const contenedor = document.getElementById('contenedor-dash-clientes');
  contenedor.innerHTML = '';

  if (!clientes || clientes.length === 0) {
    contenedor.innerHTML = '<p>Todavía no hay suficientes pedidos vinculados a clientes con teléfono en este período.</p>';
    return;
  }

  const maximo = Math.max(...clientes.map(c => Number(c.cantidad_pedidos)));

  clientes.forEach((cliente, index) => {
    const div = document.createElement('div');
    div.className = 'dash-item';
    div.innerHTML = `
      <span class="dash-puesto redondo">${index + 1}</span>
      <div class="dash-item-cuerpo">
        <div class="dash-item-linea">
          <span><strong>${escapeHtml(cliente.nombre)}</strong> <span class="dash-tenue">(${escapeHtml(cliente.telefono)})</span></span>
          <span>${cliente.cantidad_pedidos} pedidos | Total gastado: <strong>$${formatearPrecio(cliente.total_gastado)}</strong></span>
        </div>
        <div class="dash-barra" aria-hidden="true"><i style="width: ${porcentajeAncho(cliente.cantidad_pedidos, maximo).toFixed(0)}%"></i></div>
      </div>
    `;
    contenedor.appendChild(div);
  });
}

// ---- Productos con mejor margen ----
function mostrarMejoresMargenes(margenes) {
  const contenedor = document.getElementById('contenedor-dash-margenes');
  contenedor.innerHTML = '';

  if (!margenes || margenes.length === 0) {
    contenedor.innerHTML = '<p>Todavía no hay productos con receta cargada para calcular el margen.</p>';
    return;
  }

  margenes.forEach((producto, index) => {
    const div = document.createElement('div');
    div.className = 'dash-item';
    div.innerHTML = `
      <span class="dash-puesto redondo">${index + 1}</span>
      <div class="dash-item-cuerpo">
        <div class="dash-item-linea">
          <span><strong>${escapeHtml(producto.nombre)}</strong></span>
          <span>Precio: $${formatearPrecio(producto.precioVenta)} | Costo: $${formatearPrecio(producto.costo.toFixed(2))} | <strong class="balance-positivo">Margen: ${producto.margenPorcentual}%</strong></span>
        </div>
        <div class="dash-barra" aria-hidden="true"><i style="width: ${porcentajeAncho(producto.margenPorcentual, 100).toFixed(0)}%"></i></div>
      </div>
    `;
    contenedor.appendChild(div);
  });
}

// ---- Estado de resultados (rentabilidad del período) ----
function formatearPorcentaje(valor) {
  return valor === null || valor === undefined ? 'sin ventas' : `${valor}%`;
}

function claseSegunSigno(numero) {
  return numero >= 0 ? 'balance-positivo' : 'balance-negativo';
}

// Texto que explica cómo está el punto de equilibrio.
function textoEquilibrio(e) {
  if (e.puntoEquilibrio === null) {
    return e.gastosFijos > 0
      ? 'No hay punto de equilibrio: con los costos variables actuales cada venta no deja margen para cubrir los fijos.'
      : '';
  }
  return e.colchonSobreEquilibrio >= 0
    ? `Ya superaste el equilibrio por $${formatearPrecio(e.colchonSobreEquilibrio)}`
    : `Te faltan $${formatearPrecio(Math.abs(e.colchonSobreEquilibrio))} de ventas para cubrir los costos fijos`;
}

function textoAvisoSinClasificar(e) {
  return `Tenés $${formatearPrecio(e.gastosSinClasificar)} en gastos sin clasificar. Marcalos como fijos o variables en "Cierre de caja" para que el resultado sea exacto.`;
}

// Agrega una fila "etiqueta | barra | valor". El largo de la barra es proporcional a la venta del período.
// Opciones: destacada, sangria, clase (color del valor), colorBarra, barra (monto de la barra), nota.
function agregarFilaEstado(contenedor, etiqueta, valor, tope, opciones = {}) {
  const fila = document.createElement('div');
  fila.className = 'dash-fila' + (opciones.destacada ? ' destacada' : '') + (opciones.sangria ? ' sangria' : '');

  const a = document.createElement('span');
  a.textContent = etiqueta;
  const barra = document.createElement('div');
  barra.className = 'dash-barra';
  barra.setAttribute('aria-hidden', 'true');
  const relleno = document.createElement('i');
  if (opciones.colorBarra) relleno.className = opciones.colorBarra;
  relleno.style.width = `${porcentajeAncho(opciones.barra, tope).toFixed(1)}%`;
  barra.appendChild(relleno);
  const b = document.createElement('strong');
  b.textContent = valor;
  if (opciones.clase) b.className = opciones.clase;

  fila.appendChild(a);
  fila.appendChild(barra);
  fila.appendChild(b);
  contenedor.appendChild(fila);

  if (opciones.nota) {
    const nota = document.createElement('p');
    nota.className = 'dash-nota';
    nota.textContent = opciones.nota;
    contenedor.appendChild(nota);
  }
}

// Dibuja el estado de resultados completo dentro de un contenedor (lo usan el dashboard de la
// sucursal y el consolidado). Con conEquilibrio también se agrega el punto de equilibrio como una fila más.
function dibujarEstadoResultados(contenedor, e, conEquilibrio) {
  contenedor.innerHTML = '';
  const esRI = e.condicionIva === 'responsable_inscripto';
  const tope = esRI ? e.ventasBrutas : e.ventasNetas;

  if (esRI) {
    agregarFilaEstado(contenedor, 'Ventas con IVA', `$${formatearPrecio(e.ventasBrutas)}`, tope, { barra: e.ventasBrutas, colorBarra: 'b-gris' });
    agregarFilaEstado(contenedor, 'IVA de las ventas (no es ganancia)', `-$${formatearPrecio(e.iva)}`, tope, { sangria: true, barra: e.iva, colorBarra: 'b-gris' });
  }
  agregarFilaEstado(contenedor, esRI ? 'Ventas netas' : 'Ventas', `$${formatearPrecio(e.ventasNetas)}`, tope, { destacada: true, barra: e.ventasNetas });

  // Gastos variables: la materia prima (compras de insumos) más lo que se cargó como variable (materia prima, papelería).
  agregarFilaEstado(contenedor, 'Gastos variables', `-$${formatearPrecio(e.gastosVariables)}`, tope, {
    sangria: true,
    barra: e.gastosVariables,
    colorBarra: 'b-amarillo',
    nota: `Compras de insumos: $${formatearPrecio(e.compras)} · Otros gastos variables: $${formatearPrecio(e.otrosVariables)}`
  });
  agregarFilaEstado(contenedor, `Margen de contribución (${formatearPorcentaje(e.margenContribucionPorcentual)})`, `$${formatearPrecio(e.margenContribucion)}`, tope, {
    destacada: true,
    clase: claseSegunSigno(e.margenContribucion),
    barra: e.margenContribucion,
    colorBarra: e.margenContribucion >= 0 ? '' : 'b-rojo'
  });

  agregarFilaEstado(contenedor, 'Gastos fijos', `-$${formatearPrecio(e.gastosFijos)}`, tope, { sangria: true, barra: e.gastosFijos, colorBarra: 'b-amarillo' });
  if (e.gastosSinClasificar > 0) {
    agregarFilaEstado(contenedor, 'Gastos sin clasificar', `-$${formatearPrecio(e.gastosSinClasificar)}`, tope, { sangria: true, clase: 'balance-negativo', barra: e.gastosSinClasificar, colorBarra: 'b-rojo' });
  }
  agregarFilaEstado(contenedor, `Resultado neto (${formatearPorcentaje(e.margenNetoPorcentual)})`, `$${formatearPrecio(e.resultadoNeto)}`, tope, {
    destacada: true,
    clase: claseSegunSigno(e.resultadoNeto),
    barra: e.resultadoNeto,
    colorBarra: e.resultadoNeto >= 0 ? '' : 'b-rojo'
  });

  if (conEquilibrio) {
    if (e.puntoEquilibrio !== null) {
      agregarFilaEstado(contenedor, 'Punto de equilibrio del período', `$${formatearPrecio(e.puntoEquilibrio)}`, tope, { destacada: true, barra: e.puntoEquilibrio, colorBarra: 'b-oscuro', nota: textoEquilibrio(e) });
    } else if (e.gastosFijos > 0) {
      const nota = document.createElement('p');
      nota.className = 'dash-nota';
      nota.textContent = textoEquilibrio(e);
      contenedor.appendChild(nota);
    }

    if (e.gastosSinClasificar > 0) {
      const aviso = document.createElement('p');
      aviso.className = 'dash-aviso';
      aviso.textContent = textoAvisoSinClasificar(e);
      contenedor.appendChild(aviso);
    }
  }
}

// Punto de equilibrio de la sucursal: barra de ventas contra una marca roja + aviso de gastos sin clasificar.
function dibujarEquilibrio(contenedor, e) {
  contenedor.innerHTML = '';

  if (e.puntoEquilibrio !== null) {
    const maximo = Math.max(e.ventasNetas, e.puntoEquilibrio) * 1.1;
    const caja = document.createElement('div');
    caja.className = 'dash-equilibrio';
    caja.innerHTML = `
      <div class="dash-equilibrio-cabecera"><span>Punto de equilibrio del período</span><span>$${formatearPrecio(e.puntoEquilibrio)}</span></div>
      <div class="dash-medidor" aria-hidden="true">
        <i style="width: ${porcentajeAncho(e.ventasNetas, maximo).toFixed(1)}%"></i>
        <b style="left: ${porcentajeAncho(e.puntoEquilibrio, maximo).toFixed(1)}%"></b>
      </div>
      <div class="dash-equilibrio-pie"><span>Ventas netas: $${formatearPrecio(e.ventasNetas)}</span><span>Línea roja = equilibrio</span></div>
      <p>${escapeHtml(textoEquilibrio(e))}</p>
    `;
    contenedor.appendChild(caja);
  } else if (e.gastosFijos > 0) {
    const nota = document.createElement('p');
    nota.className = 'dash-nota';
    nota.textContent = textoEquilibrio(e);
    contenedor.appendChild(nota);
  } else {
    const nota = document.createElement('p');
    nota.className = 'pro-ayuda';
    nota.textContent = 'No hay gastos fijos cargados en este período.';
    contenedor.appendChild(nota);
  }

  if (e.gastosSinClasificar > 0) {
    const aviso = document.createElement('p');
    aviso.className = 'dash-aviso';
    aviso.textContent = textoAvisoSinClasificar(e);
    contenedor.appendChild(aviso);
  }
}

function mostrarBalance(estado, balanceViejo) {
  const contenedor = document.getElementById('contenedor-dash-balance');
  const equilibrio = document.getElementById('contenedor-dash-equilibrio');

  if (estado) {
    dibujarEstadoResultados(contenedor, estado, false);
    dibujarEquilibrio(equilibrio, estado);
    return;
  }

  // Por si el servidor todavía no devuelve el estado de resultados (versión vieja): se muestra el balance simple.
  equilibrio.innerHTML = '<p class="pro-ayuda">Disponible cuando el servidor devuelva el estado de resultados.</p>';
  const claseResultado = balanceViejo.gananciaNeta >= 0 ? 'balance-positivo' : 'balance-negativo';
  contenedor.innerHTML = `
    <div class="dash-simple">
      <p>Ventas: $${formatearPrecio(balanceViejo.ventas)}</p>
      <p>Compras de insumos (materia prima): -$${formatearPrecio(balanceViejo.compras)}</p>
      <p>Gastos: -$${formatearPrecio(balanceViejo.gastos)}</p>
      <p class="${claseResultado}"><strong>Resultado neto: $${formatearPrecio(balanceViejo.gananciaNeta)}</strong></p>
    </div>
  `;
}

// ---- Comparativa entre sucursales (solo se muestra si hay más de una con movimiento) ----
// Agrega una línea "etiqueta ........ valor" dentro de la tarjeta de un local.
function filaLocal(etiqueta, valor, opciones = {}) {
  const p = document.createElement('p');
  p.className = 'cons-fila' + (opciones.destacada ? ' cons-destacada' : '');
  p.style.margin = '0';
  const a = document.createElement('span');
  a.textContent = etiqueta;
  const b = document.createElement('strong');
  b.textContent = valor;
  if (opciones.clase) b.className = opciones.clase;
  p.appendChild(a);
  p.appendChild(b);
  return p;
}

async function cargarConsolidado(desde, hasta, esta) {
  try {
    const respuesta = await fetch(`${API_URL}/dashboard-consolidado?desde=${desde}&hasta=${hasta}`, { credentials: 'include' });
    if (esta !== numeroCarga) return;
    if (!respuesta.ok) {
      consolidadoDisponible = false;
      mostrarVista();
      return;
    }
    const datos = await respuesta.json();
    if (esta !== numeroCarga) return;
    if (datos.porSucursal.length < 2) {
      consolidadoDisponible = false;
      mostrarVista();
      return;
    }
    consolidadoDisponible = true;

    const t = datos.total;
    const e = t.estado;
    const totales = document.getElementById('cons-totales');
    totales.innerHTML = '';
    totales.appendChild(crearTarjeta('Ventas (todos los locales)', `$${formatearPrecio(t.ventas)}`));
    totales.appendChild(crearTarjeta('Pedidos', String(t.pedidos)));
    totales.appendChild(crearTarjeta('Gastos variables', `-$${formatearPrecio(e.gastosVariables)}`));
    totales.appendChild(crearTarjeta('Gastos fijos', `-$${formatearPrecio(e.gastosFijos)}`));
    totales.appendChild(crearTarjeta(`Resultado neto (${formatearPorcentaje(e.margenNetoPorcentual)})`, `$${formatearPrecio(e.resultadoNeto)}`, claseSegunSigno(e.resultadoNeto), e.resultadoNeto >= 0 ? 'kpi-positivo' : 'kpi-negativo'));

    // Comparativa: ventas y resultado de cada local, con barras del mismo largo máximo.
    const comparativa = document.getElementById('cons-comparativa');
    comparativa.innerHTML = '';
    const maxVentas = Math.max(...datos.porSucursal.map(s => Number(s.ventas)));
    const maxNeto = Math.max(...datos.porSucursal.map(s => Math.abs(Number(s.estado.resultadoNeto))));
    datos.porSucursal.forEach(s => {
      const nombre = s.activa ? s.nombre : `${s.nombre} (inactiva)`;
      const fila = document.createElement('div');
      fila.className = 'dash-comp-fila';
      fila.innerHTML = `
        <strong>${escapeHtml(nombre)}</strong>
        <div class="dash-comp-barras">
          <div class="dash-comp-barra"><div class="dash-barra" aria-hidden="true"><i style="width: ${porcentajeAncho(s.ventas, maxVentas).toFixed(0)}%"></i></div><span>Ventas $${formatearPrecio(s.ventas)}</span></div>
          <div class="dash-comp-barra"><div class="dash-barra" aria-hidden="true"><i class="${s.estado.resultadoNeto >= 0 ? 'b-amarillo' : 'b-rojo'}" style="width: ${Math.max(2, porcentajeAncho(s.estado.resultadoNeto, maxNeto)).toFixed(0)}%"></i></div><span>Resultado $${formatearPrecio(s.estado.resultadoNeto)}</span></div>
        </div>
      `;
      comparativa.appendChild(fila);
    });

    const locales = document.getElementById('cons-locales');
    locales.innerHTML = '';
    datos.porSucursal.forEach(s => {
      const div = document.createElement('div');
      div.className = 'cons-local';

      const titulo = document.createElement('h3');
      titulo.textContent = s.activa ? s.nombre : `${s.nombre} (inactiva)`;
      div.appendChild(titulo);

      const participacion = document.createElement('div');
      participacion.innerHTML = `
        <div class="dash-barra" title="${escapeHtml(s.participacionPorcentual)}% de las ventas"><i style="width: ${porcentajeAncho(s.participacionPorcentual, 100).toFixed(0)}%"></i></div>
        <p class="cons-participacion">${escapeHtml(s.participacionPorcentual)}% de las ventas</p>
      `;
      div.appendChild(participacion);

      const lineas = document.createElement('div');
      lineas.className = 'cons-lineas';
      const est = s.estado;
      lineas.appendChild(filaLocal('Ventas', `$${formatearPrecio(s.ventas)}`));
      lineas.appendChild(filaLocal('Pedidos', String(s.pedidos)));
      lineas.appendChild(filaLocal('Ticket promedio', `$${formatearPrecio(s.ticketPromedio)}`));
      lineas.appendChild(filaLocal('Efectivo', `$${formatearPrecio(s.efectivo)}`));
      lineas.appendChild(filaLocal(s.cuentaTransferencia, `$${formatearPrecio(s.transferencia)}`));
      lineas.appendChild(filaLocal('Gastos variables', `-$${formatearPrecio(est.gastosVariables)}`));
      lineas.appendChild(filaLocal('Gastos fijos', `-$${formatearPrecio(est.gastosFijos)}`));
      if (est.gastosSinClasificar > 0) {
        lineas.appendChild(filaLocal('Sin clasificar', `-$${formatearPrecio(est.gastosSinClasificar)}`, { clase: 'balance-negativo' }));
      }
      lineas.appendChild(filaLocal(`Resultado neto (${formatearPorcentaje(est.margenNetoPorcentual)})`, `$${formatearPrecio(est.resultadoNeto)}`, { destacada: true, clase: claseSegunSigno(est.resultadoNeto) }));
      lineas.appendChild(filaLocal('Punto de equilibrio', est.puntoEquilibrio === null ? 'no hay' : `$${formatearPrecio(est.puntoEquilibrio)}`));
      div.appendChild(lineas);
      locales.appendChild(div);
    });

    dibujarEstadoResultados(document.getElementById('cons-estado'), e, true);
    mostrarVista();
  } catch (error) {
    consolidadoDisponible = false;
    mostrarVista();
  }
}

// ---- Período: botón Actualizar y rangos rápidos ----
document.getElementById('btn-actualizar-dashboard').addEventListener('click', () => {
  const desde = document.getElementById('dashboard-desde').value;
  const hasta = document.getElementById('dashboard-hasta').value;

  if (!desde || !hasta) {
    alert('Elegí ambas fechas');
    return;
  }

  cargarDashboard(desde, hasta);
});

// Los rangos rápidos completan las fechas y cargan los datos.
document.getElementById('chips-rango').addEventListener('click', (event) => {
  const boton = event.target.closest('button[data-rango]');
  if (!boton) return;

  const hoy = new Date();
  let desde;
  let hasta = hoy;

  if (boton.dataset.rango === 'mes') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  } else if (boton.dataset.rango === 'mespasado') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  } else {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 30);
  }

  document.getElementById('dashboard-desde').value = fechaLocal(desde);
  document.getElementById('dashboard-hasta').value = fechaLocal(hasta);
  cargarDashboard(fechaLocal(desde), fechaLocal(hasta));
});

// ---- Al cargar la página: sugerir el último mes en las fechas, pero no traer datos todavía
// (antes se cargaba solo apenas se abría la página, y con muchas ventas se hacía una lista
// interminable sin que lo pidieras) ----
const rangoInicial = obtenerRangoUltimoMes();
document.getElementById('dashboard-desde').value = rangoInicial.desde;
document.getElementById('dashboard-hasta').value = rangoInicial.hasta;
mostrarVista();
