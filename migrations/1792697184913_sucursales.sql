-- Up Migration
-- ============================================================================
-- MULTI-SUCURSAL, paso 1: tabla de sucursales y columna sucursal_id.
--
-- Es un cambio "aditivo": solo agrega cosas. Todo lo que ya existe queda asignado a
-- la sucursal 1 (el local actual) y la columna tiene DEFAULT 1, asi que el codigo
-- actual sigue funcionando sin cambios: un pedido nuevo sin sucursal cae en la 1.
-- ============================================================================

CREATE TABLE sucursales (
  id SERIAL PRIMARY KEY,
  nombre text NOT NULL,
  direccion text,
  pto_vta integer,                       -- punto de venta ARCA (se carga a mano)
  activa boolean NOT NULL DEFAULT true,
  creado_en timestamp with time zone NOT NULL DEFAULT now()
);

-- El local actual es la sucursal 1.
INSERT INTO sucursales (id, nombre) VALUES (1, 'Lanús Oeste');
SELECT setval(pg_get_serial_sequence('sucursales', 'id'), 1);

-- Tablas que se separan por sucursal. Lo existente queda en la 1.
ALTER TABLE pedidos         ADD COLUMN sucursal_id integer NOT NULL DEFAULT 1 REFERENCES sucursales(id);
ALTER TABLE gastos          ADD COLUMN sucursal_id integer NOT NULL DEFAULT 1 REFERENCES sucursales(id);
ALTER TABLE facturas_compra ADD COLUMN sucursal_id integer NOT NULL DEFAULT 1 REFERENCES sucursales(id);
ALTER TABLE cierre_caja     ADD COLUMN sucursal_id integer NOT NULL DEFAULT 1 REFERENCES sucursales(id);

-- Usuarios: la sucursal donde trabajan (NULL = ve todas, por ejemplo el administrador).
ALTER TABLE usuarios        ADD COLUMN sucursal_id integer DEFAULT 1 REFERENCES sucursales(id);

CREATE INDEX pedidos_sucursal_fecha_idx ON pedidos (sucursal_id, creado_en);

-- Down Migration
DROP INDEX IF EXISTS pedidos_sucursal_fecha_idx;
ALTER TABLE usuarios        DROP COLUMN IF EXISTS sucursal_id;
ALTER TABLE cierre_caja     DROP COLUMN IF EXISTS sucursal_id;
ALTER TABLE facturas_compra DROP COLUMN IF EXISTS sucursal_id;
ALTER TABLE gastos          DROP COLUMN IF EXISTS sucursal_id;
ALTER TABLE pedidos         DROP COLUMN IF EXISTS sucursal_id;
DROP TABLE IF EXISTS sucursales;