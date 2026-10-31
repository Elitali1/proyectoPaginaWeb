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

function obtenerRangoUltimoMes() {
  const hoy = new Date();
  const haceUnMes = new Date();
  haceUnMes.setDate(hoy.getDate() - 30);

  return {
    desde: haceUnMes.toISOString().split('T')[0],
    hasta: hoy.toISOString().split('T')[0]
  };
}

async function cargarDashboard(desde, hasta) {
  // El consolidado se pide aparte: si falla, el dashboard de esta sucursal se muestra igual.
  cargarConsolidado(desde, hasta);

  const respuesta = await fetch(`${API_URL}/dashboard?desde=${desde}&hasta=${hasta}`, {
    credentials: 'include'
  });

  if (manejarNoAutorizado(respuesta)) return;

  if (!respuesta.ok) {
    alert('Error al cargar el dashboard');
    return;
  }

  const datos = await respuesta.json();

  mostrarResumen(datos.resumen, datos.pagos, datos.cuentaTransferencia);
  mostrarStockBajo(datos.stockBajo);
  mostrarProductosPorCategoria(datos.topProductos);
  mostrarClientesRecurrentes(datos.clientesRecurrentes);
  mostrarMejoresMargenes(datos.mejoresMargenes);
  mostrarBalance(datos.estadoResultados, datos.balance);
}

// ---- Tarjetas de resumen ----
function mostrarResumen(resumen, pagos, cuentaTransferencia) {
  const contenedor = document.getElementById('tarjetas-resumen');
  contenedor.innerHTML = `
    <div class="tarjeta-metrica">
      <p class="metrica-label">Pedidos</p>
      <p class="metrica-valor">${resumen.cantidadPedidos}</p>
    </div>
    <div class="tarjeta-metrica">
      <p class="metrica-label">Ventas totales</p>
      <p class="metrica-valor">$${formatearPrecio(resumen.ventasTotales)}</p>
    </div>
    <div class="tarjeta-metrica">
      <p class="metrica-label">Ticket promedio</p>
      <p class="metrica-valor">$${formatearPrecio(resumen.ticketPromedio.toFixed(0))}</p>
    </div>
    <div class="tarjeta-metrica">
      <p class="metrica-label">Cobrado en efectivo</p>
      <p class="metrica-valor">$${formatearPrecio(pagos.efectivo)}</p>
    </div>
    <div class="tarjeta-metrica">
      <p class="metrica-label">Cobrado en ${escapeHtml(cuentaTransferencia || 'MercadoPago')}</p>
      <p class="metrica-valor">$${formatearPrecio(pagos.mercadopago)}</p>
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
    productos
      .slice()
      .sort((a, b) => Number(b.cantidad_vendida) - Number(a.cantidad_vendida))
      .forEach((producto, index) => {
        const p = document.createElement('p');
        p.innerHTML = `#${index + 1} - ${escapeHtml(producto.producto_nombre)}: <strong>${escapeHtml(producto.cantidad_vendida)}</strong> unidades`;
        seccion.appendChild(p);
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

  clientes.forEach((cliente, index) => {
    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>#${index + 1} - ${escapeHtml(cliente.nombre)}</strong> (${escapeHtml(cliente.telefono)})<br>
      ${cliente.cantidad_pedidos} pedidos | Total gastado: $${formatearPrecio(cliente.total_gastado)}
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
    div.className = 'pedido';
    div.innerHTML = `
      <strong>#${index + 1} - ${escapeHtml(producto.nombre)}</strong><br>
      Precio: $${formatearPrecio(producto.precioVenta)} | Costo: $${formatearPrecio(producto.costo.toFixed(2))}
      | <strong class="balance-positivo">Margen: ${producto.margenPorcentual}%</strong>
    `;
    contenedor.appendChild(div);
  });
}

// ---- Estado de resultados (rentabilidad del período) ----
function formatearPorcentaje(valor) {
  return valor === null || valor === undefined ? 'sin ventas' : `${valor}%`;
}

// Crea una fila "etiqueta ........ valor". Las opciones: clase del valor, negrita, sangría.
function filaEstado(etiqueta, valor, opciones = {}) {
  const p = document.createElement('p');
  p.className = 'cons-fila' + (opciones.destacada ? ' cons-destacada' : '') + (opciones.sangria ? ' cons-sangria' : '');
  const a = document.createElement('span');
  a.textContent = etiqueta;
  const b = document.createElement('strong');
  b.textContent = valor;
  if (opciones.clase) b.className = opciones.clase;
  p.appendChild(a);
  p.appendChild(b);
  return p;
}

function claseSegunSigno(numero) {
  return numero >= 0 ? 'balance-positivo' : 'balance-negativo';
}

