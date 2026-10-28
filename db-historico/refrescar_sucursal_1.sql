-- REFRESCO de la sucursal 1 (NO es una migracion; se corre a mano el dia del cambio).
-- Vuelve a copiar stock/costo/precio desde las tablas viejas a las nuevas, por si
-- cambiaron entre la migracion y el despliegue del codigo nuevo. Se puede correr
-- las veces que haga falta.
INSERT INTO insumo_sucursal (insumo_id, sucursal_id, stock_actual, stock_minimo, costo_unitario)
SELECT id, 1, COALESCE(stock_actual, 0), COALESCE(stock_minimo, 0), COALESCE(costo_unitario, 0)
FROM insumos
ON CONFLICT (insumo_id, sucursal_id) DO UPDATE
  SET stock_actual = EXCLUDED.stock_actual,
      stock_minimo = EXCLUDED.stock_minimo,
      costo_unitario = EXCLUDED.costo_unitario;

INSERT INTO productos_sucursal (producto_id, sucursal_id, precio, disponible)
SELECT id, 1, precio, COALESCE(disponible, true)
FROM productos
ON CONFLICT (producto_id, sucursal_id) DO UPDATE
  SET precio = EXCLUDED.precio,
      disponible = EXCLUDED.disponible;
