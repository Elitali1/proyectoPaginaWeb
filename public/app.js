const API_URL = window.location.origin;
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
 
let productosDelPedido = [];
let catalogoProductos = [];
let editandoPedidoId = null;
let productoSeleccionadoRequiereMasa = false;
 
// El campo de masa arranca oculto hasta que se elija un producto
document.getElementById('label-masa').classList.add('oculto');
 
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
 
// ---- Cargar y mostrar la lista de pedidos ----
async function cargarPedidos() {
  const respuesta = await fetch(`${API_URL}/pedidos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const pedidos = await respuesta.json();
 
  const contenedor = document.getElementById('contenedor-pedidos');
  contenedor.innerHTML = '';
 
  const pedidosActivos = pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');
 
  pedidosActivos.forEach(pedido => {
    const div = document.createElement('div');
    div.className = 'pedido';
 
    const entrega = pedido.tipo_entrega === 'envio'
      ? `Envío - ${pedido.direccion_entrega || 'sin dirección'}`
      : 'Retiro en local';
 
    const detalleProductos = pedido.productos.map(item => {
      const masaTexto = item.tipo_masa ? (item.tipo_masa === 'molde' ? 'Al molde' : 'A la piedra') : '';
      const aclaracionTexto = item.aclaraciones ? ` (${item.aclaraciones})` : '';
      const nombre = item.nombre_producto_2
        ? `Mitad ${item.nombre_producto} / Mitad ${item.nombre_producto_2}`
        : item.nombre_producto;
      return `${item.cantidad} x ${nombre}${masaTexto ? ' - ' + masaTexto : ''}${aclaracionTexto}`;
    }).join('<br>');
 
    const botonFactura = pedido.requiere_factura
      ? (pedido.ya_facturado
          ? `<button type="button" disabled>Ya facturado</button>`
          : `<button type="button" class="btn-facturar" data-id="${pedido.id}">Facturar</button>`)
      : '';
 
    div.innerHTML = `
 
      <strong>#${pedido.id} - ${pedido.cliente}</strong> - ${formatearFecha(pedido.creado_en)}<br>
      Canal: ${pedido.canal} | Pago: ${pedido.medio_pago} | ${entrega}<br>
      ${detalleProductos}<br>
      Total: $${formatearPrecio(pedido.total)} | Estado: ${pedido.estado}
      ${botonFactura}
      <button type="button" class="btn-comanda" data-id="${pedido.id}">Imprimir comanda</button>
      <button type="button" class="btn-modificar" data-id="${pedido.id}">Modificar</button>
      <button type="button" class="btn-cancelar" data-id="${pedido.id}">Cancelar pedido</button>
      <select class="cambiar-estado" data-id="${pedido.id}">
        <option value="pendiente" ${pedido.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
        <option value="en preparación" ${pedido.estado === 'en preparación' ? 'selected' : ''}>En preparación</option>
        <option value="entregado" ${pedido.estado === 'entregado' ? 'selected' : ''}>Entregado</option>
      </select>
    `;
    contenedor.appendChild(div);
  });
 
  document.querySelectorAll('.cambiar-estado').forEach(select => {
    select.addEventListener('change', async (event) => {
      const id = event.target.dataset.id;
      const nuevoEstado = event.target.value;
 
      await fetch(`${API_URL}/pedidos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });
 
      cargarPedidos();
    });
  });
 
  document.querySelectorAll('.btn-facturar').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      boton.disabled = true;
      boton.textContent = 'Facturando...';
 
      const respuesta = await fetch(`${API_URL}/pedidos/${id}/facturar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
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
    });
  });
 
  document.querySelectorAll('.btn-comanda').forEach(boton => {
  boton.addEventListener('click', () => imprimirComanda(boton.dataset.id, boton));
  });
 
  document.querySelectorAll('.btn-modificar').forEach(boton => {
    boton.addEventListener('click', async () => {
      await cargarPedidoParaEditar(boton.dataset.id);
    });
  });
 
  document.querySelectorAll('.btn-cancelar').forEach(boton => {
  boton.addEventListener('click', async () => {
    const confirmar = confirm('¿Seguro que querés cancelar este pedido?');
    if (!confirmar) return;
 
    const id = boton.dataset.id;
    await fetch(`${API_URL}/pedidos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ estado: 'cancelado' })
    });
 
    cargarPedidos();
  });
});
}
 
