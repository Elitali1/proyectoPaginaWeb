// Pantalla de categorías (dentro de Productos): crear, renombrar, cambiar si llevan masa y borrar las vacías.
// Se carga después de productos.js y usa sus funciones y variables globales (API_URL, cargarCategorias,
// cargarProductos) y las de auth-helpers.js (escapeHtml, manejarNoAutorizado).
// OJO: los botones de cada fila del catálogo se manejan en productos.js con .btn-editar y .btn-toggle,
// por eso estos botones usan otras clases (btn-comanda solo da el estilo amarillo).
let categoriaEditandoId = null;
let listaCategorias = [];

async function cargarListaCategorias() {
  const respuesta = await fetch(`${API_URL}/categorias`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return;
  listaCategorias = await respuesta.json();

  // #contenedor-categorias es el <tbody> de la tabla de categorías.
  const contenedor = document.getElementById('contenedor-categorias');
  contenedor.innerHTML = '';

  listaCategorias.forEach(c => {
    const n = c.cantidad_productos || 0;
    const tipo = c.requiere_masa ? 'Lleva masa' : (c.es_extra ? 'Extras' : 'Común');
    const fila = document.createElement('tr');
    fila.dataset.id = c.id;
    fila.innerHTML = `
      <td><strong>${escapeHtml(c.nombre)}</strong></td>
      <td>${tipo}</td>
      <td class="col-precio">${n}</td>
      <td class="col-acciones">
        <button type="button" class="btn-comanda btn-editar-categoria" data-id="${c.id}" aria-label="Editar la categoría ${escapeHtml(c.nombre)}">Editar</button>
        <button type="button" class="btn-cancelar btn-borrar-categoria" data-id="${c.id}" aria-label="Eliminar la categoría ${escapeHtml(c.nombre)}">Eliminar</button>
      </td>
    `;
    contenedor.appendChild(fila);
  });

  marcarCategoriaEditando();
}

// Resalta en la tabla la categoría que se está editando.
function marcarCategoriaEditando() {
  document.querySelectorAll('#contenedor-categorias tr').forEach(fila => {
    fila.classList.toggle('fila-editando', categoriaEditandoId !== null && Number(fila.dataset.id) === Number(categoriaEditandoId));
  });
}

// El selector de categoría del formulario de productos se vuelve a armar sin perder lo que estaba elegido.
async function refrescarSelectorDeProductos() {
  const select = document.getElementById('categoria');
  const elegida = select.value;
  await cargarCategorias();
  if (elegida) select.value = elegida;
  cargarProductos();
}

function volverAModoCrearCategoria() {
  categoriaEditandoId = null;
  document.getElementById('formulario-categoria').reset();
  document.getElementById('titulo-formulario-categoria').textContent = 'Agregar categoría';
  document.getElementById('btn-guardar-categoria').textContent = 'Guardar categoría';
  document.getElementById('btn-cancelar-categoria').classList.add('oculto');
  marcarCategoriaEditando();
}

document.getElementById('btn-cancelar-categoria').addEventListener('click', volverAModoCrearCategoria);

document.getElementById('contenedor-categorias').addEventListener('click', async (event) => {
  const boton = event.target.closest('button[data-id]');
  if (!boton) return;
  const categoria = listaCategorias.find(c => Number(c.id) === Number(boton.dataset.id));
  if (!categoria) return;

  if (boton.classList.contains('btn-editar-categoria')) {
    categoriaEditandoId = categoria.id;
    document.getElementById('categoria-nombre').value = categoria.nombre;
    document.getElementById('categoria-requiere-masa').checked = Boolean(categoria.requiere_masa);
    document.getElementById('categoria-es-extra').checked = Boolean(categoria.es_extra);
    document.getElementById('titulo-formulario-categoria').textContent = `Editar categoría "${categoria.nombre}"`;
    document.getElementById('btn-guardar-categoria').textContent = 'Guardar cambios';
    document.getElementById('btn-cancelar-categoria').classList.remove('oculto');
    marcarCategoriaEditando();
    document.getElementById('seccion-categorias').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (boton.classList.contains('btn-borrar-categoria')) {
    if (!confirm(`¿Eliminar la categoría "${categoria.nombre}"? Solo se puede si no tiene productos.`)) return;

    const respuesta = await fetch(`${API_URL}/categorias/${categoria.id}`, { method: 'DELETE', credentials: 'include' });
    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      alert(error.error || 'No se pudo eliminar la categoría');
      return;
    }

    if (categoriaEditandoId === categoria.id) volverAModoCrearCategoria();
    await cargarListaCategorias();
    refrescarSelectorDeProductos();
  }
});

document.getElementById('formulario-categoria').addEventListener('submit', async (event) => {
  event.preventDefault();

  const datos = {
    nombre: document.getElementById('categoria-nombre').value,
    requiere_masa: document.getElementById('categoria-requiere-masa').checked,
    es_extra: document.getElementById('categoria-es-extra').checked
  };

  // Cambiar si lleva masa cambia cómo se arma el pedido de todos sus productos en el menú online.
  if (categoriaEditandoId) {
    const actual = listaCategorias.find(c => Number(c.id) === Number(categoriaEditandoId));
    if (actual && Boolean(actual.requiere_masa) !== datos.requiere_masa && actual.cantidad_productos > 0 &&
        !confirm(`Esto cambia cómo se arma el pedido de sus ${actual.cantidad_productos} producto(s) en el menú online (elección de masa y mitad y mitad). ¿Seguir?`)) return;
  }

  const respuesta = await fetch(categoriaEditandoId ? `${API_URL}/categorias/${categoriaEditandoId}` : `${API_URL}/categorias`, {
    method: categoriaEditandoId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(datos)
  });

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    alert(error.error || 'No se pudo guardar la categoría');
    return;
  }

  volverAModoCrearCategoria();
  await cargarListaCategorias();
  refrescarSelectorDeProductos();
});

cargarListaCategorias();

// Una categoría de extras no lleva masa: al tildar uno se destilda el otro.
document.getElementById('categoria-es-extra').addEventListener('change', (e) => {
  if (e.target.checked) document.getElementById('categoria-requiere-masa').checked = false;
});
document.getElementById('categoria-requiere-masa').addEventListener('change', (e) => {
  if (e.target.checked) document.getElementById('categoria-es-extra').checked = false;
});
