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