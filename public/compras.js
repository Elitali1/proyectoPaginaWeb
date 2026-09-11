const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

const usuario = JSON.parse(localStorage.getItem('usuario'));
document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-caja', 'link-usuarios', 'link-clientes', 'link-dashboard']);

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

let insumos = [];
let itemsDetalleCompra = [];
let facturaCompraIdActual = null;

// ---- Listado general de compras ----
function mostrarCompras(compras) {
  const contenedor = document.getElementById('contenedor-compras');
  contenedor.innerHTML = '';

  let total = 0;

  compras.forEach(compra => {
    total += Number(compra.monto);

    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${compra.proveedor}</strong> - $${formatearPrecio(compra.monto)}<br>
      ${compra.concepto || ''} | Fecha: ${compra.fecha.split('T')[0]}
      <button type="button" class="btn-eliminar" data-id="${compra.id}">Eliminar</button>
    `;
    contenedor.appendChild(div);
  });

  document.getElementById('total-filtrado').textContent = `Total: $${formatearPrecio(total)}`;

  document.querySelectorAll('.btn-eliminar').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      await fetch(`${API_URL}/facturas-compra/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      cargarCompras();
    });
  });
}

async function cargarCompras() {
  const respuesta = await fetch(`${API_URL}/facturas-compra`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const compras = await respuesta.json();
  mostrarCompras(compras);
}

document.getElementById('btn-filtrar').addEventListener('click', async () => {
  const desde = document.getElementById('filtro-desde').value;
  const hasta = document.getElementById('filtro-hasta').value;

  if (!desde || !hasta) {
    alert('Elegí ambas fechas para filtrar');
    return;
  }

  const respuesta = await fetch(`${API_URL}/facturas-compra?desde=${desde}&hasta=${hasta}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const compras = await respuesta.json();
  mostrarCompras(compras);
});

document.getElementById('btn-limpiar-filtro').addEventListener('click', () => {
  document.getElementById('filtro-desde').value = '';
  document.getElementById('filtro-hasta').value = '';
  cargarCompras();
});

// ---- Cargar el selector de insumos para itemizar ----
async function cargarInsumosEnSelector() {
  const respuesta = await fetch(`${API_URL}/insumos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  insumos = (await respuesta.json()).filter(i => i.activo);

  const select = document.getElementById('detalle-insumo');
  select.innerHTML = '';
  insumos.forEach(insumo => {
    const option = document.createElement('option');
    option.value = insumo.id;
    option.textContent = `${insumo.nombre} (${insumo.unidad_medida})`;
    select.appendChild(option);
  });
}

// ---- Al guardar la factura general, mostrar la sección de itemizar ----
document.getElementById('formulario-compra').addEventListener('submit', async (event) => {
  event.preventDefault();

  const nuevaCompra = {
    proveedor: document.getElementById('proveedor').value,
    concepto: document.getElementById('concepto').value || null,
    monto: Number(document.getElementById('monto').value),
    fecha: document.getElementById('fecha').value,
    subido_por: usuario.id
  };

  const respuesta = await fetch(`${API_URL}/facturas-compra`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(nuevaCompra)
  });

  const facturaCreada = await respuesta.json();
  facturaCompraIdActual = facturaCreada.id;
  itemsDetalleCompra = [];

  document.getElementById('formulario-compra').reset();
  document.getElementById('lista-detalle-compra').innerHTML = '';
  document.getElementById('alertas-precio').innerHTML = '';
  document.getElementById('seccion-detalle-compra').classList.remove('oculto');

  document.getElementById('seccion-detalle-compra').scrollIntoView({ behavior: 'smooth' });

  cargarCompras();
});

// ---- Renderizar la lista de items agregados a la compra actual ----
function renderizarDetalleCompra() {
  const lista = document.getElementById('lista-detalle-compra');
  lista.innerHTML = '';

  itemsDetalleCompra.forEach((item, index) => {
    const insumo = insumos.find(i => i.id === item.insumo_id);
    const li = document.createElement('li');
    li.innerHTML = `
      ${insumo.nombre}: ${item.cantidad} ${insumo.unidad_medida} x $${formatearPrecio(item.precio_unitario)}
      <button type="button" class="btn-quitar-detalle" data-index="${index}">Quitar</button>
    `;
    lista.appendChild(li);
  });

  document.querySelectorAll('.btn-quitar-detalle').forEach(boton => {
    boton.addEventListener('click', () => {
      const index = Number(boton.dataset.index);
      itemsDetalleCompra.splice(index, 1);
      renderizarDetalleCompra();
    });
  });
}

// ---- Botón "Agregar item" a la lista de detalle ----
document.getElementById('btn-agregar-detalle').addEventListener('click', () => {
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
});

// ---- Guardar el detalle completo de la compra ----
document.getElementById('btn-guardar-detalle').addEventListener('click', async () => {
  if (itemsDetalleCompra.length === 0) {
    alert('Agregá al menos un item, o usá "Omitir" si esta compra no es de insumos');
    return;
  }

  const respuesta = await fetch(`${API_URL}/facturas-compra/${facturaCompraIdActual}/detalle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ items: itemsDetalleCompra })
  });

  const datos = await respuesta.json();

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
      div.innerHTML = `⚠ ${insumo.nombre}: ${signo}${alerta.variacionPorcentual}% (de $${formatearPrecio(alerta.precioAnterior)} a $${formatearPrecio(alerta.precioNuevo)})`;
      contenedorAlertas.appendChild(div);
    });
  } else {
    contenedorAlertas.innerHTML = '<p>Detalle guardado, sin variaciones de precio relevantes.</p>';
  }

  itemsDetalleCompra = [];
  document.getElementById('lista-detalle-compra').innerHTML = '';
  facturaCompraIdActual = null;
});

// ---- Omitir la itemización de esta compra ----
document.getElementById('btn-omitir-detalle').addEventListener('click', () => {
  document.getElementById('seccion-detalle-compra').classList.add('oculto');
  itemsDetalleCompra = [];
  facturaCompraIdActual = null;
});

cargarCompras();
cargarInsumosEnSelector();