// ---- Ver comanda en ventana nueva ----
async function imprimirComanda(pedidoId, boton) {
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Imprimiendo...';
 
  try {
    const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}/imprimir-comanda`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
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
 
// ---- Cargar un pedido existente en el formulario, en modo edición ----
async function cargarPedidoParaEditar(pedidoId) {
  const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
 
  if (!respuesta.ok) {
    alert('No se pudo cargar el pedido para editar');
    return;
  }
 
  const pedido = await respuesta.json();
 
  editandoPedidoId = pedidoId;
 
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
      aclaraciones: item.aclaraciones
    };
  });
 
  renderizarListaProductos();
 
  document.getElementById('btn-guardar-pedido').textContent = 'Guardar cambios';
  document.getElementById('btn-cancelar-edicion-pedido').classList.remove('oculto');
 
  document.getElementById('formulario-pedido').scrollIntoView({ behavior: 'smooth' });
}
 
document.getElementById('btn-cancelar-edicion-pedido').addEventListener('click', () => {
  editandoPedidoId = null;
  productosDelPedido = [];
  renderizarListaProductos();
  document.getElementById('formulario-pedido').reset();
  document.getElementById('btn-guardar-pedido').textContent = 'Crear pedido';
  document.getElementById('btn-cancelar-edicion-pedido').classList.add('oculto');
});
 
// ---- Cargar catálogo de productos (solo disponibles) para el buscador y el select 2 ----
async function cargarProductosEnFormulario() {
  const respuesta = await fetch(`${API_URL}/productos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const todosLosProductos = await respuesta.json();
  catalogoProductos = todosLosProductos.filter(p => p.disponible);
  cargarSelect2();
}
 
function cargarSelect2() {
  const select2 = document.getElementById('select-producto-2');
  select2.innerHTML = '';
  catalogoProductos.forEach(producto => {
    const option = document.createElement('option');
    option.value = producto.id;
    option.dataset.precio = producto.precio;
    option.textContent = `${producto.nombre} - $${formatearPrecio(producto.precio)}`;
    select2.appendChild(option);
  });
}
 
// ---- Buscador de productos (filtra mientras se escribe) ----
document.getElementById('buscador-producto').addEventListener('input', (event) => {
  const texto = event.target.value.toLowerCase();
  const resultados = document.getElementById('resultados-busqueda');
 
  if (texto.length < 2) {
    resultados.classList.remove('mostrar');
    return;
  }
 
  const coincidencias = catalogoProductos.filter(p => p.nombre.toLowerCase().includes(texto));
 
  resultados.innerHTML = '';
  coincidencias.forEach(producto => {
    const li = document.createElement('li');
    li.textContent = `${producto.nombre} - $${formatearPrecio(producto.precio)}`;
    li.addEventListener('click', () => {
      document.getElementById('buscador-producto').value = producto.nombre;
      document.getElementById('producto-seleccionado-id').value = producto.id;
      document.getElementById('producto-seleccionado-precio').value = producto.precio;
      document.getElementById('producto-seleccionado-nombre').value = producto.nombre;
      resultados.classList.remove('mostrar');
 
      // Mostrar el campo de masa solo si la categoría del producto lo requiere
      productoSeleccionadoRequiereMasa = !!producto.requiere_masa;
      document.getElementById('label-masa').classList.toggle('oculto', !productoSeleccionadoRequiereMasa);
    });
    resultados.appendChild(li);
  });
 
  resultados.classList.toggle('mostrar', coincidencias.length > 0);
});
 
// ---- Mostrar/ocultar el select 2 según el checkbox de combinar ----
document.getElementById('check-combinar').addEventListener('change', (event) => {
  document.getElementById('select-producto-2').classList.toggle('oculto', !event.target.checked);
});
 
// ---- Mostrar/ocultar el campo de dirección según tipo de entrega ----
document.getElementById('tipo_entrega').addEventListener('change', (event) => {
  document.getElementById('label-direccion').classList.toggle('oculto', event.target.value !== 'envio');
});
 
// ---- Mostrar la lista de productos ya agregados al pedido en construcción, con total ----
function renderizarListaProductos() {
  const lista = document.getElementById('lista-productos-agregados');
  lista.innerHTML = '';
 
  let total = 0;
 
  productosDelPedido.forEach((item, index) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;
 
    const masaTexto = item.tipo_masa ? (item.tipo_masa === 'molde' ? 'Al molde' : 'A la piedra') : '';
    const aclaracionTexto = item.aclaraciones ? ` (${item.aclaraciones})` : '';
 
    const li = document.createElement('li');
    li.innerHTML = `
      ${item.cantidad} x ${item.nombre}${masaTexto ? ' - ' + masaTexto : ''}${aclaracionTexto} - $${formatearPrecio(subtotal)}
      <button type="button" class="btn-quitar" data-index="${index}">Quitar</button>
    `;
    lista.appendChild(li);
  });
 
  document.querySelectorAll('.btn-quitar').forEach(boton => {
    boton.addEventListener('click', () => {
      const index = Number(boton.dataset.index);
      productosDelPedido.splice(index, 1);
      renderizarListaProductos();
    });
  });
 
  document.getElementById('total-pedido').textContent = `Total: $${formatearPrecio(total)}`;
}
 
