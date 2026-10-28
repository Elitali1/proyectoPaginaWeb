const { ErrorNegocio } = require('./errores.js');
const { esTexto, esEnteroPositivo } = require('./validaciones.js');

// Valida y limpia los datos de una categoría. Lanza ErrorNegocio si algo no cierra.
// requiere_masa dice si los productos de la categoría llevan masa (piedra / molde): lo usa el menú online
// para ofrecer esa elección y la de mitad y mitad. Si no llega, vale false.
function validarDatosCategoria(body) {
  const { nombre, requiere_masa } = body || {};

  if (!esTexto(nombre, { max: 100 })) throw new ErrorNegocio('El nombre de la categoría es obligatorio (hasta 100 caracteres)');
  if (requiere_masa !== undefined && typeof requiere_masa !== 'boolean') throw new ErrorNegocio('El campo requiere_masa debe ser verdadero o falso');

  return {
    // Espacios de más (dobles, al borde) fuera: "  Mini   pizzas " y "Mini pizzas" son la misma categoría.
    nombre: nombre.replace(/\s+/g, ' ').trim(),
    requiere_masa: requiere_masa === true
  };
}

// El id llega por la URL (texto): se exige entero positivo antes de ir a la base.
function leerIdCategoria(valor) {
  if (!esEnteroPositivo(valor)) throw new ErrorNegocio('Categoría inválida');
  return Number(valor);
}

module.exports = { validarDatosCategoria, leerIdCategoria };
