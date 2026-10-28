requiereAdmin();

const API_URL = window.location.origin;

const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!usuario) {
  window.location.href = 'login.html';
}

document.getElementById('info-usuario').textContent = `Sesión: ${usuario.nombre} (${usuario.rol})`;
ocultarSiNoEsAdmin(['link-productos', 'link-insumos', 'link-compras', 'link-caja', 'link-usuarios', 'link-sucursales', 'link-clientes', 'link-dashboard']);

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch(`${API_URL}/usuarios/logout`, { method: 'POST', credentials: 'include' });
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
});

let editandoId = null;
let sucursales = [];

// Pide al servidor y, si la sesión venció, manda al login (igual que el resto de las pantallas).
async function pedirSucursales() {
  const respuesta = await fetch(`${API_URL}/sucursales`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return null;
  return respuesta.json();
}

// Las sucursales no se borran: una sucursal tiene pedidos, stock y comprobantes asociados.
// "Desactivar" la deja guardada pero sin uso.
async function cargarSucursales() {
  const lista = await pedirSucursales();
  if (!lista) return;
  sucursales = lista;

  const contenedor = document.getElementById('contenedor-sucursales');
  contenedor.innerHTML = '';

  sucursales.forEach(s => {
    const div = document.createElement('div');
    div.className = 'pedido';
    div.innerHTML = `
      <strong>${escapeHtml(s.nombre)}</strong> (#${s.id})${s.activa ? '' : ' · inactiva'}<br>
      Dirección: ${s.direccion ? escapeHtml(s.direccion) : 'sin cargar (las facturas usan el domicilio por defecto)'}<br>
      Punto de venta: ${s.pto_vta ? escapeHtml(s.pto_vta) : 'sin cargar (no puede facturar)'}<br>
      Cobra transferencias en: ${escapeHtml(s.cuenta_transferencia)}<br>
      WhatsApp para pedidos: ${s.whatsapp ? escapeHtml(s.whatsapp) : 'sin cargar (el menú online no puede enviar pedidos)'}<br>
      Menú online: <a href="pedir.html?sucursal=${s.id}" target="_blank" rel="noopener">${escapeHtml(`${window.location.origin}/pedir.html?sucursal=${s.id}`)}</a><br>
      <button type="button" class="btn-copiar-menu" data-id="${s.id}">Copiar link del menú</button>
      <button type="button" class="btn-editar-sucursal" data-id="${s.id}">Editar</button>
      <button type="button" class="btn-toggle-sucursal" data-id="${s.id}">${s.activa ? 'Desactivar' : 'Reactivar'}</button>
    `;
    contenedor.appendChild(div);
  });

  document.querySelectorAll('.btn-editar-sucursal').forEach(boton => {
    boton.addEventListener('click', () => {
      const s = sucursales.find(x => Number(x.id) === Number(boton.dataset.id));
      if (!s) return;
      editandoId = s.id;
      document.getElementById('nombre').value = s.nombre;
      document.getElementById('direccion').value = s.direccion || '';
      document.getElementById('pto_vta').value = s.pto_vta || '';
      document.getElementById('cuenta_transferencia').value = s.cuenta_transferencia || '';
      document.getElementById('whatsapp').value = s.whatsapp || '';
      document.getElementById('activa').checked = s.activa;
      document.getElementById('titulo-formulario').textContent = `Editar sucursal #${s.id}`;
      document.getElementById('btn-guardar').textContent = 'Guardar cambios';
      document.getElementById('btn-cancelar-edicion').classList.remove('oculto');
      document.getElementById('seccion-copiar').classList.add('oculto');
      window.scrollTo(0, 0);
    });
  });

  document.querySelectorAll('.btn-copiar-menu').forEach(boton => {
    boton.addEventListener('click', async () => {
      const link = `${window.location.origin}/pedir.html?sucursal=${boton.dataset.id}`;
      try {
        await navigator.clipboard.writeText(link);
        boton.textContent = 'Link copiado';
      } catch (e) {
        window.prompt('Copiá el link del menú:', link);
      }
    });
  });

  document.querySelectorAll('.btn-toggle-sucursal').forEach(boton => {
    boton.addEventListener('click', async () => {
      const s = sucursales.find(x => Number(x.id) === Number(boton.dataset.id));
      if (!s) return;

      if (s.activa && !confirm(`¿Desactivar "${s.nombre}"? Deja de poder usarse hasta que la reactives. No se borra ningún dato.`)) return;

      const respuesta = await fetch(`${API_URL}/sucursales/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nombre: s.nombre, direccion: s.direccion, pto_vta: s.pto_vta, cuenta_transferencia: s.cuenta_transferencia, whatsapp: s.whatsapp, activa: !s.activa })
      });

      if (!respuesta.ok) {
        const error = await respuesta.json().catch(() => ({}));
        alert(error.error || 'No se pudo cambiar el estado de la sucursal');
        return;
      }

      cargarSucursales();
    });
  });

  cargarOpcionesDeCopia();
}

// El selector de "copiar de" lista las sucursales que ya existen.
function cargarOpcionesDeCopia() {
  const select = document.getElementById('copiar_de');
  const elegida = select.value;
  select.innerHTML = '';

  const ninguna = document.createElement('option');
  ninguna.value = '';
  ninguna.textContent = 'No copiar (empieza vacía)';
  select.appendChild(ninguna);

  sucursales.forEach(s => {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = s.nombre;
    select.appendChild(option);
  });

  // Por defecto copia de la primera sucursal, que es lo más común al abrir un local nuevo.
  select.value = elegida || (sucursales.length > 0 ? String(sucursales[0].id) : '');
}

function volverAModoCrear() {
  editandoId = null;
  document.getElementById('formulario-sucursal').reset();
  document.getElementById('titulo-formulario').textContent = 'Agregar sucursal';
  document.getElementById('btn-guardar').textContent = 'Crear sucursal';
  document.getElementById('btn-cancelar-edicion').classList.add('oculto');
  document.getElementById('seccion-copiar').classList.remove('oculto');
  cargarOpcionesDeCopia();
}

document.getElementById('btn-cancelar-edicion').addEventListener('click', volverAModoCrear);

document.getElementById('formulario-sucursal').addEventListener('submit', async (event) => {
  event.preventDefault();

  const datos = {
    nombre: document.getElementById('nombre').value,
    direccion: document.getElementById('direccion').value,
    pto_vta: document.getElementById('pto_vta').value,
    cuenta_transferencia: document.getElementById('cuenta_transferencia').value,
    whatsapp: document.getElementById('whatsapp').value,
    activa: document.getElementById('activa').checked
  };

  let respuesta;

  if (editandoId) {
    respuesta = await fetch(`${API_URL}/sucursales/${editandoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(datos)
    });
  } else {
    const copiarDe = document.getElementById('copiar_de').value;
    respuesta = await fetch(`${API_URL}/sucursales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...datos, copiar_de: copiarDe || null, factor: document.getElementById('factor').value })
    });
  }

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    alert(error.error || 'No se pudo guardar la sucursal');
    return;
  }

  const eraNueva = !editandoId;
  volverAModoCrear();
  await cargarSucursales();

  if (eraNueva) {
    alert('Sucursal creada. Si copiaste productos e insumos, el stock quedó en 0. Para verla en los selectores del panel, recargá la página.');
  }
});

cargarSucursales();

// ---- Condición frente al IVA (una sola para todo el negocio) ----
async function cargarIva() {
  const respuesta = await fetch(`${API_URL}/configuracion/iva`, { credentials: 'include' });
  if (manejarNoAutorizado(respuesta)) return;
  if (!respuesta.ok) return;
  const iva = await respuesta.json();
  document.getElementById('iva-condicion').value = iva.condicion;
  document.getElementById('iva-alicuota').value = iva.alicuota;
}

document.getElementById('formulario-iva').addEventListener('submit', async (event) => {
  event.preventDefault();

  const mensaje = document.getElementById('mensaje-iva');
  const condicion = document.getElementById('iva-condicion').value;

  if (condicion === 'responsable_inscripto' && !confirm('Vas a pasar a trabajar con ventas netas de IVA en todo el dashboard. ¿Ya lo confirmaste con tu contador?')) return;

  const respuesta = await fetch(`${API_URL}/configuracion/iva`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ condicion, alicuota: document.getElementById('iva-alicuota').value })
  });

  if (manejarNoAutorizado(respuesta)) return;

  const resultado = await respuesta.json().catch(() => ({}));
  mensaje.textContent = respuesta.ok ? 'Condición frente al IVA guardada.' : (resultado.error || 'No se pudo guardar');
  mensaje.classList.remove('oculto');
});

cargarIva();
