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

// Una línea "Etiqueta: valor" dentro de una celda. Si el dato no está cargado se muestra el aviso en otro tono.
function datoCelda(etiqueta, valor, avisoSiFalta) {
  return valor
    ? `<span class="suc-dato"><b>${etiqueta}:</b> ${escapeHtml(valor)}</span>`
    : `<span class="suc-dato suc-falta"><b>${etiqueta}:</b> sin cargar (${avisoSiFalta})</span>`;
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
    const linkMenu = `${window.location.origin}/pedir.html?sucursal=${s.id}`;
    const linkMapa = s.link_mapa
      ? `<span class="suc-dato"><b>Link de Google Maps:</b> <a href="${escapeHtml(s.link_mapa)}" target="_blank" rel="noopener">ver en Maps</a></span>`
      : '<span class="suc-dato suc-falta"><b>Link de Google Maps:</b> sin cargar (Visitanos usa la búsqueda por dirección)</span>';

    const fila = document.createElement('tr');
    fila.dataset.id = s.id;
    fila.innerHTML = `
      <td class="suc-celda">
        <strong>${escapeHtml(s.nombre)}</strong> <small style="display: inline">(#${s.id})</small>
        <span class="estado ${s.activa ? 'estado-ok' : 'estado-fuera'} suc-estado">${s.activa ? 'Activa' : 'Inactiva'}</span>
        ${datoCelda('Dirección', s.direccion, 'las facturas usan el domicilio por defecto')}
        ${datoCelda('Horario', s.horario, 'Visitanos no muestra horario')}
      </td>
      <td class="suc-celda">
        ${datoCelda('Punto de venta', s.pto_vta, 'no puede facturar')}
        <span class="suc-dato"><b>Cobra transferencias en:</b> ${escapeHtml(s.cuenta_transferencia)}</span>
        ${datoCelda('Alias en el menú online', s.alias_transferencia, 'el menú online no muestra a dónde transferir')}
      </td>
      <td class="suc-celda suc-menu">
        ${datoCelda('WhatsApp para pedidos', s.whatsapp, 'el menú online no puede enviar pedidos')}
        ${linkMapa}
        <span class="suc-dato"><b>Menú online:</b> <a href="pedir.html?sucursal=${s.id}" target="_blank" rel="noopener">${escapeHtml(linkMenu)}</a></span>
        <button type="button" class="btn-tabla btn-copiar-menu" data-id="${s.id}">Copiar link del menú</button>
      </td>
      <td class="col-acciones suc-acciones-celda">
        <div class="suc-acciones">
          <button type="button" class="btn-tabla btn-editar-sucursal" data-id="${s.id}" aria-label="Editar ${escapeHtml(s.nombre)}">Editar</button>
          <button type="button" class="btn-tabla btn-toggle-sucursal" data-id="${s.id}">${s.activa ? 'Desactivar' : 'Reactivar'}</button>
        </div>
      </td>
    `;
    contenedor.appendChild(fila);
  });

  document.getElementById('sin-sucursales').classList.toggle('oculto', sucursales.length > 0);
  marcarFilaEditando();
  cargarOpcionesDeCopia();
}

