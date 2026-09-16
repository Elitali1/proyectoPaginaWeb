document.addEventListener('DOMContentLoaded', () => {
  const elementos = document.querySelectorAll('.animar-al-scroll');

  if (!('IntersectionObserver' in window) || elementos.length === 0) {
    // Si el navegador es muy viejo, o no hay nada que animar, mostramos todo directo
    elementos.forEach(el => el.classList.add('visible'));
    return;
  }

  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach(entrada => {
      if (entrada.isIntersecting) {
        entrada.target.classList.add('visible');
        observador.unobserve(entrada.target);
      }
    });
  }, {
    threshold: 0.15
  });

  elementos.forEach(el => observador.observe(el));
});