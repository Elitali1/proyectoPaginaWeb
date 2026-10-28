const pool = require('../config/db.js');
const { conTransaccion } = require('../config/transaccion.js');

// El catálogo (nombre, imagen, categoría) es compartido entre sucursales.
// El precio y la disponibilidad son de cada sucursal y viven en productos_sucursal.

// La sucursal 1 es el local original. Mientras otras partes del sistema sigan leyendo precio y
// disponible de la tabla productos, los cambios de la sucursal 1 también se copian ahí.
// TEMPORAL: se elimina cuando todo el código lea productos_sucursal.
const SUCURSAL_PRINCIPAL = 1;

// precio y disponible salen de productos_sucursal. Si el producto no se ofrece en la sucursal,
// precio es null y disponible es false.
const COLUMNAS = `p.id, p.nombre, p.imagen, p.categoria_id, p.creado_en,
       ps.precio, COALESCE(ps.disponible, false) AS disponible,
       (ps.producto_id IS NOT NULL) AS en_sucursal,
       c.nombre AS categoria_nombre, c.requiere_masa`;

// `db` puede ser el pool o un cliente dentro de una transacción.
async function leerProducto(db, id, sucursalId) {
  const resultado = await db.query(`
    SELECT ${COLUMNAS}
    FROM productos p
    LEFT JOIN productos_sucursal ps ON ps.producto_id = p.id AND ps.sucursal_id = $2
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.id = $1
  `, [id, sucursalId]);
  return resultado.rows[0];
}

async function obtenerTodos(sucursalId) {
  const resultado = await pool.query(`
    SELECT ${COLUMNAS}
    FROM productos p
    LEFT JOIN productos_sucursal ps ON ps.producto_id = p.id AND ps.sucursal_id = $1
    LEFT JOIN categorias c ON c.id = p.categoria_id
    ORDER BY p.id
  `, [sucursalId]);
  return resultado.rows;
}

async function obtenerPorId(id, sucursalId) {
  return leerProducto(pool, id, sucursalId);
}

async function crear(datos, sucursalId) {
  const { nombre, precio, disponible, imagen, categoria_id } = datos;
  const estaDisponible = disponible ?? true;

  return conTransaccion(async (db) => {
    // productos.precio es obligatorio: se completa con el precio de la sucursal que lo crea.
    const nuevo = await db.query(
      `INSERT INTO productos (nombre, precio, disponible, imagen, categoria_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [nombre, precio, estaDisponible, imagen || null, categoria_id || null]
    );
    const id = nuevo.rows[0].id;

    await db.query(
      `INSERT INTO productos_sucursal (producto_id, sucursal_id, precio, disponible)
       VALUES ($1, $2, $3, $4)`,
      [id, sucursalId, precio, estaDisponible]
    );

    return leerProducto(db, id, sucursalId);
  });
}

async function actualizar(id, datos, sucursalId) {
  const { nombre, precio, disponible, imagen, categoria_id } = datos;

  return conTransaccion(async (db) => {
    // Datos compartidos del catálogo.
    const catalogo = await db.query(
      `UPDATE productos SET nombre = $1, imagen = $2, categoria_id = $3
       WHERE id = $4
       RETURNING id`,
      [nombre, imagen || null, categoria_id || null, id]
    );
    if (catalogo.rows.length === 0) return undefined;

    // Precio y disponibilidad: de esta sucursal. Si todavía no se ofrecía, se agrega.
    await db.query(
      `INSERT INTO productos_sucursal (producto_id, sucursal_id, precio, disponible)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (producto_id, sucursal_id)
       DO UPDATE SET precio = EXCLUDED.precio, disponible = EXCLUDED.disponible`,
      [id, sucursalId, precio, disponible]
    );

    if (sucursalId === SUCURSAL_PRINCIPAL) {
      await db.query('UPDATE productos SET precio = $1, disponible = $2 WHERE id = $3', [precio, disponible, id]);
    }

    return leerProducto(db, id, sucursalId);
  });
}

// "Eliminar" quita el producto de la sucursal actual. Si ninguna otra sucursal lo ofrece, también
// se borra del catálogo (y si tiene pedidos o recetas, la base lo impide con el error 23503 y no
// se borra nada).
async function eliminar(id, sucursalId) {
  return conTransaccion(async (db) => {
    const producto = await leerProducto(db, id, sucursalId);
    if (!producto) return undefined;

    await db.query(
      'DELETE FROM productos_sucursal WHERE producto_id = $1 AND sucursal_id = $2',
      [id, sucursalId]
    );

    const otras = await db.query('SELECT 1 FROM productos_sucursal WHERE producto_id = $1 LIMIT 1', [id]);
    if (otras.rows.length === 0) {
      await db.query('DELETE FROM productos WHERE id = $1', [id]);
    }

    return producto;
  });
}

async function actualizarImagen(id, imagen, sucursalId) {
  const resultado = await pool.query(
    'UPDATE productos SET imagen = $1 WHERE id = $2 RETURNING id',
    [imagen, id]
  );
  if (resultado.rows.length === 0) return undefined;
  return leerProducto(pool, id, sucursalId);
}

module.exports = { obtenerTodos, obtenerPorId, crear, actualizar, eliminar, actualizarImagen };