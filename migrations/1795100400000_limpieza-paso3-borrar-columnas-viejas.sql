-- Up Migration
-- ============================================================================
-- LIMPIEZA, paso 3 de 3: se borran las columnas viejas del modelo de un solo local.
--
-- Desde que el stock, el costo y el precio viven por sucursal (insumo_sucursal y
-- productos_sucursal), estas columnas ya no las lee ni las escribe nadie:
--   insumos.stock_actual, insumos.stock_minimo, insumos.costo_unitario
--   productos.precio, productos.disponible
-- El paso 1 las dejo opcionales y el codigo dejo de completarlas.
--
-- ATENCION: este paso BORRA DATOS (los valores viejos y congelados de esas columnas).
-- Los datos reales estan en las tablas por sucursal y no se tocan. Antes de aplicarlo en
-- produccion hay que crear una rama de respaldo en Neon.
--
-- No se usa CASCADE a proposito: si alguna vista u objeto de la base dependiera de estas
-- columnas, el DROP falla en vez de borrar esa dependencia en silencio.
-- IF EXISTS hace que se pueda volver a correr sin error.
-- ============================================================================

ALTER TABLE insumos
  DROP COLUMN IF EXISTS stock_actual,
  DROP COLUMN IF EXISTS stock_minimo,
  DROP COLUMN IF EXISTS costo_unitario;

ALTER TABLE productos
  DROP COLUMN IF EXISTS precio,
  DROP COLUMN IF EXISTS disponible;

-- Down Migration
-- Vuelve a crear las columnas, pero SIN los datos que tenian (no se pueden recuperar:
-- para eso esta la rama de respaldo de Neon). Quedan opcionales, como las dejo el paso 1.
ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS stock_actual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_minimo numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_unitario numeric DEFAULT 0;

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS precio numeric,
  ADD COLUMN IF NOT EXISTS disponible boolean DEFAULT true;