// Dibuja el estado de resultados completo dentro de un contenedor (lo usan el dashboard de la
// sucursal y el consolidado).
function dibujarEstadoResultados(contenedor, e) {
  contenedor.innerHTML = '';

  if (e.condicionIva === 'responsable_inscripto') {
    contenedor.appendChild(filaEstado('Ventas con IVA', `$${formatearPrecio(e.ventasBrutas)}`));
    contenedor.appendChild(filaEstado('IVA de las ventas (no es ganancia)', `-$${formatearPrecio(e.iva)}`, { sangria: true }));
  }
  contenedor.appendChild(filaEstado(e.condicionIva === 'responsable_inscripto' ? 'Ventas netas' : 'Ventas', `$${formatearPrecio(e.ventasNetas)}`, { destacada: true }));

  // Gastos variables: la materia prima (compras de insumos) más lo que se cargó como variable (materia prima, papelería).
  contenedor.appendChild(filaEstado('Gastos variables', `-$${formatearPrecio(e.gastosVariables)}`, { sangria: true }));
  const detalleVariables = document.createElement('p');
  detalleVariables.className = 'cons-participacion';
  detalleVariables.textContent = `Compras de insumos: $${formatearPrecio(e.compras)} · Otros gastos variables: $${formatearPrecio(e.otrosVariables)}`;
  contenedor.appendChild(detalleVariables);
  contenedor.appendChild(filaEstado(`Margen de contribución (${formatearPorcentaje(e.margenContribucionPorcentual)})`, `$${formatearPrecio(e.margenContribucion)}`, { destacada: true, clase: claseSegunSigno(e.margenContribucion) }));

  contenedor.appendChild(filaEstado('Gastos fijos', `-$${formatearPrecio(e.gastosFijos)}`, { sangria: true }));
  if (e.gastosSinClasificar > 0) {
    contenedor.appendChild(filaEstado('Gastos sin clasificar', `-$${formatearPrecio(e.gastosSinClasificar)}`, { sangria: true, clase: 'balance-negativo' }));
  }
  contenedor.appendChild(filaEstado(`Resultado neto (${formatearPorcentaje(e.margenNetoPorcentual)})`, `$${formatearPrecio(e.resultadoNeto)}`, { destacada: true, clase: claseSegunSigno(e.resultadoNeto) }));

  if (e.puntoEquilibrio !== null) {
    const texto = e.colchonSobreEquilibrio >= 0
      ? `Ya superaste el equilibrio por $${formatearPrecio(e.colchonSobreEquilibrio)}`
      : `Te faltan $${formatearPrecio(Math.abs(e.colchonSobreEquilibrio))} de ventas para cubrir los costos fijos`;
    contenedor.appendChild(filaEstado('Punto de equilibrio del período', `$${formatearPrecio(e.puntoEquilibrio)}`, { destacada: true }));
    const nota = document.createElement('p');
    nota.className = 'cons-participacion';
    nota.textContent = texto;
    contenedor.appendChild(nota);
  } else if (e.gastosFijos > 0) {
    const nota = document.createElement('p');
    nota.className = 'cons-participacion';
    nota.textContent = 'No hay punto de equilibrio: con los costos variables actuales cada venta no deja margen para cubrir los fijos.';
    contenedor.appendChild(nota);
  }

  if (e.gastosSinClasificar > 0) {
    const aviso = document.createElement('p');
    aviso.className = 'cons-aviso';
    aviso.textContent = `Tenés $${formatearPrecio(e.gastosSinClasificar)} en gastos sin clasificar. Marcalos como fijos o variables en "Cierre de caja" para que el resultado sea exacto.`;
    contenedor.appendChild(aviso);
  }
}

function mostrarBalance(estado, balanceViejo) {
  const contenedor = document.getElementById('contenedor-dash-balance');

  if (estado) {
    dibujarEstadoResultados(contenedor, estado);
    return;
  }

  // Por si el servidor todavía no devuelve el estado de resultados (versión vieja): se muestra el balance simple.
  const claseResultado = balanceViejo.gananciaNeta >= 0 ? 'balance-positivo' : 'balance-negativo';
  contenedor.innerHTML = `
    <div class="pedido">
      <p>Ventas: $${formatearPrecio(balanceViejo.ventas)}</p>
      <p>Compras de insumos (materia prima): -$${formatearPrecio(balanceViejo.compras)}</p>
      <p>Gastos: -$${formatearPrecio(balanceViejo.gastos)}</p>
      <p class="${claseResultado}"><strong>Resultado neto: $${formatearPrecio(balanceViejo.gananciaNeta)}</strong></p>
    </div>
  `;
}

