const { ErrorNegocio } = require('./errores.js');
const { esTexto, esNumero, esFechaISO, textoOpcional } = require('./validaciones.js');

// Reglas de los gastos: tipo (fijo / variable), categorías conocidas y qué cuenta como costo directo.
// Son funciones puras (no tocan la base), así se pueden probar sin servidor.

const TIPOS = ['fijo', 'variable'];

// Categorías sugeridas. "tipo" es el que se propone por defecto (se puede cambiar al cargar el gasto).
//  - Fijo: no cambia con lo que se vende. Los servicios (luz, gas) varían un poco con el uso, pero
//    para costos se tratan como fijos porque hay que pagarlos aunque se venda poco.
//  - Variable: sube y baja con las ventas.
//  - "directo": costo de mercadería. Va junto con las compras de insumos para calcular la ganancia bruta.
const CATEGORIAS = [
  { nombre: 'Sueldos', tipo: 'fijo' },
  { nombre: 'Alquiler', tipo: 'fijo' },
  { nombre: 'Luz', tipo: 'fijo' },
  { nombre: 'Agua', tipo: 'fijo' },
  { nombre: 'Gas', tipo: 'fijo' },
  { nombre: 'Internet', tipo: 'fijo' },
  { nombre: 'Tasas municipales', tipo: 'fijo' },
  { nombre: 'Impuestos', tipo: 'fijo' },
  { nombre: 'Contador', tipo: 'fijo' },
  { nombre: 'Marketing', tipo: 'fijo' },
  { nombre: 'Mercadería', tipo: 'variable', directo: true },
  { nombre: 'Packaging y descartables', tipo: 'variable' },
  { nombre: 'Comisiones', tipo: 'variable' },
  { nombre: 'Delivery', tipo: 'variable' },
  { nombre: 'Mantenimiento', tipo: 'variable' },
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

function buscarCategoria(nombre) {
  const buscado = normalizar(nombre);
  if (!buscado) return undefined;
  return CATEGORIAS.find(c => normalizar(c.nombre) === buscado);
}

function esCostoDirecto(categoria) {
  const encontrada = buscarCategoria(categoria);
  return Boolean(encontrada && encontrada.directo);
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

// Suma los gastos de un período según cómo cuentan en el estado de resultados.
//  - sin clasificar: se informan aparte (no se sabe si son fijos o variables);
//  - costo directo (Mercadería): resta en la ganancia bruta;
//  - fijos / variables: restan más abajo.
function clasificarGastos(filas) {
  const total = { fijos: 0, variables: 0, directos: 0, sinClasificar: 0 };
  for (const gasto of filas) {
    const monto = Number(gasto.monto);
    if (gasto.tipo === 'fijo' || gasto.tipo === 'variable') {
      if (esCostoDirecto(gasto.categoria)) total.directos += monto;
      else if (gasto.tipo === 'fijo') total.fijos += monto;
      else total.variables += monto;
    } else {
      total.sinClasificar += monto;
    }
  }
  return total;
}

module.exports = { TIPOS, CATEGORIAS, buscarCategoria, esCostoDirecto, validarGasto, validarClasificacion, validarRecurrente, clasificarGastos };
