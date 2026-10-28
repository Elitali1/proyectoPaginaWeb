const { ErrorNegocio } = require('./errores.js');
const { esTexto, esEnteroPositivo } = require('./validaciones.js');

// Valida y limpia los datos de una categoría. Lanza ErrorNegocio si algo no cierra.
// es_extra marca la categoría de los agregados (Extra muzzarella, Extra jamón...): el menú online los ofrece
// dentro de cada pizza en vez de como productos sueltos.
// requiere_masa dice si los productos de la categoría llevan masa (piedra / molde): lo usa el menú online
// para ofrecer esa elección y la de mitad y mitad. Si no llega, vale false.
function validarDatosCategoria(body) {
  const { nombre, requiere_masa, es_extra } = body || {};

  if (!esTexto(nombre, { max: 100 })) throw new ErrorNegocio('El nombre de la categoría es obligatorio (hasta 100 caracteres)');
  if (requiere_masa !== undefined && typeof requiere_masa !== 'boolean') throw new ErrorNegocio('El campo requiere_masa debe ser verdadero o falso');

  if (es_extra !== undefined && typeof es_extra !== 'boolean') throw new ErrorNegocio('El campo es_extra debe ser verdadero o falso');
  // Los extras se ofrecen como tildes dentro de las pizzas: no tiene sentido que además pidan masa.
  if (requiere_masa === true && es_extra === true) throw new ErrorNegocio('Una categoría de extras no puede llevar masa');

  return {
    // Espacios de más (dobles, al borde) fuera: "  Mini   pizzas " y "Mini pizzas" son la misma categoría.
    nombre: nombre.replace(/\s+/g, ' ').trim(),
    requiere_masa: requiere_masa === true,
    es_extra: es_extra === true
  };
}

// El id llega por la URL (texto): se exige entero positivo antes de ir a la base.
function leerIdCategoria(valor) {
  if (!esEnteroPositivo(valor)) throw new ErrorNegocio('Categoría inválida');
  return Number(valor);
}

module.exports = { validarDatosCategoria, leerIdCategoria };
