const API_URL = window.location.origin;

const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!usuario) {
  window.location.href = 'login.html';
}

document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-caja', 'link-usuarios', 'link-clientes', 'link-dashboard']);

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch(`${API_URL}/usuarios/logout`, { method: 'POST', credentials: 'include' });
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

let productosDelPedido = [];
let catalogoProductos = [];
let editandoPedidoId = null;
let productoSeleccionadoRequiereMasa = false;

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

document.getElementById('telefono-cliente').addEventListener('blur', async (event) => {
  const telefono = event.target.value.trim();
  const mensaje = document.getElementById('mensaje-cliente-encontrado');
  mensaje.textContent = '';

  if (!telefono) return;

  const respuesta = await fetch(`${API_URL}/clientes/telefono/${telefono}`, {
    credentials: 'include'
  });

  if (!respuesta.ok) {
    mensaje.textContent = 'Cliente nuevo (se va a guardar con este pedido)';
    return;
  }

  const cliente = await respuesta.json();

  document.getElementById('cliente').value = cliente.nombre;

  if (cliente.direccion) {
    document.getElementById('direccion_entrega').value = cliente.direccion;
    document.getElementById('tipo_entrega').value = 'envio';
    document.getElementById('label-direccion').classList.remove('oculto');
  }

  mensaje.textContent = `Cliente encontrado: ${cliente.nombre}`;
});

document.getElementById('medio_pago').addEventListener('change', (event) => {
  const esMixto = event.target.value === 'mixto';
  document.getElementById('seccion-pago-mixto').classList.toggle('oculto', !esMixto);

  if (!esMixto) {
    document.getElementById('monto-efectivo').value = '';
    document.getElementById('monto-transferencia').value = '';
    document.getElementById('mensaje-validacion-mixto').textContent = '';
  }
});

function validarPagoMixto() {
  const totalPedido = productosDelPedido.reduce((suma, item) => suma + (item.precio * item.cantidad), 0);
  const montoEfectivo = Number(document.getElementById('monto-efectivo').value) || 0;
  const montoTransferencia = Number(document.getElementById('monto-transferencia').value) || 0;
  const suma = montoEfectivo + montoTransferencia;
  const mensaje = document.getElementById('mensaje-validacion-mixto');

  if (montoEfectivo === 0 && montoTransferencia === 0) {
    mensaje.textContent = '';
    return true;
  }

  if (suma !== totalPedido) {
    mensaje.textContent = `La suma ($${formatearPrecio(suma)}) no coincide con el total del pedido ($${formatearPrecio(totalPedido)})`;
    mensaje.className = 'balance-negativo';
    return false;
  }

  mensaje.textContent = `Correcto: suma $${formatearPrecio(suma)}`;
  mensaje.className = 'balance-positivo';
  return true;
}

document.getElementById('monto-efectivo').addEventListener('input', validarPagoMixto);
document.getElementById('monto-transferencia').addEventListener('input', validarPagoMixto);

