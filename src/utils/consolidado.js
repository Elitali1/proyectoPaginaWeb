// Arma la vista consolidada a partir de los números ya calculados de cada sucursal.
// Es una función pura (no toca la base): por eso se puede testear sin conexión.
//
// Cada item de entrada:
// { sucursal: {id, nombre, activa, cuenta_transferencia},
//   resumen: {cantidadPedidos, ventasTotales, topProductos},
//   pagos: {efectivo, transferencia},
//   compras,                      // total de facturas de compra del período (materia prima)
//   gastos: {fijos, variables, sinClasificar},   // ver clasificarGastos
//   iva: {condicion, alicuota} }

const { armarEstadoResultados, sumarEntradas } = require('./estadoResultados.js');

function redondear(n) {
  return Math.round(Number(n) * 100) / 100;
}

const totalGastos = g => g.fijos + g.variables + g.sinClasificar;

function armarConsolidado(items) {
  // Una sucursal inactiva sin ningún movimiento en el período no aporta nada: se oculta.
  const visibles = items.filter(i =>
    i.sucursal.activa || i.resumen.cantidadPedidos > 0 || i.compras > 0 || totalGastos(i.gastos) > 0
  );

  const entradas = visibles.map(i => ({
    ventas: Number(i.resumen.ventasTotales),
    compras: Number(i.compras),
    gastos: i.gastos,
    iva: i.iva
  }));

  const porSucursal = visibles.map((i, indice) => {
    const ventas = Number(i.resumen.ventasTotales);
    const pedidos = Number(i.resumen.cantidadPedidos);
    return {
      sucursalId: i.sucursal.id,
      nombre: i.sucursal.nombre,
      activa: i.sucursal.activa,
      cuentaTransferencia: i.sucursal.cuenta_transferencia || 'MercadoPago',
      pedidos,
      ventas: redondear(ventas),
      ticketPromedio: pedidos > 0 ? redondear(ventas / pedidos) : 0,
      efectivo: redondear(i.pagos.efectivo),
      transferencia: redondear(i.pagos.transferencia),
      estado: armarEstadoResultados(entradas[indice])
    };
  });

  const suma = campo => redondear(porSucursal.reduce((acc, s) => acc + s[campo], 0));
  const ventas = suma('ventas');
  const pedidos = suma('pedidos');

  // Participación de cada local en las ventas totales (para la barra del panel).
  porSucursal.forEach(s => {
    s.participacionPorcentual = ventas > 0 ? redondear((s.ventas / ventas) * 100) : 0;
  });

  // Productos más vendidos entre todos los locales: se suman por categoría + nombre.
  const acumulado = new Map();
  visibles.forEach(i => {
    (i.resumen.topProductos || []).forEach(p => {
      const clave = `${p.categoria_nombre || ''}|${p.producto_nombre}`;
      const previo = acumulado.get(clave);
      const cantidad = Number(p.cantidad_vendida);
      if (previo) previo.cantidad_vendida += cantidad;
      else acumulado.set(clave, { categoria_nombre: p.categoria_nombre, producto_nombre: p.producto_nombre, cantidad_vendida: cantidad });
    });
  });
  const topProductos = [...acumulado.values()].sort((a, b) => b.cantidad_vendida - a.cantidad_vendida).slice(0, 10);

  return {
    porSucursal,
    total: {
      pedidos,
      ventas,
      ticketPromedio: pedidos > 0 ? redondear(ventas / pedidos) : 0,
      efectivo: suma('efectivo'),
      transferencia: suma('transferencia'),
      // El estado de resultados total se arma sumando las entradas (no sumando porcentajes).
      estado: armarEstadoResultados(sumarEntradas(entradas))
    },
    topProductos
  };
}

module.exports = { armarConsolidado };
