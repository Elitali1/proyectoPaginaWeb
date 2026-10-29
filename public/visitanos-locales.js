// Página "Visitanos": una tarjeta por cada local activo (nombre, dirección, cómo llegar, pedir y WhatsApp).
// Sale de /sucursales/publico, así que un local nuevo aparece solo cuando se da de alta y desaparece si se
// desactiva. No hay precios acá. "Cómo llegar" se arma con la dirección cargada en Sucursales, para no
// guardar un link de Maps por local.
(function () {
  const contenedor = document.getElementById('visitanos-locales');
  if (!contenedor) return; // otra página

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

  function mensaje(texto, clase) {
    contenedor.textContent = '';
    const p = document.createElement('p');
    p.className = clase;
    p.textContent = texto;
    contenedor.appendChild(p);
  }

  fetch(`${window.location.origin}/sucursales/publico`)
    .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(locales => {
      if (!Array.isArray(locales) || locales.length === 0) {
        mensaje('Por ahora no hay locales para mostrar. Escribinos por WhatsApp.', 'menu-loading');
        return;
      }

      contenedor.textContent = '';
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
        if (s.direccion) {
          const consulta = encodeURIComponent(`${s.direccion}, Buenos Aires, Argentina`);
          acciones.appendChild(enlace('primario', 'Cómo llegar', `https://www.google.com/maps/search/?api=1&query=${consulta}`, true));
        }
        acciones.appendChild(enlace('secundario', 'Armá tu pedido', `pedir.html?sucursal=${encodeURIComponent(s.id)}`, false));
        const telefono = limpiarTelefono(s.whatsapp);
        if (telefono) {
          acciones.appendChild(enlace('secundario', 'WhatsApp', `https://wa.me/${telefono}?text=${encodeURIComponent('Hola! Quiero hacer un pedido')}`, true));
        }
        tarjeta.appendChild(acciones);

        contenedor.appendChild(tarjeta);
      });
    })
    .catch(() => mensaje('No pudimos cargar los locales. Probá de nuevo en un rato o escribinos por WhatsApp.', 'menu-error'));
})();
