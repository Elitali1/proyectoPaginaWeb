const pool = require('../config/db.js');
const { conTransaccion } = require('../config/transaccion.js');
const { ErrorNegocio } = require('../utils/errores.js');

async function obtener(id) {
  const resultado = await pool.query('SELECT * FROM sucursales WHERE id = $1', [id]);
  if (resultado.rows.length === 0) {
    throw new ErrorNegocio('La sucursal no existe', 404);
  }
  return resultado.rows[0];
}

// Lista para el selector del panel de usuarios. No incluye datos fiscales (punto de venta, dirección).
async function listar() {
  const resultado = await pool.query('SELECT id, nombre, activa FROM sucursales ORDER BY id');
  return resultado.rows;
}

// Lista completa para la pantalla de administración de sucursales (solo admin).
async function listarCompleta() {
  const resultado = await pool.query('SELECT id, nombre, direccion, pto_vta, activa, cuenta_transferencia FROM sucursales ORDER BY id');
  return resultado.rows;
}

// Punto de venta de ARCA con el que emite una sucursal.
//  - Si la sucursal lo tiene cargado (sucursales.pto_vta), se usa ese.
//  - La sucursal 1 (el local original) mantiene la variable ARCA_PTO_VTA como respaldo, así sigue
//    emitiendo igual que antes aunque todavía no se haya cargado en la tabla.
//  - Cualquier otra sucursal sin punto de venta NO puede emitir: si cayera en el de la sucursal 1,
//    saldrían comprobantes de un local con el punto de venta de otro.
function ptoVtaDeEmision(sucursal) {
  if (sucursal.pto_vta) return Number(sucursal.pto_vta);
  if (Number(sucursal.id) === 1 && process.env.ARCA_PTO_VTA) return Number(process.env.ARCA_PTO_VTA);
  throw new ErrorNegocio('Esta sucursal todavía no tiene un punto de venta de ARCA configurado. Avisá al administrador.', 409);
}

// Dos sucursales no pueden facturar con el mismo punto de venta: se mezclaría la numeración.
async function ptoVtaEnUso(db, ptoVta, exceptoId) {
  const resultado = await db.query(
    'SELECT 1 FROM sucursales WHERE pto_vta = $1 AND id <> $2 LIMIT 1',
    [ptoVta, exceptoId ?? 0]
  );
  return resultado.rows.length > 0;
}

// ¿La sucursal ya emitió alguna factura? Si sí, su punto de venta no se puede cambiar.
async function tieneFacturas(db, sucursalId) {
  const resultado = await db.query(
    `SELECT 1
       FROM facturas_venta fv
       JOIN pedidos p ON p.id = fv.pedido_id
      WHERE p.sucursal_id = $1
      LIMIT 1`,
    [sucursalId]
  );
  return resultado.rows.length > 0;
}

// Copia a la sucursal nueva la lista de productos (con sus precios, por el factor) y los insumos
// (con su costo y stock mínimo) de otra sucursal. El stock empieza en 0.
// Es lo mismo que hace db-historico/inicializar_sucursal.sql. No pisa lo que ya tenga cargado.
async function copiarCatalogo(db, origen, destino, factor) {
  await db.query(
    `INSERT INTO productos_sucursal (producto_id, sucursal_id, precio, disponible)
     SELECT producto_id, $2, ROUND(precio * $3), disponible
       FROM productos_sucursal
      WHERE sucursal_id = $1
     ON CONFLICT (producto_id, sucursal_id) DO NOTHING`,
    [origen, destino, factor]
  );
  await db.query(
    `INSERT INTO insumo_sucursal (insumo_id, sucursal_id, stock_actual, stock_minimo, costo_unitario)
     SELECT insumo_id, $2, 0, stock_minimo, costo_unitario
       FROM insumo_sucursal
      WHERE sucursal_id = $1
     ON CONFLICT (insumo_id, sucursal_id) DO NOTHING`,
    [origen, destino]
  );
}

async function crear(datos, { copiarDe, factor }) {
  return conTransaccion(async (db) => {
    if (datos.pto_vta && await ptoVtaEnUso(db, datos.pto_vta, null)) {
      throw new ErrorNegocio('Ese punto de venta ya lo usa otra sucursal', 409);
    }

    if (copiarDe) {
      const origen = await db.query('SELECT 1 FROM sucursales WHERE id = $1', [copiarDe]);
      if (origen.rows.length === 0) throw new ErrorNegocio('La sucursal de la que se quiere copiar no existe', 400);
    }

    const nueva = await db.query(
      `INSERT INTO sucursales (nombre, direccion, pto_vta, activa, cuenta_transferencia)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'MercadoPago'))
       RETURNING id, nombre, direccion, pto_vta, activa, cuenta_transferencia`,
      [datos.nombre, datos.direccion, datos.pto_vta, datos.activa ?? true, datos.cuenta_transferencia ?? null]
    );
    const sucursal = nueva.rows[0];

    if (copiarDe) {
      await copiarCatalogo(db, copiarDe, sucursal.id, factor);
    }

    return sucursal;
  });
}

// Edita una sucursal. Reglas que protegen la facturación y la operación:
//  - el punto de venta no se repite entre sucursales;
//  - el punto de venta no se cambia si la sucursal ya emitió facturas;
//  - tiene que quedar al menos una sucursal activa.
async function actualizar(id, datos) {
  return conTransaccion(async (db) => {
    const actual = await db.query('SELECT * FROM sucursales WHERE id = $1 FOR UPDATE', [id]);
    if (actual.rows.length === 0) throw new ErrorNegocio('La sucursal no existe', 404);
    const previa = actual.rows[0];

    const activa = datos.activa === undefined ? previa.activa : datos.activa;

    if (datos.pto_vta && await ptoVtaEnUso(db, datos.pto_vta, id)) {
      throw new ErrorNegocio('Ese punto de venta ya lo usa otra sucursal', 409);
    }

    const ptoVtaPrevio = previa.pto_vta === null || previa.pto_vta === undefined ? null : Number(previa.pto_vta);
    if (datos.pto_vta !== ptoVtaPrevio && await tieneFacturas(db, id)) {
      throw new ErrorNegocio('No se puede cambiar el punto de venta de una sucursal que ya emitió facturas', 409);
    }

    if (previa.activa && !activa) {
      const otras = await db.query('SELECT 1 FROM sucursales WHERE activa AND id <> $1 LIMIT 1', [id]);
      if (otras.rows.length === 0) throw new ErrorNegocio('Tiene que quedar al menos una sucursal activa', 409);
    }

    const resultado = await db.query(
      `UPDATE sucursales
          SET nombre = $1, direccion = $2, pto_vta = $3, activa = $4,
              cuenta_transferencia = COALESCE($6, cuenta_transferencia)
        WHERE id = $5
        RETURNING id, nombre, direccion, pto_vta, activa, cuenta_transferencia`,
      [datos.nombre, datos.direccion, datos.pto_vta, activa, id, datos.cuenta_transferencia ?? null]
    );
    return resultado.rows[0];
  });
}

module.exports = { obtener, listar, listarCompleta, ptoVtaDeEmision, crear, actualizar };
