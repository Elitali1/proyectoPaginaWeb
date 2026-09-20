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