// Optimización de las fotos de productos que se muestran en el menú público.

// Ancho máximo (en píxeles) con el que se entrega cada foto. Alcanza para el recuadro del menú
// (unos 640 px de ancho) y para verse bien en pantallas de alta densidad.
const ANCHO_POR_DEFECTO = 900;
const ANCHO_MAXIMO = 4000;

// Solo se tocan las direcciones de imágenes de Cloudinary: https://res.cloudinary.com/<cuenta>/image/upload/...
const DIRECCION_CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

// Una transformación es el primer tramo después de /upload/ cuando tiene la forma "w_400" o
// "f_auto,q_auto" (letras, guion bajo, valor). Un tramo de versión ("v1788490158") o una
// carpeta ("donchichopizza") NO es una transformación.
const TRAMO_TRANSFORMACION = /^[a-z]{1,4}_[^,/]+(,[a-z]{1,4}_[^,/]+)*$/i;

// Devuelve la misma foto de Cloudinary pidiendo formato moderno automático (f_auto), calidad
// automática (q_auto) y un ancho máximo (c_limit nunca agranda una foto chica).
// Cualquier otro valor (sin foto, otra dirección, ya transformada) se devuelve tal cual.
function optimizarImagenCloudinary(direccion, ancho = ANCHO_POR_DEFECTO) {
  if (typeof direccion !== 'string') return direccion;
  const partes = DIRECCION_CLOUDINARY.exec(direccion);
  if (!partes) return direccion;

  const [, base, resto] = partes;
  if (TRAMO_TRANSFORMACION.test(resto.split('/')[0])) return direccion;

  const anchoValido = Number.isInteger(ancho) && ancho > 0 && ancho <= ANCHO_MAXIMO ? ancho : ANCHO_POR_DEFECTO;
  return `${base}f_auto,q_auto,c_limit,w_${anchoValido}/${resto}`;
}

module.exports = { optimizarImagenCloudinary, ANCHO_POR_DEFECTO };
