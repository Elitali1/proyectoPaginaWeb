function requiereAdmin() {
  const usuarioGuardado = localStorage.getItem('usuario');

  if (!usuarioGuardado) {
    window.location.href = 'login.html';
    return;
  }

  const usuario = JSON.parse(usuarioGuardado);

  if (usuario.rol !== 'admin') {
    alert('No tenés permisos para acceder a esta sección. Consultá con un administrador.');
    window.location.href = 'index.html';
  }
}

function ocultarSiNoEsAdmin(idsElementos) {
  const usuarioGuardado = localStorage.getItem('usuario');
  if (!usuarioGuardado) return;

  const usuario = JSON.parse(usuarioGuardado);
  if (usuario.rol !== 'admin') {
    idsElementos.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }
}
// Escapa texto antes de meterlo en un innerHTML: sin esto, un nombre de cliente o una aclaración
// con <etiquetas> o comillas rompía la página (o permitía inyectar HTML).
function escapeHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function manejarNoAutorizado(respuesta) {
  if (respuesta.status === 401) {
    window.location.href = 'login.html';
    return true;
  }
  return false;
}

// ============================================================================
// INDICADOR DE SUCURSAL (se ejecuta solo en cada página que carga este archivo)
//  1) Le pone a <html> el atributo data-sucursal="N": el CSS usa ese número para cambiar los colores
//     de toda la app según el local en el que se está trabajando.
//  2) Muestra el nombre de la sucursal arriba, junto al usuario.
//  3) Si es administrador, agrega un selector para cambiar de sucursal sin cerrar sesión.
//  4) Fuera del dominio de producción muestra una banda "STAGING".
// Está en una función propia para no pisar nombres de las demás páginas.
// ============================================================================
(function indicadorDeSucursal() {
  // Se avisa "STAGING" en cualquier dirección que NO sea la de producción (ni la computadora local).
  // Así, si algún día cambia el dominio de pruebas, la banda sigue apareciendo: lo peligroso sería
  // creer que se está en pruebas cuando se está en producción, o al revés.
  const DOMINIOS_PRODUCCION = ['donchichopizza.com.ar', 'www.donchichopizza.com.ar'];
  function esAmbienteDePruebas() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return false;
    return !DOMINIOS_PRODUCCION.includes(host);
  }

  function leerUsuario() {
    try {
      const guardado = localStorage.getItem('usuario');
      return guardado ? JSON.parse(guardado) : null;
    } catch (e) {
      return null;
    }
  }

  function mostrarBandaDePruebas() {
    if (!esAmbienteDePruebas() || document.getElementById('banda-staging')) return;
    const banda = document.createElement('div');
    banda.id = 'banda-staging';
    banda.textContent = 'STAGING · ambiente de pruebas, no es el sistema real';
    document.body.prepend(banda);
  }

  async function cargarSelector(contenedor, usuario) {
    try {
      const respuesta = await fetch('/usuarios/sucursales', { credentials: 'include' });
      if (!respuesta.ok) return;
      const sucursales = (await respuesta.json()).filter(s => s.activa);
      if (sucursales.length < 2) return; // con una sola sucursal no hace falta elegir

      const selector = document.createElement('select');
      selector.id = 'selector-sucursal';
      selector.title = 'Cambiar de sucursal';
      sucursales.forEach(s => {
        const opcion = document.createElement('option');
        opcion.value = s.id;
        opcion.textContent = s.nombre;
        if (s.id === usuario.sucursal_id) opcion.selected = true;
        selector.appendChild(opcion);
      });

      selector.addEventListener('change', async () => {
        selector.disabled = true;
        try {
          const resp = await fetch('/usuarios/cambiar-sucursal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sucursal_id: Number(selector.value) })
          });
          if (manejarNoAutorizado(resp)) return;
          if (!resp.ok) throw new Error('No se pudo cambiar de sucursal');
          const datos = await resp.json();
          localStorage.setItem('usuario', JSON.stringify(datos.usuario));
          window.location.reload(); // recarga la pantalla con los datos de la otra sucursal
        } catch (e) {
          alert('No se pudo cambiar de sucursal. Probá de nuevo.');
          selector.value = usuario.sucursal_id;
          selector.disabled = false;
        }
      });

      contenedor.appendChild(selector);
    } catch (e) {
      // Si falla la carga, queda solo el nombre de la sucursal: el panel sigue funcionando.
    }
  }

  // Marca en el menú la página en la que se está (el CSS la resalta con la clase "activo").
  function marcarPaginaActual() {
    const paginaActual = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.barra-superior nav a').forEach(enlace => {
      if (enlace.getAttribute('href') === paginaActual) enlace.classList.add('activo');
    });
  }

  function iniciar() {
    mostrarBandaDePruebas();
    marcarPaginaActual();

    const usuario = leerUsuario();
    if (!usuario) return;

    // Colores por sucursal (ver estilos.css).
    document.documentElement.dataset.sucursal = String(usuario.sucursal_id || 1);

    const zonaUsuario = document.querySelector('.barra-superior > div:last-child');
    if (!zonaUsuario || document.getElementById('indicador-sucursal')) return;

    const indicador = document.createElement('div');
    indicador.id = 'indicador-sucursal';

    const nombre = document.createElement('span');
    nombre.className = 'badge-sucursal';
    nombre.textContent = usuario.sucursal_nombre || ('Sucursal ' + (usuario.sucursal_id || 1));
    indicador.appendChild(nombre);

    zonaUsuario.prepend(indicador);

    if (usuario.rol === 'admin') cargarSelector(indicador, usuario);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();