// ---- Botón "Agregar" producto a la lista ----
document.getElementById('btn-agregar-producto').addEventListener('click', () => {
  const combinar = document.getElementById('check-combinar').checked;
  const cantidad = Number(document.getElementById('cantidad-nueva').value);
  const tipoMasa = productoSeleccionadoRequiereMasa ? document.getElementById('tipo-masa').value : null;
  const aclaraciones = document.getElementById('aclaraciones-producto').value || null;
 
  const productoId = document.getElementById('producto-seleccionado-id').value;
  const productoPrecio = document.getElementById('producto-seleccionado-precio').value;
  const productoNombre = document.getElementById('producto-seleccionado-nombre').value;
 
  if (!productoId) {
    alert('Buscá y elegí un producto primero');
    return;
  }
 
  if (combinar) {
    const select2 = document.getElementById('select-producto-2');
    const opcion2 = select2.options[select2.selectedIndex];
 
    const precioCombinado = (Number(productoPrecio) / 2) + (Number(opcion2.dataset.precio) / 2) + 1000;
 
    productosDelPedido.push({
      producto_id: Number(productoId),
      producto_id_2: Number(opcion2.value),
      cantidad,
      precio: precioCombinado,
      nombre: `Mitad ${productoNombre} / Mitad ${opcion2.textContent.split(' - ')[0]}`,
      tipo_masa: tipoMasa,
      aclaraciones
    });
  } else {
    productosDelPedido.push({
      producto_id: Number(productoId),
      cantidad,
      precio: Number(productoPrecio),
      nombre: productoNombre,
      tipo_masa: tipoMasa,
      aclaraciones
    });
  }
 
  document.getElementById('buscador-producto').value = '';
  document.getElementById('producto-seleccionado-id').value = '';
  document.getElementById('producto-seleccionado-precio').value = '';
  document.getElementById('producto-seleccionado-nombre').value = '';
  document.getElementById('aclaraciones-producto').value = '';
 
  // Vuelve a ocultar el campo de masa hasta que se elija el próximo producto
  productoSeleccionadoRequiereMasa = false;
  document.getElementById('label-masa').classList.add('oculto');
 
  renderizarListaProductos();
});
 
// ---- Envío del formulario: crear pedido nuevo, o guardar cambios si se está editando ----
document.getElementById('formulario-pedido').addEventListener('submit', async (event) => {
  event.preventDefault();
 
  if (productosDelPedido.length === 0) {
    alert('Agregá al menos un producto');
    return;
  }
 
  if (editandoPedidoId) {
    const respuesta = await fetch(`${API_URL}/pedidos/${editandoPedidoId}/productos`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ productos: productosDelPedido })
    });
 
    if (!respuesta.ok) {
      const error = await respuesta.json();
      alert(error.error || 'Error al modificar el pedido');
      return;
    }
 
    editandoPedidoId = null;
    document.getElementById('btn-guardar-pedido').textContent = 'Crear pedido';
    document.getElementById('btn-cancelar-edicion-pedido').classList.add('oculto');
    document.getElementById('formulario-pedido').reset();
    productosDelPedido = [];
    renderizarListaProductos();
    cargarPedidos();
    return;
  }
 
  const nuevoPedido = {
    cliente: document.getElementById('cliente').value,
    canal: document.getElementById('canal').value,
    medio_pago: document.getElementById('medio_pago').value,
    tipo_entrega: document.getElementById('tipo_entrega').value,
    direccion_entrega: document.getElementById('direccion_entrega').value || null,
    cuit_receptor: document.getElementById('cuit_receptor').value || null,
    productos: productosDelPedido
  };
 
  const respuesta = await fetch(`${API_URL}/pedidos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(nuevoPedido)
  });
 
  if (!respuesta.ok) {
    const error = await respuesta.json();
    alert(error.error || 'Error al crear el pedido');
    return;
  }
 
  document.getElementById('formulario-pedido').reset();
  productosDelPedido = [];
  renderizarListaProductos();
  document.getElementById('label-direccion').classList.add('oculto');
  cargarPedidos();
});
 
// ---- Al cargar la página ----
cargarPedidos();
cargarProductosEnFormulario();