// ---- Comparativa entre sucursales (solo se muestra si hay más de una con movimiento) ----
function crearTarjeta(label, valor, clase) {
  const div = document.createElement('div');
  div.className = 'tarjeta-metrica';
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

async function cargarConsolidado(desde, hasta) {
  const seccion = document.getElementById('seccion-consolidado');
  try {
    const respuesta = await fetch(`${API_URL}/dashboard-consolidado?desde=${desde}&hasta=${hasta}`, { credentials: 'include' });
    if (!respuesta.ok) {
      seccion.classList.add('oculto');
      return;
    }
    const datos = await respuesta.json();
    if (datos.porSucursal.length < 2) {
      seccion.classList.add('oculto');
      return;
    }
    seccion.classList.remove('oculto');

    const t = datos.total;
    const e = t.estado;
    const totales = document.getElementById('cons-totales');
    totales.innerHTML = '';
    totales.appendChild(crearTarjeta('Ventas (todos los locales)', `$${formatearPrecio(t.ventas)}`));
    totales.appendChild(crearTarjeta('Pedidos', String(t.pedidos)));
    totales.appendChild(crearTarjeta('Gastos variables', `-$${formatearPrecio(e.gastosVariables)}`));
    totales.appendChild(crearTarjeta('Gastos fijos', `-$${formatearPrecio(e.gastosFijos)}`));
    totales.appendChild(crearTarjeta(`Resultado neto (${formatearPorcentaje(e.margenNetoPorcentual)})`, `$${formatearPrecio(e.resultadoNeto)}`, claseSegunSigno(e.resultadoNeto)));

    const locales = document.getElementById('cons-locales');
    locales.innerHTML = '';
    datos.porSucursal.forEach(s => {
      const div = document.createElement('div');
      div.className = 'cons-local';

      const titulo = document.createElement('h3');
      titulo.textContent = s.activa ? s.nombre : `${s.nombre} (inactiva)`;
      div.appendChild(titulo);

      const barra = document.createElement('progress');
      barra.max = 100;
      barra.value = s.participacionPorcentual;
      barra.title = `${s.participacionPorcentual}% de las ventas`;
      div.appendChild(barra);
      const part = document.createElement('p');
      part.className = 'cons-participacion';
      part.textContent = `${s.participacionPorcentual}% de las ventas`;
      div.appendChild(part);

      const est = s.estado;
      div.appendChild(filaEstado('Ventas', `$${formatearPrecio(s.ventas)}`));
      div.appendChild(filaEstado('Pedidos', String(s.pedidos)));
      div.appendChild(filaEstado('Ticket promedio', `$${formatearPrecio(s.ticketPromedio)}`));
      div.appendChild(filaEstado('Efectivo', `$${formatearPrecio(s.efectivo)}`));
      div.appendChild(filaEstado(s.cuentaTransferencia, `$${formatearPrecio(s.transferencia)}`));
      div.appendChild(filaEstado('Gastos variables', `-$${formatearPrecio(est.gastosVariables)}`));
      div.appendChild(filaEstado('Gastos fijos', `-$${formatearPrecio(est.gastosFijos)}`));
      if (est.gastosSinClasificar > 0) {
        div.appendChild(filaEstado('Sin clasificar', `-$${formatearPrecio(est.gastosSinClasificar)}`, { clase: 'balance-negativo' }));
      }
      div.appendChild(filaEstado(`Resultado neto (${formatearPorcentaje(est.margenNetoPorcentual)})`, `$${formatearPrecio(est.resultadoNeto)}`, { destacada: true, clase: claseSegunSigno(est.resultadoNeto) }));
      div.appendChild(filaEstado('Punto de equilibrio', est.puntoEquilibrio === null ? 'no hay' : `$${formatearPrecio(est.puntoEquilibrio)}`));
      locales.appendChild(div);
    });

    dibujarEstadoResultados(document.getElementById('cons-estado'), e);
  } catch (error) {
    seccion.classList.add('oculto');
  }
}

document.getElementById('btn-actualizar-dashboard').addEventListener('click', () => {
  const desde = document.getElementById('dashboard-desde').value;
  const hasta = document.getElementById('dashboard-hasta').value;

  if (!desde || !hasta) {
    alert('Elegí ambas fechas');
    return;
  }

  cargarDashboard(desde, hasta);
});

// ---- Al cargar la página: sugerir el último mes en las fechas, pero no traer datos todavía
// (antes se cargaba solo apenas se abría la página, y con muchas ventas se hacía una lista
// interminable sin que lo pidieras) ----
const rangoInicial = obtenerRangoUltimoMes();
document.getElementById('dashboard-desde').value = rangoInicial.desde;
document.getElementById('dashboard-hasta').value = rangoInicial.hasta;
document.getElementById('tarjetas-resumen').innerHTML = '<p>Elegí un período y apretá "Actualizar" para ver las métricas.</p>';