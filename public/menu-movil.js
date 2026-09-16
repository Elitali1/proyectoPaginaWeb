document.addEventListener('DOMContentLoaded', () => {
  const boton = document.getElementById('btn-menu-movil');
  const menu = document.getElementById('menu-movil');

  if (!boton || !menu) return;

  boton.addEventListener('click', () => {
    const abierto = menu.classList.toggle('abierto');
    boton.classList.toggle('activo', abierto);
    boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  });

  // Si tocás un link del menú, se cierra solo (mejor experiencia en mobile)
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.remove('abierto');
      boton.classList.remove('activo');
      boton.setAttribute('aria-expanded', 'false');
    });
  });
});