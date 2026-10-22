-- Up Migration
-- ============================================================================
-- MULTI-SUCURSAL, paso 2: stock/costo de insumos y precio/disponibilidad de
-- productos POR SUCURSAL.
--
-- Los insumos, productos y recetas siguen siendo un catalogo unico y compartido.
-- Lo que cambia por local va en estas dos tablas:
--   insumo_sucursal   -> stock_actual, stock_minimo, costo_unitario
--   productos_sucursal -> precio, disponible
--
-- Es un cambio "aditivo": no toca insumos ni productos. Las columnas viejas
-- (insumos.stock_actual, productos.precio, etc.) se siguen usando hasta que el
-- codigo se cambie, y se eliminan en una migracion posterior.
-- ============================================================================

CREATE TABLE insumo_sucursal (
  insumo_id integer NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  sucursal_id integer NOT NULL REFERENCES sucursales(id),
  stock_actual numeric NOT NULL DEFAULT 0,
  stock_minimo numeric NOT NULL DEFAULT 0,
  costo_unitario numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (insumo_id, sucursal_id)
);

CREATE TABLE productos_sucursal (
  producto_id integer NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  sucursal_id integer NOT NULL REFERENCES sucursales(id),
  precio numeric NOT NULL,
  disponible boolean NOT NULL DEFAULT true,
  PRIMARY KEY (producto_id, sucursal_id)
);

-- Copia inicial: la sucursal 1 hereda lo que hoy tiene el catalogo.
INSERT INTO insumo_sucursal (insumo_id, sucursal_id, stock_actual, stock_minimo, costo_unitario)
SELECT id, 1, COALESCE(stock_actual, 0), COALESCE(stock_minimo, 0), COALESCE(costo_unitario, 0)
FROM insumos;

INSERT INTO productos_sucursal (producto_id, sucursal_id, precio, disponible)
SELECT id, 1, precio, COALESCE(disponible, true)
FROM productos;

-- Down Migration
DROP TABLE IF EXISTS productos_sucursal;
DROP TABLE IF EXISTS insumo_sucursal;