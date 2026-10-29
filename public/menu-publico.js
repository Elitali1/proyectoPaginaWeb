// Página "Menú" pública: cada local tiene sus precios, así que primero se elige el local y recién ahí
// se piden los productos de ese local (/productos/publico?sucursal=ID). Así el cliente nunca ve la lista
// de precios de un local que no eligió. Los locales salen de /sucursales/publico (solo los activos).
(function () {
  const API = window.location.origin;
  const lista = document.getElementById('lista-menu');
  const selector = document.getElementById('selector-local');
  const acciones = document.getElementById('menu-acciones');
  const subtitulo = document.getElementById('menu-sub');
  if (!lista || !selector || !acciones) return; // otra página

  let pedidoVigente = 0; // si el cliente toca varios locales rápido, solo se pinta la última respuesta

  function formatearPrecio(numero) {
    return Number(numero).toLocaleString('es-AR');
  }

  // Solo dígitos y con largo de teléfono con código de país; si no, ese local queda sin botón de WhatsApp.
  function limpiarTelefono(numero) {
    const digitos = String(numero || '').replace(/\D/g, '');
    return digitos.length >= 11 && digitos.length <= 15 ? digitos : null;
  }

  function mensaje(texto, clase) {
    lista.textContent = '';
    const p = document.createElement('p');
    p.className = clase;
    p.textContent = texto;
    lista.appendChild(p);
  }

  function enlace(clase, texto, href, externo) {
    const a = document.createElement('a');
    a.className = `btn-hero ${clase}`;
    a.textContent = texto;
    a.href = href;
    if (externo) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }

  function pintarAcciones(sucursal) {
    acciones.textContent = '';
    acciones.appendChild(enlace('primario', 'Armá tu pedido', `pedir.html?sucursal=${encodeURIComponent(sucursal.id)}`, false));
    const telefono = limpiarTelefono(sucursal.whatsapp);
    if (telefono) {
      acciones.appendChild(enlace('secundario', 'Escribinos por WhatsApp', `https://wa.me/${telefono}?text=${encodeURIComponent('Hola! Quiero hacer un pedido')}`, true));
    }
    acciones.classList.remove('oculto');
  }

  function pintarMenu(productos) {
    const grupos = {};
    productos.forEach(p => {
      const categoria = p.categoria_nombre || 'Otros';
      (grupos[categoria] = grupos[categoria] || []).push(p);
    });

    lista.textContent = '';
    Object.keys(grupos).forEach(categoria => {
      const titulo = document.createElement('h3');
      titulo.className = 'menu-categoria-titulo';
      titulo.textContent = categoria;
      lista.appendChild(titulo);

      grupos[categoria].forEach(p => {
        const fila = document.createElement('div');
        fila.className = 'menu-item';
        const nombre = document.createElement('span');
        nombre.className = 'nombre';
        nombre.textContent = p.nombre;
        const precio = document.createElement('span');
        precio.className = 'precio';
        precio.textContent = `$${formatearPrecio(p.precio)}`;
        fila.appendChild(nombre);
        fila.appendChild(precio);
        lista.appendChild(fila);
      });
    });
  }

  async function mostrarLocal(sucursal) {
    const miPedido = ++pedidoVigente;

    selector.querySelectorAll('.selector-local-btn').forEach(b => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.id) === sucursal.id));
    });
    subtitulo.textContent = sucursal.direccion ? `${sucursal.nombre} · ${sucursal.direccion}` : sucursal.nombre;
    pintarAcciones(sucursal);
    mensaje('Cargando el menú...', 'menu-loading');

    // Deja el local elegido en la URL: al recargar o compartir el link se mantiene
    try { history.replaceState(null, '', `?sucursal=${encodeURIComponent(sucursal.id)}`); } catch (e) { /* sin historial */ }

    try {
      const r = await fetch(`${API}/productos/publico?sucursal=${encodeURIComponent(sucursal.id)}`);
      if (!r.ok) throw new Error(String(r.status));
      const productos = await r.json();
      if (miPedido !== pedidoVigente) return;
      if (!Array.isArray(productos) || productos.length === 0) {
        mensaje('Este local todavía no cargó su menú. Escribinos por WhatsApp para consultarlo.', 'menu-loading');
        return;
      }
      pintarMenu(productos);
    } catch (e) {
      if (miPedido !== pedidoVigente) return;
      mensaje('No pudimos cargar el menú de este local. Probá de nuevo en un rato.', 'menu-error');
    }
  }

  async function iniciar() {
    let locales;
    try {
      const r = await fetch(`${API}/sucursales/publico`);
      if (!r.ok) throw new Error(String(r.status));
      locales = await r.json();
    } catch (e) {
      mensaje('No pudimos cargar el menú. Escribinos por WhatsApp para consultarlo.', 'menu-error');
      return;
    }
    if (!Array.isArray(locales) || locales.length === 0) {
      mensaje('El menú no está disponible por ahora. Volvé en un rato.', 'menu-loading');
      return;
    }

    // Con un solo local no hay nada que elegir: se muestra directo y sin selector
    if (locales.length === 1) {
      await mostrarLocal(locales[0]);
      return;
    }

    locales.forEach(s => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'selector-local-btn';
      boton.dataset.id = String(s.id);
      boton.setAttribute('aria-pressed', 'false');
      boton.textContent = s.nombre;
      boton.addEventListener('click', () => mostrarLocal(s));
      selector.appendChild(boton);
    });
    selector.classList.remove('oculto');

    const pedida = Number(new URLSearchParams(location.search).get('sucursal'));
    const inicial = locales.find(s => s.id === pedida);
    if (inicial) {
      await mostrarLocal(inicial);
    } else {
      mensaje('Elegí un local para ver su menú y sus precios.', 'menu-loading');
    }
  }

  iniciar();
})();
