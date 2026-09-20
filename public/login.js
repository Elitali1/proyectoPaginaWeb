const API_URL = window.location.origin;

document.getElementById('formulario-login').addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const mensajeError = document.getElementById('mensaje-error');

  try {
    const respuesta = await fetch(`${API_URL}/usuarios/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    if (!respuesta.ok) {
      mensajeError.textContent = 'Email o contraseña incorrectos';
      mensajeError.classList.remove('oculto');
      return;
    }

    const datos = await respuesta.json();

    // El token ya viaja en una cookie httpOnly segura, no hace falta guardarlo acá.
    // Solo guardamos los datos del usuario (nombre, rol) para mostrarlos en pantalla.
    localStorage.setItem('usuario', JSON.stringify(datos.usuario));

    window.location.href = 'pedidos.html';
  } catch (error) {
    mensajeError.textContent = 'Error al conectar con el servidor';
    mensajeError.classList.remove('oculto');
  }
});