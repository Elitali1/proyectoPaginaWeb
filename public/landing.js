const API_URL = window.location.origin;

function escapeHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatearPrecio(numero) {
  return Number(numero).toLocaleString('es-AR');
}

// Las fotos de productos se suben directo desde el celular sin comprimir (algunas pesan varios MB),
// así que en conexiones lentas o celulares más limitados la galería no llegaba a cargar. Esto le pide
// a Cloudinary una versión liviana on-the-fly, sin tocar la foto original ni tener que resubir nada.
// Cualquier URL que no sea de Cloudinary se devuelve sin tocar.
function imagenOptimizada(url, ancho) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${ancho}/`);
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
          <img src="${escapeHtml(imagenOptimizada(producto.imagen, 800))}" data-imagen-grande="${escapeHtml(imagenOptimizada(producto.imagen, 1600))}" alt="${escapeHtml(producto.nombre)}" loading="lazy">
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
      // En el lightbox se agranda la foto en pantalla, así que pide una versión más grande que la
      // miniatura (pero igual mucho más liviana que la original de varios MB).
      lightboxImg.src = img.dataset.imagenGrande || img.src;
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