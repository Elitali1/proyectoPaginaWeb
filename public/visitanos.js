const API_URL = window.location.origin;

// ---- Mostrar "Abierto ahora" / "Cerrado" según el horario real (20:00 a 00:00, hora Argentina) ----
function mostrarEstadoHorario() {
  const elemento = document.getElementById('estado-horario');
  if (!elemento) return;

  const ahora = new Date();
  const horaArgentina = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const hora = horaArgentina.getHours();

  // Abierto de 20:00 a 23:59, y de 00:00 a la madrugada (hasta que decida cerrar el local)
  const abierto = hora >= 20 || hora < 2;

  if (abierto) {
    elemento.textContent = '🟢 Abierto ahora';
    elemento.className = 'estado-horario abierto';
  } else {
    elemento.textContent = '🔴 Cerrado - Abrimos a las 20:00hs';
    elemento.className = 'estado-horario cerrado';
  }
}

mostrarEstadoHorario();

// ---- Formulario de contacto ----
const formularioContacto = document.getElementById('formulario-contacto');

if (formularioContacto) {
  formularioContacto.addEventListener('submit', async (event) => {
    event.preventDefault();

    const boton = document.getElementById('btn-enviar-contacto');
    const estado = document.getElementById('mensaje-contacto-estado');

    boton.disabled = true;
    boton.textContent = 'Enviando...';
    estado.textContent = '';

    const datosContacto = {
      nombre: document.getElementById('contacto-nombre').value,
      email: document.getElementById('contacto-email').value,
      mensaje: document.getElementById('contacto-mensaje').value
    };

    try {
      const respuesta = await fetch(`${API_URL}/contacto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosContacto)
      });

      if (!respuesta.ok) {
        throw new Error('Error al enviar');
      }

      estado.textContent = '¡Mensaje enviado! Te vamos a responder a la brevedad.';
      formularioContacto.reset();
    } catch (error) {
      estado.textContent = 'No pudimos enviar el mensaje. Probá escribirnos por WhatsApp.';
    } finally {
      boton.disabled = false;
      boton.textContent = 'Enviar mensaje';
    }
  });
}