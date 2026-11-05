-- Up Migration
-- ============================================================================
-- LIMPIEZA, paso 1 de 3 (la segura): las columnas viejas pasan a ser opcionales.
--
-- Desde que el stock, el costo y el precio viven por sucursal (insumo_sucursal y
-- productos_sucursal), estas columnas ya no las lee ni las escribe nadie:
--   insumos.stock_actual, insumos.stock_minimo, insumos.costo_unitario
--   productos.precio, productos.disponible
--
-- Este paso NO borra nada ni cambia ningun dato: solo deja de exigir que tengan valor,
-- para que el codigo pueda dejar de completarlas al crear insumos y productos.
-- DROP NOT NULL sobre una columna que ya era opcional no hace nada, asi que es seguro
-- sin importar como esten hoy.
-- ============================================================================

ALTER TABLE insumos ALTER COLUMN stock_actual DROP NOT NULL;
ALTER TABLE insumos ALTER COLUMN stock_minimo DROP NOT NULL;
ALTER TABLE insumos ALTER COLUMN costo_unitario DROP NOT NULL;
ALTER TABLE productos ALTER COLUMN precio DROP NOT NULL;
ALTER TABLE productos ALTER COLUMN disponible DROP NOT NULL;

-- Down Migration
-- Sin accion a proposito: volver a exigir NOT NULL fallaria apenas exista un producto
-- creado sin esas columnas, y no aporta nada. Los datos no se tocaron.
SELECT 1;
