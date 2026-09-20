const { ErrorNegocio } = require('./errores.js');

function esTexto(valor, { min = 1, max = 255 } = {}) {
  return typeof valor === 'string' && valor.trim().length >= min && valor.trim().length <= max;
}

// Devuelve el texto recortado, o null si viene vacío/undefined.
function textoOpcional(valor, max = 500) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  if (texto === '') return null;
  if (texto.length > max) throw new ErrorNegocio(`Texto demasiado largo (máximo ${max} caracteres)`);
  return texto;
}

function esNumero(valor) {
  if (valor === null || valor === undefined || valor === '' || typeof valor === 'boolean') return false;
  return Number.isFinite(Number(valor));
}

function esEnteroPositivo(valor) {
  if (!esNumero(valor)) return false;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0;
}

function esFechaISO(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function esEmail(valor) {
  return typeof valor === 'string' && valor.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor);
}

// Solo permite URLs http(s) (evita esquemas como javascript:).
function esUrlHttp(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch (error) {
    return false;
  }
}

// Deja solo los dígitos: "20-38620212-6" -> "20386202126". Devuelve null si viene vacío.
function normalizarCuit(valor) {
  if (valor === undefined || valor === null) return null;
  const digitos = String(valor).replace(/\D/g, '');
  return digitos === '' ? null : digitos;
}

// Valida largo (11 dígitos) y dígito verificador.
function esCuitValido(cuit) {
  if (typeof cuit !== 'string' || !/^\d{11}$/.test(cuit)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, peso, i) => acc + peso * Number(cuit[i]), 0);
  let digito = 11 - (suma % 11);
  if (digito === 11) digito = 0;
  if (digito === 10) return false;
  return digito === Number(cuit[10]);
}

// Redondea a 2 decimales para comparar importes sin errores de punto flotante.
function redondear2(numero) {
  return Math.round((Number(numero) + Number.EPSILON) * 100) / 100;
}

// Escapa texto para insertarlo en HTML (mails).
function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  esTexto, textoOpcional, esNumero, esEnteroPositivo, esFechaISO, esEmail, esUrlHttp,
  normalizarCuit, esCuitValido, redondear2, escaparHtml
};
