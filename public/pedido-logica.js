// Lógica del armado de pedido del menú público: carrito, precios (incluida la mitad y mitad) y mensaje de
// WhatsApp. Son funciones puras (no tocan la página ni la red): por eso se prueban desde Node y se usan
// tal cual en el navegador (pedir.js las toma de window.PedidoLogica).
//
// Un ítem del carrito guarda solo REFERENCIAS, no precios:
//   { producto_id, producto_id_2?, extras?: [ids], cantidad, tipo_masa?, aclaraciones? }
// Los extras (agregados como "Extra jamón") son productos de una categoría marcada como extras; cada uno
// tiene su precio y se cobra por cada unidad de la línea (2 pizzas con extra jamón = 2 extras).
// Los precios y nombres se calculan siempre contra el menú actual, así un precio viejo guardado en el
// celular del cliente nunca llega al mensaje.
(function (raiz) {
  // Mismo recargo que usa el sistema de pedidos del local para combinar dos gustos (mitad y mitad).
  const RECARGO_MITAD_Y_MITAD = 1000;
  const CANTIDAD_MAXIMA = 50;

  const NOMBRES_MASA = { piedra: 'A la piedra', molde: 'Al molde' };

  function formatearPrecio(numero) {
    return Number(numero).toLocaleString('es-AR');
  }

  // Precio de UNA unidad: el del producto, o (mitad de uno + mitad del otro + recargo) si es mitad y mitad,
  // más el precio de cada extra elegido.
  function precioUnitario(producto, producto2, extras) {
    const base = !producto2
      ? Number(producto.precio)
      : Number(producto.precio) / 2 + Number(producto2.precio) / 2 + RECARGO_MITAD_Y_MITAD;
    return base + (extras || []).reduce((suma, extra) => suma + Number(extra.precio), 0);
  }

  // Ids de extras: enteros positivos, sin repetir y ordenados (así el mismo pedido da siempre la misma clave).
  function normalizarExtras(lista) {
    const ids = (Array.isArray(lista) ? lista : []).map(Number).filter(n => Number.isInteger(n) && n > 0);
    return [...new Set(ids)].sort((a, b) => a - b);
  }

  function limpiarTexto(texto, maximo) {
    if (texto === undefined || texto === null) return null;
    const limpio = String(texto).replace(/\s+/g, ' ').trim().slice(0, maximo);
    return limpio === '' ? null : limpio;
  }

  // Dos ítems iguales (mismo producto, masa y aclaración) se suman en una sola línea.
  function claveItem(item) {
    return [item.producto_id, item.producto_id_2 || '', item.tipo_masa || '', normalizarExtras(item.extras).join(','), (item.aclaraciones || '').toLowerCase()].join('|');
  }

  function agregarItem(items, nuevo) {
    const extras = normalizarExtras(nuevo.extras);
    const item = {
      producto_id: Number(nuevo.producto_id),
      producto_id_2: nuevo.producto_id_2 ? Number(nuevo.producto_id_2) : undefined,
      extras: extras.length ? extras : undefined,
      cantidad: Math.min(Math.max(Math.floor(Number(nuevo.cantidad) || 1), 1), CANTIDAD_MAXIMA),
      tipo_masa: nuevo.tipo_masa === 'piedra' || nuevo.tipo_masa === 'molde' ? nuevo.tipo_masa : undefined,
      aclaraciones: limpiarTexto(nuevo.aclaraciones, 120) || undefined
    };
    const clave = claveItem(item);
    const existente = items.find(i => claveItem(i) === clave);
    if (!existente) return [...items, item];
    return items.map(i => (i === existente ? { ...i, cantidad: Math.min(i.cantidad + item.cantidad, CANTIDAD_MAXIMA) } : i));
  }

  // Suma o resta cantidad a la línea con esa clave. Si llega a cero, la línea desaparece.
  function cambiarCantidad(items, clave, delta) {
    return items
      .map(i => (claveItem(i) === clave ? { ...i, cantidad: Math.min(i.cantidad + delta, CANTIDAD_MAXIMA) } : i))
      .filter(i => i.cantidad > 0);
  }

  // Cantidad total de un producto simple en el carrito (para el contador de la tarjeta).
  function cantidadDeProducto(items, productoId) {
    return items
      .filter(i => i.producto_id === Number(productoId) || i.producto_id_2 === Number(productoId))
      .reduce((suma, i) => suma + i.cantidad, 0);
  }

  // Contra el menú actual: saca lo que ya no se vende y devuelve los nombres quitados para avisar.
  function reconciliar(items, catalogoPorId) {
    const vigentes = [];
    const quitados = [];
    for (const item of items) {
      const p1 = catalogoPorId[item.producto_id];
      const p2 = item.producto_id_2 ? catalogoPorId[item.producto_id_2] : null;
      if (!p1 || (item.producto_id_2 && !p2)) {
        quitados.push(p1 ? p1.nombre : 'Un producto');
        continue;
      }
      // Un extra que ya no se vende se saca de la línea, pero la pizza se conserva.
      const extrasVigentes = normalizarExtras(item.extras).filter(id => catalogoPorId[id]);
      if (extrasVigentes.length !== normalizarExtras(item.extras).length) quitados.push('Un extra');
      vigentes.push(extrasVigentes.length === normalizarExtras(item.extras).length
        ? item
        : { ...item, extras: extrasVigentes.length ? extrasVigentes : undefined });
    }
    return { items: vigentes, quitados };
  }

  // Nombre, detalle y precios de una línea del carrito, calculados con el menú actual.
  function describirItem(item, catalogoPorId) {
    const p1 = catalogoPorId[item.producto_id];
    const p2 = item.producto_id_2 ? catalogoPorId[item.producto_id_2] : null;
    const nombre = p2 ? `Mitad ${p1.nombre} / Mitad ${p2.nombre}` : p1.nombre;
    const extras = normalizarExtras(item.extras).map(id => catalogoPorId[id]).filter(Boolean);
    const unitario = precioUnitario(p1, p2, extras);
    return {
      nombre,
      extras: extras.map(e => ({ nombre: e.nombre, cantidad: item.cantidad, subtotal: Number(e.precio) * item.cantidad })),
      masa: item.tipo_masa ? NOMBRES_MASA[item.tipo_masa] : null,
      aclaraciones: item.aclaraciones || null,
      cantidad: item.cantidad,
      precioUnitario: unitario,
      subtotal: unitario * item.cantidad
    };
  }

  function totalPedido(items, catalogoPorId) {
    return items.reduce((suma, item) => suma + describirItem(item, catalogoPorId).subtotal, 0);
  }

  function cantidadTotal(items) {
    return items.reduce((suma, item) => suma + item.cantidad, 0);
  }

  // Solo dígitos; null si no tiene pinta de número de teléfono con código de país.
  function limpiarTelefono(numero) {
    const digitos = String(numero || '').replace(/\D/g, '');
    return digitos.length >= 11 && digitos.length <= 15 ? digitos : null;
  }

  // El mismo formato "2 x Muzzarella - A la piedra (bien cocida)" que se ve en la pantalla de Pedidos del local,
  // para que quien lo recibe lo pase al sistema sin interpretar nada.
  function armarMensaje({ local, items, catalogoPorId, entrega, direccion, pago, nombre, aclaraciones }) {
    // Cada extra va en su propia línea, debajo de la pizza a la que pertenece, con su precio: así quien atiende
    // puede cargarlo en Pedidos como un producto más y el total del pedido cierra con lo que ve el cliente.
    const lineas = items.flatMap(item => {
      const d = describirItem(item, catalogoPorId);
      const masa = d.masa ? ` - ${d.masa}` : '';
      const nota = d.aclaraciones ? ` (${d.aclaraciones})` : '';
      const subtotalSinExtras = d.subtotal - d.extras.reduce((suma, e) => suma + e.subtotal, 0);
      return [
        `${d.cantidad} x ${d.nombre}${masa}${nota} - $${formatearPrecio(subtotalSinExtras)}`,
        ...d.extras.map(e => `   + ${e.cantidad} x ${e.nombre} - $${formatearPrecio(e.subtotal)}`)
      ];
    });

    const partes = [
      `Hola! Quiero hacer un pedido en ${local}.`,
      '',
      ...lineas,
      '',
      `Total: $${formatearPrecio(totalPedido(items, catalogoPorId))}${entrega === 'envio' ? ' (sin el envío)' : ''}`,
      entrega === 'envio' ? `Entrega: envío a ${direccion}` : 'Entrega: retiro en el local',
      `Pago: ${pago === 'transferencia' ? 'transferencia' : 'efectivo'}`,
      `A nombre de: ${nombre}`
    ];
    if (aclaraciones) partes.push(`Aclaraciones: ${aclaraciones}`);
    return partes.join('\n');
  }

  function linkWhatsapp(numero, texto) {
    const limpio = limpiarTelefono(numero);
    if (!limpio) return null;
    return `https://wa.me/${limpio}?text=${encodeURIComponent(texto)}`;
  }

  const api = {
    RECARGO_MITAD_Y_MITAD, CANTIDAD_MAXIMA, NOMBRES_MASA,
    formatearPrecio, precioUnitario, normalizarExtras, limpiarTexto, claveItem, agregarItem, cambiarCantidad, cantidadDeProducto,
    reconciliar, describirItem, totalPedido, cantidadTotal, limpiarTelefono, armarMensaje, linkWhatsapp
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.PedidoLogica = api;
})(typeof window !== 'undefined' ? window : globalThis);
