const test = require('node:test');
const assert = require('node:assert/strict');
const { optimizarImagenCloudinary, ANCHO_POR_DEFECTO } = require('../src/utils/imagenes.js');

const ORIGINAL = 'https://res.cloudinary.com/it6n579z/image/upload/v1788490158/donchichopizza/productos/producto-2.jpg';

test('imágenes: una foto de Cloudinary se pide con formato y calidad automáticos y ancho máximo', () => {
  assert.equal(
    optimizarImagenCloudinary(ORIGINAL),
    'https://res.cloudinary.com/it6n579z/image/upload/f_auto,q_auto,c_limit,w_900/v1788490158/donchichopizza/productos/producto-2.jpg'
  );
  assert.equal(ANCHO_POR_DEFECTO, 900);
});

test('imágenes: se puede elegir otro ancho y uno inválido vuelve al de por defecto', () => {
  assert.ok(optimizarImagenCloudinary(ORIGINAL, 600).includes('/upload/f_auto,q_auto,c_limit,w_600/v1788490158/'));
  for (const invalido of [0, -5, 1.5, 99999, '600', NaN, null]) {
    assert.ok(optimizarImagenCloudinary(ORIGINAL, invalido).includes('w_900/'), 'ancho ' + invalido);
  }
});

test('imágenes: una foto que ya tiene transformación no se vuelve a transformar', () => {
  const yaTransformada = 'https://res.cloudinary.com/it6n579z/image/upload/f_auto,q_auto,c_limit,w_400/v1/donchichopizza/productos/producto-2.jpg';
  assert.equal(optimizarImagenCloudinary(yaTransformada), yaTransformada);
  const conAncho = 'https://res.cloudinary.com/it6n579z/image/upload/w_300/v1/x/y.jpg';
  assert.equal(optimizarImagenCloudinary(conAncho), conAncho);
});

test('imágenes: una foto sin versión en la dirección también se optimiza', () => {
  assert.equal(
    optimizarImagenCloudinary('https://res.cloudinary.com/it6n579z/image/upload/donchichopizza/productos/producto-2.jpg'),
    'https://res.cloudinary.com/it6n579z/image/upload/f_auto,q_auto,c_limit,w_900/donchichopizza/productos/producto-2.jpg'
  );
});

test('imágenes: lo que no es una foto de Cloudinary vuelve igual', () => {
  const otras = [
    'img/fachada.jpg',
    'https://www.donchichopizza.com.ar/img/fachada.jpg',
    'http://res.cloudinary.com/it6n579z/image/upload/v1/x.jpg',
    'https://res.cloudinary.com/it6n579z/video/upload/v1/x.mp4',
    'https://ejemplo.com/res.cloudinary.com/it6n579z/image/upload/v1/x.jpg',
    '',
    null,
    undefined,
    42
  ];
  for (const valor of otras) assert.equal(optimizarImagenCloudinary(valor), valor);
});
