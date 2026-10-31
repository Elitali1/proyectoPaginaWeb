const { ErrorNegocio } = require('./errores.js');
const { esTexto, esNumero, esFechaISO, textoOpcional } = require('./validaciones.js');

// Reglas de los gastos: tipo (fijo / variable) y categorías conocidas.
// Son funciones puras (no tocan la base), así se pueden probar sin servidor.

const TIPOS = ['fijo', 'variable'];

// Categorías sugeridas. "tipo" es el que se propone por defecto (se puede cambiar al cargar el gasto).
//  - Fijo: no cambia con lo que se vende (se paga aunque se venda poco).
//  - Variable: sube y baja con las ventas. La materia prima va acá; las compras de insumos que se cargan
//    en "Compras" ya cuentan solas como materia prima en el estado de resultados.
// "alias" son los nombres que se usaban antes: se siguen reconociendo y pasan a la categoría nueva.
const CATEGORIAS = [
  { nombre: 'Sueldos', tipo: 'fijo' },
  { nombre: 'Servicios', tipo: 'fijo', alias: ['Luz', 'Agua', 'Gas', 'Internet'] },
  { nombre: 'Alquiler', tipo: 'fijo' },
  { nombre: 'Monotributo', tipo: 'fijo' },
  { nombre: 'Seguros', tipo: 'fijo' },
  { nombre: 'Impuestos y permisos', tipo: 'fijo', alias: ['Impuestos', 'Tasas municipales', 'Permisos'] },
  { nombre: 'Materia prima', tipo: 'variable', alias: ['Mercadería'] },
  { nombre: 'Insumos de papelería generales', tipo: 'variable', alias: ['Papelería', 'Packaging y descartables'] },
  { nombre: 'Otros', tipo: null }
];

// Compara sin importar mayúsculas, tildes ni espacios de más ("mercaderia" == "Mercadería ").
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// Busca por el nombre actual o por alguno de los nombres viejos (alias).
function buscarCategoria(nombre) {
  const buscado = normalizar(nombre);
  if (!buscado) return undefined;
  return CATEGORIAS.find(c => normalizar(c.nombre) === buscado || (c.alias || []).some(a => normalizar(a) === buscado));
}

// Valida el tipo y la categoría. Si no se indica el tipo, se toma el de la categoría conocida;
// si tampoco se puede deducir, se pide que lo elija (un gasto sin clasificar falsea el resultado).
function resolverTipoYCategoria(tipo, categoria) {
  const conocida = buscarCategoria(categoria);
  const categoriaFinal = conocida ? conocida.nombre : categoria;

  let tipoFinal = tipo;
  if (tipoFinal === undefined || tipoFinal === null || tipoFinal === '') {
    tipoFinal = conocida ? conocida.tipo : null;
  }
  if (!TIPOS.includes(tipoFinal)) {
    throw new ErrorNegocio('Indicá si el gasto es fijo o variable');
  }
  return { tipo: tipoFinal, categoria: categoriaFinal };
}

function limpiarCategoria(categoria) {
  const texto = textoOpcional(categoria, 100);
  return texto === undefined || texto === '' ? null : texto;
}

function validarMonto(monto) {
  if (!esNumero(monto) || Number(monto) <= 0) throw new ErrorNegocio('El monto debe ser un número mayor a cero');
  return Number(monto);
}

// Gasto nuevo desde el panel.
function validarGasto(body) {
  const { concepto, categoria, monto, fecha, tipo } = body || {};

  if (!esTexto(concepto, { max: 200 })) throw new ErrorNegocio('El concepto es obligatorio');
  const montoLimpio = validarMonto(monto);
  if (!esFechaISO(fecha)) throw new ErrorNegocio('La fecha es obligatoria (AAAA-MM-DD)');

  const clasificado = resolverTipoYCategoria(tipo, limpiarCategoria(categoria));
  return { concepto: concepto.trim(), categoria: clasificado.categoria, tipo: clasificado.tipo, monto: montoLimpio, fecha };
}

// Para marcar un gasto que estaba sin clasificar (o corregir uno mal marcado).
function validarClasificacion(body) {
  const { tipo, categoria } = body || {};
  if (!TIPOS.includes(tipo)) throw new ErrorNegocio('Indicá si el gasto es fijo o variable');
  const clasificado = resolverTipoYCategoria(tipo, limpiarCategoria(categoria));
  return { tipo: clasificado.tipo, categoria: clasificado.categoria };
}

// Gasto recurrente (plantilla que se carga cada mes).
function validarRecurrente(body) {
  const { concepto, categoria, monto, tipo } = body || {};

  if (!esTexto(concepto, { max: 200 })) throw new ErrorNegocio('El concepto es obligatorio');
  const montoLimpio = validarMonto(monto);
  const clasificado = resolverTipoYCategoria(tipo, limpiarCategoria(categoria));
  return { concepto: concepto.trim(), categoria: clasificado.categoria, tipo: clasificado.tipo, monto: montoLimpio };
}

// Suma los gastos de un período según cómo cuentan en el estado de resultados:
//  - fijos y variables restan donde corresponde (la materia prima es variable);
//  - sin clasificar: se informan aparte (no se sabe si son fijos o variables).
function clasificarGastos(filas) {
  const total = { fijos: 0, variables: 0, sinClasificar: 0 };
  for (const gasto of filas) {
    const monto = Number(gasto.monto);
    if (gasto.tipo === 'fijo') total.fijos += monto;
    else if (gasto.tipo === 'variable') total.variables += monto;
    else total.sinClasificar += monto;
  }
  return total;
}

module.exports = { TIPOS, CATEGORIAS, buscarCategoria, validarGasto, validarClasificacion, validarRecurrente, clasificarGastos };
