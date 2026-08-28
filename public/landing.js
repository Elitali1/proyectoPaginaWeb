const API_URL = window.location.origin;

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

async function cargarMenuPublico() {
  const contenedor = document.getElementById('lista-menu');

  try {
    const respuesta = await fetch(`${API_URL}/productos/publico`);

    if (!respuesta.ok) {
      throw new Error('Error al obtener el menú');
    }

    const productos = await respuesta.json();

    if (productos.length === 0) {
      contenedor.innerHTML = '<p class="menu-loading">Menú en preparación, volvé pronto.</p>';
      return;
    }

    contenedor.innerHTML = '';
    productos.forEach(producto => {
      const div = document.createElement('div');
      div.className = 'menu-item';
      div.innerHTML = `
        <span class="nombre">${producto.nombre}</span>
        <span class="precio">$${formatearPrecio(producto.precio)}</span>
      `;
      contenedor.appendChild(div);
    });
  } catch (error) {
    contenedor.innerHTML = '<p class="menu-error">No pudimos cargar el menú. Escribinos por WhatsApp para consultarlo.</p>';
  }
}

async function cargarGaleria() {
  const contenedor = document.getElementById('galeria-grid');

  try {
    const respuesta = await fetch(`${API_URL}/productos/publico`);
    const productos = await respuesta.json();

    const conFoto = productos.filter(p => p.imagen);

    if (conFoto.length === 0) {
      contenedor.innerHTML = '';
      return;
    }

    contenedor.innerHTML = '';
    conFoto.forEach(producto => {
      const div = document.createElement('div');
      div.className = 'galeria-item';
      div.innerHTML = `
        <img src="${producto.imagen}" alt="${producto.nombre}">
        <span class="etiqueta">${producto.nombre}</span>
      `;
      contenedor.appendChild(div);
    });
  } catch (error) {
    contenedor.innerHTML = '';
  }
}

cargarMenuPublico();
cargarGaleria();