// Resalta en la tabla la sucursal que se está editando.
function marcarFilaEditando() {
  document.querySelectorAll('#contenedor-sucursales tr').forEach(fila => {
    fila.classList.toggle('fila-editando', editandoId !== null && String(fila.dataset.id) === String(editandoId));
  });
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

// ---- Panel de Agregar / Editar ----
const panelSucursal = document.getElementById('panel-sucursal');

function mostrarMensajePanel(texto) {
  const mensaje = document.getElementById('mensaje-panel-sucursal');
  mensaje.textContent = texto;
  mensaje.classList.remove('oculto');
}

function ocultarMensajePanel() {
  document.getElementById('mensaje-panel-sucursal').classList.add('oculto');
}

function abrirPanel() {
  ocultarMensajePanel();
  panelSucursal.classList.remove('oculto');
  marcarFilaEditando();
  panelSucursal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function volverAModoCrear() {
  editandoId = null;
  document.getElementById('formulario-sucursal').reset();
  document.getElementById('titulo-formulario').textContent = 'Agregar sucursal';
  document.getElementById('btn-guardar').textContent = 'Crear sucursal';
  document.getElementById('seccion-copiar').classList.remove('oculto');
  cargarOpcionesDeCopia();
  ocultarMensajePanel();
  marcarFilaEditando();
}

function cerrarPanel() {
  volverAModoCrear();
  panelSucursal.classList.add('oculto');
}

document.getElementById('btn-agregar-sucursal').addEventListener('click', () => {
  volverAModoCrear();
  abrirPanel();
  document.getElementById('nombre').focus();
});

// Cancelar y Cerrar hacen lo mismo: descartan lo escrito y cierran el panel.
document.getElementById('btn-cancelar-edicion').addEventListener('click', cerrarPanel);
document.getElementById('btn-cerrar-panel-sucursal').addEventListener('click', cerrarPanel);

// Botones de cada fila: Editar, Copiar link del menú y Desactivar / Reactivar.
document.getElementById('contenedor-sucursales').addEventListener('click', async (event) => {
  const botonEditar = event.target.closest('button.btn-editar-sucursal');
  if (botonEditar) {
    const s = sucursales.find(x => Number(x.id) === Number(botonEditar.dataset.id));
    if (!s) return;
    editandoId = s.id;
    document.getElementById('nombre').value = s.nombre;
    document.getElementById('direccion').value = s.direccion || '';
    document.getElementById('pto_vta').value = s.pto_vta || '';
    document.getElementById('cuenta_transferencia').value = s.cuenta_transferencia || '';
    document.getElementById('alias_transferencia').value = s.alias_transferencia || '';
    document.getElementById('titular_transferencia').value = s.titular_transferencia || '';
    document.getElementById('whatsapp').value = s.whatsapp || '';
    document.getElementById('link_mapa').value = s.link_mapa || '';
    document.getElementById('horario').value = s.horario || '';
    document.getElementById('activa').checked = s.activa;
    document.getElementById('titulo-formulario').textContent = `Editar sucursal #${s.id}`;
    document.getElementById('btn-guardar').textContent = 'Guardar cambios';
    document.getElementById('seccion-copiar').classList.add('oculto');
    abrirPanel();
    return;
  }

  const botonCopiar = event.target.closest('button.btn-copiar-menu');
  if (botonCopiar) {
    const link = `${window.location.origin}/pedir.html?sucursal=${botonCopiar.dataset.id}`;
    try {
      await navigator.clipboard.writeText(link);
      botonCopiar.textContent = 'Link copiado';
    } catch (e) {
      window.prompt('Copiá el link del menú:', link);
    }
    return;
  }

  const botonToggle = event.target.closest('button.btn-toggle-sucursal');
  if (botonToggle) {
    const s = sucursales.find(x => Number(x.id) === Number(botonToggle.dataset.id));
    if (!s) return;

    if (s.activa && !confirm(`¿Desactivar "${s.nombre}"? Deja de poder usarse hasta que la reactives. No se borra ningún dato.`)) return;

    const respuesta = await fetch(`${API_URL}/sucursales/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nombre: s.nombre, direccion: s.direccion, pto_vta: s.pto_vta, cuenta_transferencia: s.cuenta_transferencia, whatsapp: s.whatsapp, link_mapa: s.link_mapa, horario: s.horario, activa: !s.activa })
    });

    if (manejarNoAutorizado(respuesta)) return;

    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      alert(error.error || 'No se pudo cambiar el estado de la sucursal');
      return;
    }

    cargarSucursales();
  }
});

document.getElementById('formulario-sucursal').addEventListener('submit', async (event) => {
  event.preventDefault();
  ocultarMensajePanel();

  const datos = {
    nombre: document.getElementById('nombre').value,
    direccion: document.getElementById('direccion').value,
    pto_vta: document.getElementById('pto_vta').value,
    cuenta_transferencia: document.getElementById('cuenta_transferencia').value,
    alias_transferencia: document.getElementById('alias_transferencia').value,
    titular_transferencia: document.getElementById('titular_transferencia').value,
    whatsapp: document.getElementById('whatsapp').value,
    link_mapa: document.getElementById('link_mapa').value,
    horario: document.getElementById('horario').value,
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

  if (manejarNoAutorizado(respuesta)) return;

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    mostrarMensajePanel(error.error || 'No se pudo guardar la sucursal');
    return;
  }

  const eraNueva = !editandoId;
  cerrarPanel();
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
  mensaje.classList.toggle('pro-aviso-error', !respuesta.ok);
  mensaje.classList.remove('oculto');
});

cargarIva();
