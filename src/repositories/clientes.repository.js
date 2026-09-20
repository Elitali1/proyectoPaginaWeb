const pool = require('../config/db.js');

async function obtenerTodos() {
  const resultado = await pool.query('SELECT * FROM clientes ORDER BY id');
  return resultado.rows;
}

async function obtenerPorId(id) {
  const resultado = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
  return resultado.rows[0];
}

async function crear(datos) {
  const { nombre, telefono, direccion, cuit } = datos;
  const resultado = await pool.query(
    `INSERT INTO clientes (nombre, telefono, direccion, cuit)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nombre, telefono, direccion, cuit ?? null]
  );
  return resultado.rows[0];
}

// Si `cuit` no viene (undefined) se conserva el que ya tiene el cliente; si viene null, se borra.
async function actualizar(id, datos) {
  const { nombre, telefono, direccion, cuit } = datos;

  if (cuit === undefined) {
    const resultado = await pool.query(
      `UPDATE clientes SET nombre = $1, telefono = $2, direccion = $3
       WHERE id = $4
       RETURNING *`,
      [nombre, telefono, direccion, id]
    );
    return resultado.rows[0];
  }

  const resultado = await pool.query(
    `UPDATE clientes SET nombre = $1, telefono = $2, direccion = $3, cuit = $4
     WHERE id = $5
     RETURNING *`,
    [nombre, telefono, direccion, cuit, id]
  );
  return resultado.rows[0];
}

async function eliminar(id) {
  const resultado = await pool.query(
    'DELETE FROM clientes WHERE id = $1 RETURNING *',
    [id]
  );
  return resultado.rows[0];
}

async function obtenerPorTelefono(telefono) {
  const resultado = await pool.query('SELECT * FROM clientes WHERE telefono = $1', [telefono]);
  return resultado.rows[0];
}

async function buscarOCrear(telefono, nombre, direccion) {
  const existente = await obtenerPorTelefono(telefono);

  if (existente) {
    return existente;
  }

  return crear({ nombre, telefono, direccion });
}

async function obtenerMasRecurrentes(desde, hasta, limite = 10) {
  const resultado = await pool.query(
    `SELECT
       c.id,
       c.nombre,
       c.telefono,
       COUNT(p.id) AS cantidad_pedidos,
       COALESCE(SUM(pd.total_pedido), 0) AS total_gastado
     FROM clientes c
     JOIN pedidos p ON p.cliente_id = c.id
     JOIN (
       SELECT pedido_id, SUM(cantidad * precio_unitario) AS total_pedido
       FROM pedido_detalle
       GROUP BY pedido_id
     ) pd ON pd.pedido_id = p.id
     WHERE DATE((p.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires') - INTERVAL '6 hours') BETWEEN $1 AND $2
       AND p.estado != 'cancelado'
     GROUP BY c.id, c.nombre, c.telefono
     ORDER BY cantidad_pedidos DESC
     LIMIT $3`,
    [desde, hasta, limite]
  );
  return resultado.rows;
}
module.exports = { obtenerTodos, obtenerPorId, crear, actualizar, eliminar, obtenerPorTelefono, buscarOCrear, obtenerMasRecurrentes };
