const API_URL = 'http://localhost:3000';
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

const usuario = JSON.parse(localStorage.getItem('usuario'));
document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-compras', 'link-caja', 'link-usuarios']);

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

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

async function cargarHistorial() {
  const respuesta = await fetch(`${API_URL}/pedidos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const pedidos = await respuesta.json();

  const contenedor = document.getElementById('contenedor-historial');
  contenedor.innerHTML = '';

  pedidos.forEach(pedido => {
    const div = document.createElement('div');
    div.className = 'pedido';

    const entrega = pedido.tipo_entrega === 'envio'
      ? `Envío - ${pedido.direccion_entrega || 'sin dirección'}`
      : 'Retiro en local';

    const detalleProductos = pedido.productos.map(item => {
      const nombre = item.nombre_producto_2
        ? `Mitad ${item.nombre_producto} / Mitad ${item.nombre_producto_2}`
        : item.nombre_producto;
      return `${item.cantidad} x ${nombre}`;
    }).join(', ');

    let infoFactura = '';
    if (pedido.requiere_factura) {
      infoFactura = pedido.ya_facturado
        ? `Factura N° ${pedido.numero_comprobante} - CAE: ${pedido.cae} (vto: ${pedido.vencimiento_cae ? pedido.vencimiento_cae.split('T')[0] : ''}) <button type="button" class="btn-ver-pdf" data-id="${pedido.id}">Ver PDF</button>`
        : 'Requiere factura - sin emitir';
    }

    div.innerHTML = `
      <strong>#${pedido.id} - ${pedido.cliente}</strong> - ${formatearFecha(pedido.creado_en)}<br>
      Canal: ${pedido.canal} | Pago: ${pedido.medio_pago} | ${entrega}<br>
      Productos: ${detalleProductos}<br>
      Total: $${formatearPrecio(pedido.total)} | Estado: ${pedido.estado}<br>
      ${infoFactura ? `${infoFactura}<br>` : ''}
    `;
    contenedor.appendChild(div);
    const botonPdf = div.querySelector('.btn-ver-pdf');
    if (botonPdf) {
      botonPdf.addEventListener('click', () => verPdf(botonPdf.dataset.id));
    }
  });
}

async function verPdf(pedidoId) {
  const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}/pdf`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!respuesta.ok) {
    alert('No se pudo obtener el PDF de la factura');
    return;
  }

  const blob = await respuesta.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

cargarHistorial();