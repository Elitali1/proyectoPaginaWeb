document.getElementById('form-solicitar-reset').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const mensajeEl = document.getElementById('mensaje');
  mensajeEl.textContent = '';

  try {
    const resp = await fetch('/usuarios/solicitar-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await resp.json();
    mensajeEl.textContent = data.mensaje || data.error || 'Si existe una cuenta con ese email, recibirá un link.';
  } catch (err) {
    console.error(err);
    mensajeEl.textContent = 'Error al solicitar el reset. Intentá de nuevo más tarde.';
  }
});