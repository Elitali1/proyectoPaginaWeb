-- Up Migration

-- Hasta ahora había un solo cierre de caja por día (UNIQUE fecha). Con más de una sucursal,
-- cada una cierra su propia caja el mismo día: la unicidad pasa a ser (fecha, sucursal_id).
-- Es una restricción MÁS permisiva, así que el código anterior sigue funcionando igual.
ALTER TABLE cierre_caja DROP CONSTRAINT cierre_caja_fecha_key;
ALTER TABLE cierre_caja ADD CONSTRAINT cierre_caja_fecha_sucursal_key UNIQUE (fecha, sucursal_id);

-- Down Migration

-- Ojo: falla si ya hay dos cierres del mismo día de distintas sucursales (hay que borrar uno antes).
ALTER TABLE cierre_caja DROP CONSTRAINT cierre_caja_fecha_sucursal_key;
ALTER TABLE cierre_caja ADD CONSTRAINT cierre_caja_fecha_key UNIQUE (fecha);