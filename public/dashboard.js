requiereAdmin();

const API_URL = window.location.origin;

const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!usuario) {
  window.location.href = 'login.html';
}

document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-clientes', 'link-caja', 'link-usuarios', 'link-dashboard']);

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

let graficoTopProductos = null;

async function cargarDashboard(desde, hasta) {
  const respuesta = await fetch(`${API_URL}/dashboard?desde=${desde}&hasta=${hasta}`, {
    credentials: 'include'
  });

  if (manejarNoAutorizado(respuesta)) return;

  if (!respuesta.ok) {
    alert('Error al cargar el dashboard');
    return;
  }

  const datos = await respuesta.json();

  mostrarResumen(datos.resumen);
  mostrarStockBajo(datos.stockBajo);
  mostrarTopProductos(datos.topProductos);
  mostrarClientesRecurrentes(datos.clientesRecurrentes);
  mostrarMejoresMargenes(datos.mejoresMargenes);
  mostrarBalance(datos.balance);
}

// ---- Tarjetas de resumen ----
function mostrarResumen(resumen) {
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
    p.innerHTML = `<strong>${insumo.nombre}</strong>: quedan ${insumo.stock_actual} ${insumo.unidad_medida} (mínimo: ${insumo.stock_minimo} ${insumo.unidad_medida})`;
    contenedor.appendChild(p);
  });
}

// ---- Gráfico de barras: top productos ----
function mostrarTopProductos(topProductos) {
  const ctx = document.getElementById('grafico-top-productos');

  const etiquetas = topProductos.map(p => p.producto_nombre);
  const valores = topProductos.map(p => Number(p.cantidad_vendida));

  if (graficoTopProductos) {
    graficoTopProductos.destroy();
  }

  graficoTopProductos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Unidades vendidas',
        data: valores,
        backgroundColor: '#7A2E28'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
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
      <strong>#${index + 1} - ${cliente.nombre}</strong> (${cliente.telefono})<br>
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
      <strong>#${index + 1} - ${producto.nombre}</strong><br>
      Precio: $${formatearPrecio(producto.precioVenta)} | Costo: $${formatearPrecio(producto.costo.toFixed(2))}
      | <strong class="balance-positivo">Margen: ${producto.margenPorcentual}%</strong>
    `;
    contenedor.appendChild(div);
  });
}

// ---- Balance / rentabilidad ----
function mostrarBalance(balance) {
  const contenedor = document.getElementById('contenedor-dash-balance');
  const claseResultado = balance.gananciaNeta >= 0 ? 'balance-positivo' : 'balance-negativo';

  contenedor.innerHTML = `
    <div class="pedido">
      <p>Ventas: $${formatearPrecio(balance.ventas)}</p>
      <p>Compras de mercadería: -$${formatearPrecio(balance.compras)}</p>
      <p>Gastos: -$${formatearPrecio(balance.gastos)}</p>
      <p class="${claseResultado}"><strong>Ganancia neta: $${formatearPrecio(balance.gananciaNeta)}</strong></p>
    </div>
  `;
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

// ---- Al cargar la página: mostrar el último mes por defecto ----
const rangoInicial = obtenerRangoUltimoMes();
document.getElementById('dashboard-desde').value = rangoInicial.desde;
document.getElementById('dashboard-hasta').value = rangoInicial.hasta;
cargarDashboard(rangoInicial.desde, rangoInicial.hasta);