const API_URL = window.location.origin;

function escapeHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

async function cargarMenuPublico() {
  const contenedor = document.getElementById('lista-menu');
  if (!contenedor) return; // Esta página no tiene sección de menú

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
          <span class="nombre">${escapeHtml(producto.nombre)}</span>
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
  if (!contenedor) return; // Esta página no tiene galería

  try {
    const respuesta = await fetch(`${API_URL}/productos/publico`);
    const productos = await respuesta.json();

    const conFoto = productos.filter(p => p.imagen);

    if (conFoto.length === 0) {
      contenedor.innerHTML = '';
      return;
    }

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
          <img src="${escapeHtml(producto.imagen)}" alt="${escapeHtml(producto.nombre)}" loading="lazy">
          <span class="etiqueta">${escapeHtml(producto.nombre)}</span>
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
  if (!lightbox) return; // Esta página no tiene lightbox

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