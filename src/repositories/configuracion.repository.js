const pool = require('../config/db.js');

// Configuración general del negocio (una sola para todas las sucursales: comparten CUIT).
async function obtenerIva() {
  const resultado = await pool.query(
    "SELECT clave, valor FROM configuracion WHERE clave IN ('condicion_iva', 'alicuota_iva')"
  );
  const valores = Object.fromEntries(resultado.rows.map(f => [f.clave, f.valor]));
  return {
    condicion: valores.condicion_iva === 'responsable_inscripto' ? 'responsable_inscripto' : 'monotributo',
    alicuota: Number(valores.alicuota_iva || 21)
  };
}

async function guardarIva({ condicion, alicuota }) {
  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES ('condicion_iva', $1), ('alicuota_iva', $2)
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
    [condicion, String(alicuota)]
  );
  return { condicion, alicuota };
}

module.exports = { obtenerIva, guardarIva };
