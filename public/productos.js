requiereAdmin();

const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

const usuario = JSON.parse(localStorage.getItem('usuario'));
document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-caja', 'link-usuarios', 'link-clientes']);

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

let editandoId = null;
let categorias = [];
let insumosDisponibles = [];
let itemsReceta = [];

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

async function cargarCategorias() {
  const respuesta = await fetch(`${API_URL}/categorias`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  categorias = await respuesta.json();

  const select = document.getElementById('categoria');
  select.innerHTML = '';
  categorias.forEach(categoria => {
    const option = document.createElement('option');
    option.value = categoria.id;
    option.textContent = categoria.nombre;
    select.appendChild(option);
  });
}

async function cargarInsumosParaReceta() {
  const respuesta = await fetch(`${API_URL}/insumos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
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
  const respuesta = await fetch(`${API_URL}/productos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const productos = await respuesta.json();

  const contenedor = document.getElementById('contenedor-productos');
  contenedor.innerHTML = '';

  productos.forEach(producto => {
    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${producto.nombre}</strong> - $${formatearPrecio(producto.precio)}
      ${producto.categoria_nombre ? ` (${producto.categoria_nombre})` : ''}
      ${producto.disponible ? '' : ' (no disponible)'}
      ${producto.imagen ? `<br><small>Imagen: ${producto.imagen}</small>` : ''}
      <button type="button" class="btn-editar" data-id="${producto.id}" data-nombre="${producto.nombre}" data-precio="${producto.precio}" data-disponible="${producto.disponible}" data-imagen="${producto.imagen || ''}" data-categoria="${producto.categoria_id || ''}">Editar</button>
      <button type="button" class="btn-toggle" data-id="${producto.id}" data-disponible="${producto.disponible}">
        ${producto.disponible ? 'Marcar no disponible' : 'Reactivar'}
      </button>
    `;
    contenedor.appendChild(div);
  });

  document.querySelectorAll('.btn-toggle').forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      const disponibleActual = boton.dataset.disponible === 'true';

      const producto = productos.find(p => p.id === Number(id));

      await fetch(`${API_URL}/productos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: producto.nombre,
          precio: producto.precio,
          disponible: !disponibleActual,
          imagen: producto.imagen,
          categoria_id: producto.categoria_id
        })
      });

      cargarProductos();
    });
  });

  document.querySelectorAll('.btn-editar').forEach(boton => {
    boton.addEventListener('click', async () => {
      editandoId = boton.dataset.id;
      document.getElementById('nombre').value = boton.dataset.nombre;
      document.getElementById('precio').value = boton.dataset.precio;
      document.getElementById('imagen').value = boton.dataset.imagen;
      document.getElementById('categoria').value = boton.dataset.categoria;
      document.getElementById('disponible').checked = boton.dataset.disponible === 'true';
      document.getElementById('titulo-formulario').textContent = 'Editar producto';
      document.getElementById('btn-guardar').textContent = 'Guardar cambios';
      document.getElementById('btn-cancelar-edicion').classList.remove('oculto');
      document.getElementById('seccion-subir-foto').classList.remove('oculto');
      document.getElementById('seccion-receta').classList.remove('oculto');

      await cargarRecetaDeProducto(editandoId);
    });
  });
}

// ---- Cargar la receta ya guardada de un producto, y su costo/margen ----
async function cargarRecetaDeProducto(productoId) {
  const respuesta = await fetch(`${API_URL}/recetas/${productoId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
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
      ${insumo ? insumo.nombre : 'Insumo'}: ${item.cantidad} ${insumo ? insumo.unidad_medida : ''}
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

  await fetch(`${API_URL}/recetas/${editandoId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ items: itemsReceta })
  });

  await mostrarCostoYMargen(editandoId);
  alert('Receta guardada');
});

async function mostrarCostoYMargen(productoId) {
  const respuesta = await fetch(`${API_URL}/recetas/${productoId}/costo`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
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
  document.getElementById('btn-cancelar-edicion').classList.add('oculto');
  document.getElementById('seccion-subir-foto').classList.add('oculto');
  document.getElementById('seccion-receta').classList.add('oculto');
  document.getElementById('lista-receta').innerHTML = '';
  document.getElementById('resultado-costo').innerHTML = '';
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(datosProducto)
    });
    editandoId = null;
    itemsReceta = [];
    document.getElementById('titulo-formulario').textContent = 'Agregar producto';
    document.getElementById('btn-guardar').textContent = 'Guardar';
    document.getElementById('btn-cancelar-edicion').classList.add('oculto');
    document.getElementById('seccion-receta').classList.add('oculto');
  } else {
  const respuesta = await fetch(`${API_URL}/productos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(datosProducto)
  });

  const productoCreado = await respuesta.json();

  editandoId = productoCreado.id;
  document.getElementById('titulo-formulario').textContent = 'Editar producto';
  document.getElementById('btn-guardar').textContent = 'Guardar cambios';
  document.getElementById('btn-cancelar-edicion').classList.remove('oculto');
  document.getElementById('seccion-subir-foto').classList.remove('oculto');
  document.getElementById('seccion-receta').classList.remove('oculto');

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
    headers: { 'Authorization': `Bearer ${token}` },
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

cargarCategorias();
cargarInsumosParaReceta();
cargarProductos();