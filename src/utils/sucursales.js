const { ErrorNegocio } = require('./errores.js');

// Validaciones de lo que llega desde el panel para sucursales y para "dónde se vende" un producto.
// Son funciones puras (no tocan la base), así se pueden probar sin servidor.

const PTO_VTA_MAXIMO = 99999;
const FACTOR_MAXIMO = 10;

// Datos de una sucursal: nombre (obligatorio), dirección y punto de venta (opcionales), activa.
function validarDatosSucursal(body) {
  const { nombre, direccion, pto_vta, activa } = body || {};

  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new ErrorNegocio('El nombre de la sucursal es obligatorio');
  }
  if (nombre.trim().length > 100) {
    throw new ErrorNegocio('El nombre de la sucursal es demasiado largo (máximo 100 caracteres)');
  }

  let direccionLimpia = null;
  if (direccion !== undefined && direccion !== null && String(direccion).trim() !== '') {
    if (typeof direccion !== 'string') throw new ErrorNegocio('La dirección no es válida');
    if (direccion.trim().length > 200) throw new ErrorNegocio('La dirección es demasiado larga (máximo 200 caracteres)');
    direccionLimpia = direccion.trim();
  }

  // El punto de venta es el número de ARCA con el que factura la sucursal. Sin él no puede emitir.
  let ptoVta = null;
  if (pto_vta !== undefined && pto_vta !== null && String(pto_vta).trim() !== '') {
    const numero = Number(pto_vta);
    if (!Number.isInteger(numero) || numero < 1 || numero > PTO_VTA_MAXIMO) {
      throw new ErrorNegocio(`El punto de venta tiene que ser un número entero entre 1 y ${PTO_VTA_MAXIMO}`);
    }
    ptoVta = numero;
  }

  if (activa !== undefined && typeof activa !== 'boolean') {
    throw new ErrorNegocio('El campo activa debe ser verdadero o falso');
  }

  return { nombre: nombre.trim(), direccion: direccionLimpia, pto_vta: ptoVta, activa };
}

// Opciones al crear una sucursal: de qué sucursal copiar productos e insumos, y con qué factor de precios.
function validarOpcionesDeCopia(body) {
  const { copiar_de, factor } = body || {};

  let copiarDe = null;
  if (copiar_de !== undefined && copiar_de !== null && String(copiar_de).trim() !== '') {
    const id = Number(copiar_de);
    if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('La sucursal de la que se copia no es válida');
    copiarDe = id;
  }

  let factorPrecios = 1;
  if (factor !== undefined && factor !== null && String(factor).trim() !== '') {
    const numero = Number(factor);
    if (!Number.isFinite(numero) || numero <= 0 || numero > FACTOR_MAXIMO) {
      throw new ErrorNegocio(`El factor de precios tiene que ser mayor a 0 y hasta ${FACTOR_MAXIMO} (1 = mismos precios)`);
    }
    factorPrecios = numero;
  }

  return { copiarDe, factor: factorPrecios };
}

// Dónde se vende un producto: lista de { sucursal_id, precio }. Tiene que haber al menos una.
function validarSucursalesDeProducto(body) {
  const lista = body && body.sucursales;
  if (!Array.isArray(lista) || lista.length === 0) {
    throw new ErrorNegocio('El producto tiene que venderse en al menos una sucursal');
  }

  const vistas = new Set();
  return lista.map((item) => {
    const id = Number(item && item.sucursal_id);
    if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('Sucursal inválida');
    if (vistas.has(id)) throw new ErrorNegocio('Hay una sucursal repetida en la lista');
    vistas.add(id);

    const crudo = item.precio;
    const precio = Number(crudo);
    if (crudo === null || crudo === undefined || String(crudo).trim() === '' || !Number.isFinite(precio) || precio < 0) {
      throw new ErrorNegocio('El precio de cada sucursal tiene que ser un número mayor o igual a cero');
    }
    return { sucursal_id: id, precio };
  });
}

module.exports = { validarDatosSucursal, validarOpcionesDeCopia, validarSucursalesDeProducto };