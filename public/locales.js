// Sección "Nuestros locales" de la landing: dirección y botones de cada sucursal activa, SIN precios.
// Los precios de cada local solo se ven al entrar a su menú (pedir.html?sucursal=ID), así el cliente
// ve únicamente el del local que eligió. Se arma con /sucursales/publico, por eso un local nuevo aparece
// solo cuando se da de alta y desaparece si se desactiva. Con un solo local activo la sección no se muestra.
(function () {
  const seccion = document.getElementById('locales');
  const grilla = document.getElementById('locales-grid');
  if (!seccion || !grilla) return;

  // Solo dígitos y con largo de teléfono con código de país; si no, ese local queda sin botón de WhatsApp.
  function limpiarTelefono(numero) {
    const digitos = String(numero || '').replace(/\D/g, '');
    return digitos.length >= 11 && digitos.length <= 15 ? digitos : null;
  }

  function enlace(clase, texto, href, externo) {
    const a = document.createElement('a');
    a.className = `btn-local ${clase}`;
    a.textContent = texto;
    a.href = href;
    if (externo) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }

  fetch(`${window.location.origin}/sucursales/publico`)
    .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(locales => {
      if (!Array.isArray(locales) || locales.length < 2) return;

      locales.forEach(s => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'local-card';

        const nombre = document.createElement('h3');
        nombre.textContent = s.nombre;
        tarjeta.appendChild(nombre);

        if (s.direccion) {
          const direccion = document.createElement('p');
          direccion.className = 'local-direccion';
          direccion.textContent = s.direccion;
          tarjeta.appendChild(direccion);
        }

        const acciones = document.createElement('div');
        acciones.className = 'local-acciones';
        acciones.appendChild(enlace('primario', 'Armá tu pedido', `pedir.html?sucursal=${encodeURIComponent(s.id)}`, false));
        const telefono = limpiarTelefono(s.whatsapp);
        if (telefono) {
          acciones.appendChild(enlace('secundario', 'Escribinos por WhatsApp', `https://wa.me/${telefono}?text=${encodeURIComponent('Hola! Quiero hacer un pedido')}`, true));
        }
        tarjeta.appendChild(acciones);

        grilla.appendChild(tarjeta);
      });

      seccion.classList.remove('oculto');
    })
    .catch(() => { /* sin la sección, la landing sigue funcionando igual */ });
})();
