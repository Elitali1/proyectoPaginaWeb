// Menú público con armado de pedido. El pedido NO se guarda en el sistema: termina en un mensaje de WhatsApp
// al local, y quien atiende lo carga en Pedidos como siempre. Toda la lógica de precios y mensaje vive en
// pedido-logica.js (probada aparte); acá solo se dibuja la página y se atienden los clicks.
(function () {
  const L = window.PedidoLogica;
  const API = window.location.origin;

  const estado = {
    sucursales: [],
    sucursal: null,
    productos: [],
    catalogo: {},
    items: [],
    editando: null,
    cantidadEdicion: 1
  };

  const $ = (id) => document.getElementById(id);

  // ---- Almacenamiento (puede fallar: modo privado, bloqueado, etc.) ----
  function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ } }
  function leer(clave) { try { return localStorage.getItem(clave); } catch (e) { return null; } }
  const claveCarrito = () => `pedido:${estado.sucursal.id}`;

  function guardarCarrito() { guardar(claveCarrito(), JSON.stringify(estado.items)); }
  function cargarCarrito() {
    try {
      const guardado = JSON.parse(leer(claveCarrito()) || '[]');
      return Array.isArray(guardado) ? guardado.filter(i => i && Number.isInteger(i.producto_id) && i.cantidad > 0) : [];
    } catch (e) { return []; }
  }

  // ---- Utilidades de pantalla ----
  const precio = (n) => `$${L.formatearPrecio(n)}`;
  const nombreCorto = (s) => s.nombre.replace(/^donchichopizza\s*/i, '').trim() || s.nombre;

  function crear(tag, clase, texto) {
    const el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function foto(producto, clase) {
    const caja = crear('div', clase);
    if (producto.imagen) {
      const img = document.createElement('img');
      img.src = producto.imagen;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => { img.remove(); caja.appendChild(crear('span', 'foto-vacia', producto.nombre.charAt(0))); });
      caja.appendChild(img);
    } else {
      caja.appendChild(crear('span', 'foto-vacia', producto.nombre.charAt(0)));
    }
    return caja;
  }

  let temporizadorAviso = null;
  function avisar(texto) {
    const aviso = $('aviso');
    aviso.textContent = texto;
    aviso.classList.remove('oculto');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => aviso.classList.add('oculto'), 3500);
  }

  function abrir(dlg) { if (!dlg.open) dlg.showModal(); }
  function cerrar(dlg) { if (dlg.open) dlg.close(); }

  // ---- Carga de datos ----
  async function pedirJson(ruta) {
    const r = await fetch(`${API}${ruta}`);
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  function mostrarEstado(texto, esError) {
    const el = $('estado-menu');
    el.textContent = texto;
    el.classList.toggle('error', Boolean(esError));
    el.classList.toggle('oculto', !texto);
  }

  async function iniciar() {
    try {
      estado.sucursales = await pedirJson('/sucursales/publico');
    } catch (e) {
      mostrarEstado('No pudimos cargar el menú. Escribinos por WhatsApp para pedir.', true);
      return;
    }
    if (estado.sucursales.length === 0) {
      mostrarEstado('El menú no está disponible por ahora. Volvé en un rato.', true);
      return;
    }

    const pedida = Number(new URLSearchParams(location.search).get('sucursal'));
    const recordada = Number(leer('pedido:ultimo-local'));
    const buscar = (id) => estado.sucursales.find(s => s.id === id);
    const elegida = buscar(pedida) || (estado.sucursales.length === 1 ? estado.sucursales[0] : null) || (!pedida ? buscar(recordada) : null);

    renderLocales();
    if (elegida) {
      await elegirLocal(elegida);
    } else {
      mostrarEstado('');
      abrir($('dlg-local'));
    }
  }

  async function elegirLocal(sucursal) {
    estado.sucursal = sucursal;
    guardar('pedido:ultimo-local', String(sucursal.id));
    cerrar($('dlg-local'));
    renderCabeceraLocal();
    mostrarEstado('Cargando el menú...');
    $('menu').textContent = '';
    $('categorias').classList.add('oculto');

    try {
      estado.productos = await pedirJson(`/productos/publico?sucursal=${sucursal.id}`);
    } catch (e) {
      mostrarEstado('No pudimos cargar el menú de este local. Probá de nuevo en un rato o escribinos por WhatsApp.', true);
      return;
    }
    if (estado.productos.length === 0) {
      mostrarEstado('Este local todavía no cargó su menú. Escribinos por WhatsApp para pedir.', true);
      return;
    }
    estado.catalogo = {};
    estado.productos.forEach(p => { estado.catalogo[p.id] = p; });

    const reconciliado = L.reconciliar(cargarCarrito(), estado.catalogo);
    estado.items = reconciliado.items;
    guardarCarrito();
    if (reconciliado.quitados.length) avisar(`Sacamos de tu pedido lo que ya no está disponible: ${reconciliado.quitados.join(', ')}.`);

    mostrarEstado('');
    renderMenu();
    actualizarBarra();
  }

  // ---- Cabecera y locales ----
  function renderCabeceraLocal() {
    const s = estado.sucursal;
    const varios = estado.sucursales.length > 1;
    $('btn-local').classList.toggle('oculto', !varios);
    $('local-fijo').classList.toggle('oculto', varios);
    $('local-nombre').textContent = nombreCorto(s);
    $('local-direccion').textContent = s.direccion || '';
    $('local-fijo-nombre').textContent = nombreCorto(s);
    $('local-fijo-direccion').textContent = s.direccion || '';
  }

  function renderLocales() {
    const lista = $('lista-locales');
    lista.textContent = '';
    estado.sucursales.forEach(s => {
      const b = crear('button', 'local-opcion');
      b.type = 'button';
      b.appendChild(crear('strong', '', nombreCorto(s)));
      b.appendChild(crear('span', '', s.direccion || ''));
      b.addEventListener('click', () => {
        if (estado.sucursal && estado.sucursal.id !== s.id && estado.items.length) avisar(`Tu pedido de ${nombreCorto(estado.sucursal)} queda guardado.`);
        elegirLocal(s);
      });
      lista.appendChild(b);
    });
  }

  // ---- Menú ----
  function renderMenu() {
    const grupos = new Map();
    estado.productos.forEach(p => {
      const cat = p.categoria_nombre || 'Otros';
      if (!grupos.has(cat)) grupos.set(cat, []);
      grupos.get(cat).push(p);
    });

    const menu = $('menu');
    const chips = $('categorias');
    menu.textContent = '';
    chips.textContent = '';

    let i = 0;
    grupos.forEach((productos, cat) => {
      const id = `cat-${i++}`;
      const titulo = crear('h2', 'cat-titulo', cat);
      titulo.id = id;
      menu.appendChild(titulo);

      const grilla = crear('div', 'grilla');
      productos.forEach(p => {
        const t = crear('button', 'tarjeta');
        t.type = 'button';
        t.dataset.producto = String(p.id);
        t.appendChild(foto(p, 'foto'));
        const info = crear('div', 'tarjeta-info');
        info.appendChild(crear('span', 'tarjeta-nombre', p.nombre));
        info.appendChild(crear('span', 'tarjeta-precio', precio(p.precio)));
        t.appendChild(info);
        t.appendChild(crear('span', 'tarjeta-mas', '+'));
        const badge = crear('span', 'tarjeta-cant oculto');
        badge.dataset.badge = String(p.id);
        t.appendChild(badge);
        grilla.appendChild(t);
      });
      menu.appendChild(grilla);

      const chip = crear('button', 'chip-cat', cat);
      chip.type = 'button';
      chip.addEventListener('click', () => {
        document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      chips.appendChild(chip);
    });
    chips.classList.toggle('oculto', grupos.size < 2);
    actualizarBadges();
  }

  function actualizarBadges() {
    document.querySelectorAll('[data-badge]').forEach(el => {
      const n = L.cantidadDeProducto(estado.items, el.dataset.badge);
      el.textContent = `${n} en tu pedido`;
      el.classList.toggle('oculto', n === 0);
    });
  }

  function actualizarBarra() {
    const cantidad = L.cantidadTotal(estado.items);
    $('barra-pedido').classList.toggle('oculto', cantidad === 0);
    $('barra-cantidad').textContent = String(cantidad);
    $('barra-total').textContent = precio(L.totalPedido(estado.items, estado.catalogo));
    actualizarBadges();
  }

  // ---- Hoja de producto ----
  function abrirProducto(producto) {
    estado.editando = producto;
    estado.cantidadEdicion = 1;
    $('prod-titulo').textContent = producto.nombre;
    $('prod-precio-base').textContent = precio(producto.precio);
    const caja = $('prod-foto');
    caja.textContent = '';
    caja.classList.toggle('oculto', !producto.imagen);
    if (producto.imagen) {
      const img = document.createElement('img');
      img.src = producto.imagen;
      img.alt = producto.nombre;
      caja.appendChild(img);
    }

    const conMasa = Boolean(producto.requiere_masa);
    $('grupo-masa').classList.toggle('oculto', !conMasa);
    $('grupo-masa').querySelector('input[value="piedra"]').checked = true;

    // Mitad y mitad solo entre productos que llevan masa (pizzas), igual que en el local.
    const otros = estado.productos.filter(p => p.requiere_masa && p.id !== producto.id);
    $('grupo-mitad').classList.toggle('oculto', !conMasa || otros.length === 0);
    $('chk-mitad').checked = false;
    $('lbl-gusto2').classList.add('oculto');
    $('txt-mitad').textContent = `Combinar dos gustos (mitad y mitad, +${precio(L.RECARGO_MITAD_Y_MITAD)})`;
    const sel = $('sel-gusto2');
    sel.textContent = '';
    otros.forEach(p => {
      const op = document.createElement('option');
      op.value = String(p.id);
      op.textContent = p.nombre;
      sel.appendChild(op);
    });

    $('prod-aclaraciones').value = '';
    refrescarHoja();
    abrir($('dlg-producto'));
  }

  function segundoGusto() {
    if (!$('chk-mitad').checked) return null;
    return estado.catalogo[Number($('sel-gusto2').value)] || null;
  }

  function refrescarHoja() {
    const p2 = segundoGusto();
    $('prod-cantidad').textContent = String(estado.cantidadEdicion);
    $('prod-total').textContent = precio(L.precioUnitario(estado.editando, p2) * estado.cantidadEdicion);
  }

  function agregarDesdeHoja() {
    const p = estado.editando;
    const p2 = segundoGusto();
    estado.items = L.agregarItem(estado.items, {
      producto_id: p.id,
      producto_id_2: p2 ? p2.id : undefined,
      cantidad: estado.cantidadEdicion,
      tipo_masa: p.requiere_masa ? (document.querySelector('input[name="masa"]:checked') || {}).value : undefined,
      aclaraciones: $('prod-aclaraciones').value
    });
    guardarCarrito();
    actualizarBarra();
    cerrar($('dlg-producto'));
    avisar(`Agregamos ${p.nombre} a tu pedido.`);
  }

  // ---- Hoja del pedido (comanda) ----
  function renderPedido() {
    const hay = estado.items.length > 0;
    $('ped-vacio').classList.toggle('oculto', hay);
    $('ped-contenido').classList.toggle('oculto', !hay);
    $('ped-local').textContent = `Pedido para ${estado.sucursal.nombre}`;
    if (!hay) return;

    const ul = $('ped-lineas');
    ul.textContent = '';
    estado.items.forEach(item => {
      const d = L.describirItem(item, estado.catalogo);
      const clave = L.claveItem(item);
      const li = crear('li', 'linea');
      li.appendChild(foto(estado.catalogo[item.producto_id], 'linea-foto'));

      const centro = crear('div');
      centro.appendChild(crear('div', 'linea-nombre', d.nombre));
      const detalle = [d.masa, d.aclaraciones].filter(Boolean).join(' · ');
      if (detalle) centro.appendChild(crear('div', 'linea-detalle', detalle));
      const ctl = crear('div', 'linea-ctl');
      const menos = crear('button', '', '−');
      menos.type = 'button';
      menos.dataset.clave = clave;
      menos.dataset.delta = '-1';
      menos.setAttribute('aria-label', d.cantidad === 1 ? `Sacar ${d.nombre}` : `Restar uno a ${d.nombre}`);
      const cant = crear('output', '', String(d.cantidad));
      const mas = crear('button', '', '+');
      mas.type = 'button';
      mas.dataset.clave = clave;
      mas.dataset.delta = '1';
      mas.setAttribute('aria-label', `Sumar uno a ${d.nombre}`);
      ctl.append(menos, cant, mas);
      centro.appendChild(ctl);

      li.appendChild(centro);
      li.appendChild(crear('div', 'linea-sub', precio(d.subtotal)));
      ul.appendChild(li);
    });

    $('ped-total').textContent = precio(L.totalPedido(estado.items, estado.catalogo));
    const envio = document.querySelector('input[name="entrega"]:checked').value === 'envio';
    $('ped-nota-envio').classList.toggle('oculto', !envio);
    $('lbl-direccion').classList.toggle('oculto', !envio);

    const sinWhatsapp = !L.limpiarTelefono(estado.sucursal.whatsapp);
    $('btn-enviar').disabled = sinWhatsapp;
    mostrarErrorPedido(sinWhatsapp ? 'Este local todavía no tiene WhatsApp cargado para recibir pedidos por acá.' : '');
  }

  function mostrarErrorPedido(texto) {
    const el = $('ped-error');
    el.textContent = texto;
    el.classList.toggle('oculto', !texto);
  }

  function abrirPedido() {
    $('ped-enviado').classList.add('oculto');
    $('form-pedido').classList.remove('oculto');
    renderPedido();
    abrir($('dlg-pedido'));
  }

  function enviarPedido(evento) {
    evento.preventDefault();
    const nombre = L.limpiarTexto($('ped-nombre').value, 60);
    const entrega = document.querySelector('input[name="entrega"]:checked').value;
    const direccion = L.limpiarTexto($('ped-direccion').value, 120);

    if (!nombre) { mostrarErrorPedido('Poné tu nombre para que sepamos a quién entregarle.'); $('ped-nombre').focus(); return; }
    if (entrega === 'envio' && !direccion) { mostrarErrorPedido('Poné la dirección de entrega, o elegí retiro en el local.'); $('ped-direccion').focus(); return; }
    mostrarErrorPedido('');

    const texto = L.armarMensaje({
      local: estado.sucursal.nombre,
      items: estado.items,
      catalogoPorId: estado.catalogo,
      entrega,
      direccion,
      pago: document.querySelector('input[name="pago"]:checked').value,
      nombre,
      aclaraciones: L.limpiarTexto($('ped-aclaraciones').value, 200)
    });
    const link = L.linkWhatsapp(estado.sucursal.whatsapp, texto);
    if (!link) { mostrarErrorPedido('Este local todavía no tiene WhatsApp cargado.'); return; }

    guardar('pedido:nombre', nombre);
    // Con 'noopener' window.open siempre devuelve null y no se puede saber si se bloqueó la ventana.
    const ventana = window.open(link, '_blank');
    if (ventana) ventana.opener = null; else window.location.href = link;
    $('form-pedido').classList.add('oculto');
    $('ped-enviado').classList.remove('oculto');
  }

  function nuevoPedido() {
    estado.items = [];
    guardarCarrito();
    actualizarBarra();
    cerrar($('dlg-pedido'));
  }

  // ---- Eventos ----
  function conectar() {
    document.addEventListener('click', (e) => {
      const dlg = e.target instanceof HTMLDialogElement ? e.target : null;
      if (dlg) { cerrar(dlg); return; } // click en el fondo
      if (e.target.closest('[data-cerrar]')) { cerrar(e.target.closest('dialog')); return; }
      const tarjeta = e.target.closest('.tarjeta');
      if (tarjeta) abrirProducto(estado.catalogo[Number(tarjeta.dataset.producto)]);
    });

    $('btn-local').addEventListener('click', () => abrir($('dlg-local')));
    $('btn-ver-pedido').addEventListener('click', abrirPedido);

    $('prod-menos').addEventListener('click', () => { estado.cantidadEdicion = Math.max(1, estado.cantidadEdicion - 1); refrescarHoja(); });
    $('prod-mas').addEventListener('click', () => { estado.cantidadEdicion = Math.min(L.CANTIDAD_MAXIMA, estado.cantidadEdicion + 1); refrescarHoja(); });
    $('chk-mitad').addEventListener('change', () => { $('lbl-gusto2').classList.toggle('oculto', !$('chk-mitad').checked); refrescarHoja(); });
    $('sel-gusto2').addEventListener('change', refrescarHoja);
    $('prod-agregar').addEventListener('click', agregarDesdeHoja);

    $('ped-lineas').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-clave]');
      if (!b) return;
      estado.items = L.cambiarCantidad(estado.items, b.dataset.clave, Number(b.dataset.delta));
      guardarCarrito();
      actualizarBarra();
      renderPedido();
    });

    document.querySelectorAll('input[name="entrega"]').forEach(r => r.addEventListener('change', renderPedido));
    $('form-pedido').addEventListener('submit', enviarPedido);
    $('btn-volver-pedido').addEventListener('click', abrirPedido);
    $('btn-nuevo-pedido').addEventListener('click', nuevoPedido);

    const nombreGuardado = leer('pedido:nombre');
    if (nombreGuardado) $('ped-nombre').value = nombreGuardado;
  }

  conectar();
  iniciar();
})();
