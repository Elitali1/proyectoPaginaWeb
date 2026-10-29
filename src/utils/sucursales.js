const { ErrorNegocio } = require('./errores.js');

// Validaciones de lo que llega desde el panel para sucursales y para "dónde se vende" un producto.
// Son funciones puras (no tocan la base), así se pueden probar sin servidor.

const PTO_VTA_MAXIMO = 99999;
const FACTOR_MAXIMO = 10;

// Número de WhatsApp del local. Se guardan solo los dígitos, con código de país (Argentina celular: 549 +
// código de área + número, ej. 5491165838528), que es lo que pide el link wa.me.
//  - no viene (undefined)  -> undefined: se conserva el que tenía;
//  - vacío                 -> null: se borra;
//  - con contenido         -> solo dígitos, entre 11 y 15 (se aceptan espacios, guiones y el + del principio).
function validarWhatsapp(valor) {
  if (valor === undefined) return undefined;
  if (valor === null || String(valor).trim() === '') return null;
  if (typeof valor !== 'string' && typeof valor !== 'number') throw new ErrorNegocio('El WhatsApp no es válido');

  const texto = String(valor).trim();
  if (!/^\+?[\d\s-]+$/.test(texto)) {
    throw new ErrorNegocio('El WhatsApp solo puede tener números (ej. 5491165838528)');
  }
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length < 11 || digitos.length > 15) {
    throw new ErrorNegocio('El WhatsApp tiene que incluir el código de país y de área, entre 11 y 15 dígitos (ej. 5491165838528)');
  }
  return digitos;
}

// Link de Google Maps del local. Se muestra como enlace en la página pública, por eso solo se aceptan
// links https de los dominios de Google Maps (así no se puede guardar un "javascript:" ni un sitio ajeno).
//  - no viene (undefined)  -> undefined: se conserva el que tenía;
//  - vacío                 -> null: se borra;
//  - con contenido         -> el link, sin espacios, si es de Google Maps.
const DOMINIOS_MAPA = ['maps.app.goo.gl', 'goo.gl', 'g.page', 'maps.google.com', 'google.com', 'www.google.com'];

function validarLinkMapa(valor) {
  if (valor === undefined) return undefined;
  if (valor === null || String(valor).trim() === '') return null;
  if (typeof valor !== 'string') throw new ErrorNegocio('El link del mapa no es válido');

  const texto = valor.trim();
  if (texto.length > 500) throw new ErrorNegocio('El link del mapa es demasiado largo (máximo 500 caracteres)');

  let url;
  try {
    url = new URL(texto);
  } catch (e) {
    throw new ErrorNegocio('El link del mapa no es válido: pegá el link completo que da Google Maps en "Compartir"');
  }
  if (url.protocol !== 'https:' || !DOMINIOS_MAPA.includes(url.hostname)) {
    throw new ErrorNegocio('El link del mapa tiene que ser de Google Maps (empieza con https://maps.app.goo.gl o https://www.google.com/maps)');
  }
  return texto;
}

// Sucursal pedida en una consulta pública (?sucursal=2). Sin valor, devuelve null (se usa la sucursal por defecto).
function leerSucursalDeConsulta(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('La sucursal no es válida');
  return id;
}

// Datos de una sucursal: nombre (obligatorio), dirección y punto de venta (opcionales), activa.
function validarDatosSucursal(body) {
  const { nombre, direccion, pto_vta, activa, cuenta_transferencia, whatsapp, link_mapa } = body || {};

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

  // Cuenta donde la sucursal cobra las transferencias (Mercado Pago, un banco...). Es solo un nombre para
  // mostrar y controlar. Si no viene, queda la que ya tenía (o 'MercadoPago' al crear).
  let cuentaTransferencia;
  if (cuenta_transferencia !== undefined && cuenta_transferencia !== null && String(cuenta_transferencia).trim() !== '') {
    if (typeof cuenta_transferencia !== 'string') throw new ErrorNegocio('La cuenta de cobro no es válida');
    if (cuenta_transferencia.trim().length > 100) throw new ErrorNegocio('El nombre de la cuenta de cobro es demasiado largo (máximo 100 caracteres)');
    cuentaTransferencia = cuenta_transferencia.trim();
  }

  return {
    nombre: nombre.trim(),
    direccion: direccionLimpia,
    pto_vta: ptoVta,
    activa,
    cuenta_transferencia: cuentaTransferencia,
    whatsapp: validarWhatsapp(whatsapp),
    link_mapa: validarLinkMapa(link_mapa)
  };
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

module.exports = {
  validarWhatsapp, validarLinkMapa,
  leerSucursalDeConsulta, validarDatosSucursal, validarOpcionesDeCopia, validarSucursalesDeProducto };