async function cargarPedidos() {
  const respuesta = await fetch(`${API_URL}/pedidos`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return;
  const pedidos = await respuesta.json();

  const contenedor = document.getElementById('contenedor-pedidos');
  contenedor.innerHTML = '';

  const pedidosActivos = pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');

  pedidosActivos.forEach(pedido => {
    const div = document.createElement('div');
    div.className = 'pedido';

    const entrega = pedido.tipo_entrega === 'envio'
      ? `Envío - ${escaparHtml(pedido.direccion_entrega || 'sin dirección')}`
      : 'Retiro en local';

    const detalleProductos = pedido.productos.map(item => {
      const masaTexto = item.tipo_masa ? (item.tipo_masa === 'molde' ? 'Al molde' : 'A la piedra') : '';
      const aclaracionTexto = item.aclaraciones ? ` (${escaparHtml(item.aclaraciones)})` : '';
      const nombre = item.nombre_producto_2
        ? `Mitad ${escaparHtml(item.nombre_producto)} / Mitad ${escaparHtml(item.nombre_producto_2)}`
        : escaparHtml(item.nombre_producto);
      return `${item.cantidad} x ${nombre}${masaTexto ? ' - ' + masaTexto : ''}${aclaracionTexto}`;
    }).join('<br>');

    const infoPago = pedido.medio_pago === 'mixto'
      ? `Mixto (Efectivo: $${formatearPrecio(pedido.monto_efectivo)} / Transferencia: $${formatearPrecio(pedido.monto_transferencia)})`
      : pedido.medio_pago;

    const botonFactura = pedido.requiere_factura
      ? (pedido.ya_facturado
          ? `<button type="button" disabled>Ya facturado</button>`
          : `<button type="button" class="btn-facturar" data-id="${pedido.id}">Facturar</button>`)
      : '';

    div.innerHTML = `

      <strong>#${pedido.id} - ${escaparHtml(pedido.cliente)}</strong> - ${formatearFecha(pedido.creado_en)}<br>
      Canal: ${escaparHtml(pedido.canal)} | Pago: ${escaparHtml(infoPago)} | ${entrega}<br>
      ${detalleProductos}<br>
      Total: $${formatearPrecio(pedido.total)} | Estado: ${escaparHtml(pedido.estado)}
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
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ estado: 'cancelado' })
    });

    cargarPedidos();
  });
});
}

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

async function cargarPedidoParaEditar(pedidoId) {
  const respuesta = await fetch(`${API_URL}/pedidos/${pedidoId}`, { credentials: 'include' });

  if (!respuesta.ok) {
    alert('No se pudo cargar el pedido para editar');
    return;
  }

  const pedido = await respuesta.json();

  editandoPedidoId = pedidoId;

  document.getElementById('cliente').value = pedido.cliente;
  document.getElementById('canal').value = pedido.canal;
  document.getElementById('medio_pago').value = pedido.medio_pago;
  document.getElementById('tipo_entrega').value = pedido.tipo_entrega;
  document.getElementById('direccion_entrega').value = pedido.direccion_entrega || '';
  document.getElementById('cuit_receptor').value = pedido.cuit_receptor || '';

  document.getElementById('label-direccion').classList.toggle('oculto', pedido.tipo_entrega !== 'envio');

  const esMixto = pedido.medio_pago === 'mixto';
  document.getElementById('seccion-pago-mixto').classList.toggle('oculto', !esMixto);
  if (esMixto) {
    document.getElementById('monto-efectivo').value = pedido.monto_efectivo || '';
    document.getElementById('monto-transferencia').value = pedido.monto_transferencia || '';
  }

  if (pedido.cuit_receptor) {
    document.getElementById('check-facturar-cuit').checked = true;
    document.getElementById('label-cuit').classList.remove('oculto');
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
  document.getElementById('label-direccion').classList.add('oculto');
  document.getElementById('label-cuit').classList.add('oculto');
  document.getElementById('seccion-pago-mixto').classList.add('oculto');
  document.getElementById('mensaje-cliente-encontrado').textContent = '';
});

async function cargarProductosEnFormulario() {
  const respuesta = await fetch(`${API_URL}/productos`, { credentials: 'include' });
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

      productoSeleccionadoRequiereMasa = !!producto.requiere_masa;
      document.getElementById('label-masa').classList.toggle('oculto', !productoSeleccionadoRequiereMasa);
    });
    resultados.appendChild(li);
  });

  resultados.classList.toggle('mostrar', coincidencias.length > 0);
});

document.getElementById('check-combinar').addEventListener('change', (event) => {
  document.getElementById('select-producto-2').classList.toggle('oculto', !event.target.checked);
});

document.getElementById('tipo_entrega').addEventListener('change', (event) => {
  document.getElementById('label-direccion').classList.toggle('oculto', event.target.value !== 'envio');
});

document.getElementById('check-facturar-cuit').addEventListener('change', (event) => {
  document.getElementById('label-cuit').classList.toggle('oculto', !event.target.checked);
});

function renderizarListaProductos() {
  const lista = document.getElementById('lista-productos-agregados');
  lista.innerHTML = '';

  let total = 0;

  productosDelPedido.forEach((item, index) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    const masaTexto = item.tipo_masa ? (item.tipo_masa === 'molde' ? 'Al molde' : 'A la piedra') : '';
    const aclaracionTexto = item.aclaraciones ? ` (${escaparHtml(item.aclaraciones)})` : '';

    const li = document.createElement('li');
    li.innerHTML = `
      ${item.cantidad} x ${escaparHtml(item.nombre)}${masaTexto ? ' - ' + escaparHtml(masaTexto) : ''}${aclaracionTexto} - $${formatearPrecio(subtotal)}
      <button type="button" class="btn-quitar" data-index="${index}">Quitar</button>
    `;
    lista.appendChild(li);
  });

  document.querySelectorAll('.btn-quitar').forEach(boton => {
    boton.addEventListener('click', () => {
      const index = Number(boton.dataset.index);
      productosDelPedido.splice(index, 1);
      renderizarListaProductos();
      validarPagoMixto();
    });
  });

  document.getElementById('total-pedido').textContent = `Total: $${formatearPrecio(total)}`;
}

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

  productoSeleccionadoRequiereMasa = false;
  document.getElementById('label-masa').classList.add('oculto');

  document.getElementById('check-combinar').checked = false;
  document.getElementById('select-producto-2').classList.add('oculto');

  renderizarListaProductos();
  validarPagoMixto();
});

document.getElementById('formulario-pedido').addEventListener('submit', async (event) => {
  event.preventDefault();

  if (productosDelPedido.length === 0) {
    alert('Agregá al menos un producto');
    return;
  }

  const medioPago = document.getElementById('medio_pago').value;
  let montoEfectivo = null;
  let montoTransferencia = null;

  if (medioPago === 'mixto') {
    if (!validarPagoMixto()) {
      alert('La suma de efectivo y transferencia debe coincidir con el total del pedido');
      return;
    }
    montoEfectivo = Number(document.getElementById('monto-efectivo').value) || 0;
    montoTransferencia = Number(document.getElementById('monto-transferencia').value) || 0;
  }

  const datosGenerales = {
    cliente: document.getElementById('cliente').value,
    canal: document.getElementById('canal').value,
    medio_pago: medioPago,
    monto_efectivo: montoEfectivo,
    monto_transferencia: montoTransferencia,
    telefono: document.getElementById('telefono-cliente').value || null,
    tipo_entrega: document.getElementById('tipo_entrega').value,
    direccion_entrega: document.getElementById('direccion_entrega').value || null,
    cuit_receptor: document.getElementById('cuit_receptor').value || null,
    productos: productosDelPedido
  };

  if (editandoPedidoId) {
    const respuesta = await fetch(`${API_URL}/pedidos/${editandoPedidoId}/productos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(datosGenerales)
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
    document.getElementById('label-direccion').classList.add('oculto');
    document.getElementById('label-cuit').classList.add('oculto');
    document.getElementById('seccion-pago-mixto').classList.add('oculto');
    document.getElementById('mensaje-cliente-encontrado').textContent = '';
    productosDelPedido = [];
    renderizarListaProductos();
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
    const error = await respuesta.json();
    alert(error.error || 'Error al crear el pedido');
    return;
  }

  document.getElementById('formulario-pedido').reset();
  productosDelPedido = [];
  renderizarListaProductos();
  document.getElementById('label-direccion').classList.add('oculto');
  document.getElementById('label-cuit').classList.add('oculto');
  document.getElementById('seccion-pago-mixto').classList.add('oculto');
  document.getElementById('mensaje-cliente-encontrado').textContent = '';
  cargarPedidos();
});

cargarPedidos();
cargarProductosEnFormulario();