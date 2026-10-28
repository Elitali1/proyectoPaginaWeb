-- ALTA DE UNA SUCURSAL NUEVA (NO es una migracion; se corre a mano, una sola vez, cuando se abre el local).
-- Copia a la sucursal nueva la lista de productos (con sus precios) y los insumos (con su costo y stock minimo)
-- de otra sucursal. El stock de la sucursal nueva empieza en 0: se carga con la primera compra o un ajuste manual.
-- Es seguro correrlo de nuevo: NO pisa lo que la sucursal nueva ya tenga cargado.
--
-- Antes de correr: la sucursal tiene que existir en la tabla sucursales (con su nombre, direccion y punto de venta).
-- Se cambian solo los tres numeros de abajo:
DO $$
DECLARE
  origen  integer := 1;     -- sucursal de la que se copia (el local actual)
  destino integer := 2;     -- sucursal nueva
  factor  numeric := 1.00;  -- 1.00 = mismos precios; 1.10 = 10% mas caros; 0.95 = 5% mas baratos
BEGIN
  IF origen = destino THEN
    RAISE EXCEPTION 'El origen y el destino son la misma sucursal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sucursales WHERE id = origen) THEN
    RAISE EXCEPTION 'No existe la sucursal de origen %', origen;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sucursales WHERE id = destino) THEN
    RAISE EXCEPTION 'No existe la sucursal de destino %: primero hay que darla de alta en la tabla sucursales', destino;
  END IF;
  IF factor <= 0 THEN
    RAISE EXCEPTION 'El factor de precios tiene que ser mayor a cero';
  END IF;

  INSERT INTO productos_sucursal (producto_id, sucursal_id, precio, disponible)
  SELECT producto_id, destino, ROUND(precio * factor), disponible
  FROM productos_sucursal
  WHERE sucursal_id = origen
  ON CONFLICT (producto_id, sucursal_id) DO NOTHING;

  INSERT INTO insumo_sucursal (insumo_id, sucursal_id, stock_actual, stock_minimo, costo_unitario)
  SELECT insumo_id, destino, 0, stock_minimo, costo_unitario
  FROM insumo_sucursal
  WHERE sucursal_id = origen
  ON CONFLICT (insumo_id, sucursal_id) DO NOTHING;
END $$;

-- Resultado: cuantos productos e insumos quedaron cargados en cada sucursal.
SELECT s.id AS sucursal, s.nombre,
       (SELECT COUNT(*) FROM productos_sucursal ps WHERE ps.sucursal_id = s.id) AS productos,
       (SELECT COUNT(*) FROM insumo_sucursal i WHERE i.sucursal_id = s.id) AS insumos
FROM sucursales s ORDER BY s.id;
