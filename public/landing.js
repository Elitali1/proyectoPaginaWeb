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

    // Agrupar los productos por categoría
    const grupos = {};
    productos.forEach(producto => {
      const categoria = producto.categoria_nombre || 'Otros';
      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }
      grupos[categoria].push(producto);
    });

    contenedor.innerHTML = '';

    Object.keys(grupos).forEach(categoria => {
      const tituloCategoria = document.createElement('h3');
      tituloCategoria.className = 'menu-categoria-titulo';
      tituloCategoria.textContent = categoria;
      contenedor.appendChild(tituloCategoria);

      grupos[categoria].forEach(producto => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `
          <span class="nombre">${producto.nombre}</span>
          <span class="precio">$${formatearPrecio(producto.precio)}</span>
        `;
        contenedor.appendChild(div);
      });
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

    // Agrupar las fotos por categoría, igual que el menú
    const grupos = {};
    conFoto.forEach(producto => {
      const categoria = producto.categoria_nombre || 'Otros';
      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }
      grupos[categoria].push(producto);
    });

    contenedor.innerHTML = '';

    Object.keys(grupos).forEach(categoria => {
      const tituloCategoria = document.createElement('h3');
      tituloCategoria.className = 'galeria-categoria-titulo';
      tituloCategoria.textContent = categoria;
      contenedor.appendChild(tituloCategoria);

      const subgrid = document.createElement('div');
      subgrid.className = 'galeria-subgrid';

      grupos[categoria].forEach(producto => {
        const div = document.createElement('div');
        div.className = 'galeria-item';
        div.innerHTML = `
          <img src="${producto.imagen}" alt="${producto.nombre}">
          <span class="etiqueta">${producto.nombre}</span>
        `;
        subgrid.appendChild(div);
      });

      contenedor.appendChild(subgrid);
    });
  } catch (error) {
    contenedor.innerHTML = '';
  }
}
function inicializarLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');

  document.addEventListener('click', (event) => {
    if (event.target.closest('.galeria-item')) {
      const item = event.target.closest('.galeria-item');
      const img = item.querySelector('img');
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.remove('oculto');
    }
  });

  lightbox.addEventListener('click', () => {
    lightbox.classList.add('oculto');
  });
}

cargarMenuPublico();
cargarGaleria();
inicializarLightbox();