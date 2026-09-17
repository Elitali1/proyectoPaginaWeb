const API_URL = window.location.origin;

// ---- Mostrar "Abierto ahora" / "Cerrado" según el horario real (20:00 a 00:00, hora Argentina) ----
function mostrarEstadoHorario() {
  const elemento = document.getElementById('estado-horario');
  if (!elemento) return;

  const ahora = new Date();
  const horaArgentina = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const hora = horaArgentina.getHours();
  const diaSemana = horaArgentina.getDay(); // 0 = domingo, 5 = viernes, 6 = sábado

  // Abierto: viernes/sábado/domingo de 20 a 23:59, y de 00 a 02 (la madrugada sigue siendo "el mismo turno" del día anterior)
  const esDiaDeApertura = diaSemana === 5 || diaSemana === 6 || diaSemana === 0;
  const esMadrugadaDeApertura = hora < 2 && (diaSemana === 6 || diaSemana === 0 || diaSemana === 1);
  // (la madrugada del sábado es "viernes a la noche", la del domingo es "sábado a la noche", la del lunes es "domingo a la noche")

  const abierto = (esDiaDeApertura && hora >= 20) || esMadrugadaDeApertura;

  if (abierto) {
    elemento.textContent = '🟢 Abierto ahora';
    elemento.className = 'estado-horario abierto';
  } else {
    elemento.textContent = '🔴 Cerrado - Abrimos viernes, sábado y domingo a las 20:00hs';
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