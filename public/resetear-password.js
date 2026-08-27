function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

const token = getQueryParam('token');
const email = getQueryParam('email');
const mensajeEl = document.getElementById('mensaje');

if (!token || !email) {
  mensajeEl.textContent = 'Enlace inválido. Verificá el link que recibiste por email.';
}

document.getElementById('form-reset').addEventListener('submit', async (e) => {
  e.preventDefault();
  mensajeEl.textContent = '';

  const password = document.getElementById('password').value;
  const password2 = document.getElementById('password2').value;

  if (password !== password2) {
    mensajeEl.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  try {
    const resp = await fetch('/usuarios/confirmar-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, password }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      mensajeEl.textContent = data.error || 'Error al cambiar la contraseña.';
      return;
    }

    mensajeEl.textContent = data.mensaje || 'Contraseña cambiada correctamente.';
    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
  } catch (err) {
    console.error(err);
    mensajeEl.textContent = 'Error al cambiar la contraseña. Intentá de nuevo más tarde.';
  }
});