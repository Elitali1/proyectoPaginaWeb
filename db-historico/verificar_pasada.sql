-- VERIFICACION DE LA PASADA (solo lectura: no modifica nada, se puede correr las veces que haga falta).
-- Compara las tablas viejas (insumos / productos) con las nuevas de la sucursal 1.
-- Correr DESPUES de refrescar_sucursal_1.sql y ANTES de poner el codigo nuevo: todo tiene que dar OK.
-- Una vez que el codigo nuevo ya esta funcionando, el stock de las tablas viejas deja de actualizarse,
-- asi que desde ahi es normal que "DIFERENCIA" aparezca; este chequeo es para el momento de la pasada.
SELECT 'Insumos: cantidad (viejo vs sucursal 1)' AS chequeo,
       CASE WHEN (SELECT COUNT(*) FROM insumos) = (SELECT COUNT(*) FROM insumo_sucursal WHERE sucursal_id = 1) THEN 'OK' ELSE 'DIFERENCIA' END AS resultado,
       (SELECT COUNT(*) FROM insumos)::text || ' vs ' || (SELECT COUNT(*) FROM insumo_sucursal WHERE sucursal_id = 1)::text AS detalle
UNION ALL
SELECT 'Insumos con stock, minimo o costo distinto',
       CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'DIFERENCIA' END,
       COUNT(*)::text || COALESCE(' -> ids: ' || string_agg(i.id::text, ', ' ORDER BY i.id), '')
FROM insumos i LEFT JOIN insumo_sucursal s ON s.insumo_id = i.id AND s.sucursal_id = 1
WHERE s.insumo_id IS NULL
   OR COALESCE(i.stock_actual, 0) <> s.stock_actual
   OR COALESCE(i.stock_minimo, 0) <> s.stock_minimo
   OR COALESCE(i.costo_unitario, 0) <> s.costo_unitario
UNION ALL
SELECT 'Valor del inventario (stock x costo)',
       CASE WHEN ROUND(v.viejo, 2) = ROUND(v.nuevo, 2) THEN 'OK' ELSE 'DIFERENCIA' END,
       ROUND(v.viejo, 2)::text || ' vs ' || ROUND(v.nuevo, 2)::text
FROM (SELECT (SELECT COALESCE(SUM(COALESCE(stock_actual, 0) * COALESCE(costo_unitario, 0)), 0) FROM insumos) AS viejo,
             (SELECT COALESCE(SUM(stock_actual * costo_unitario), 0) FROM insumo_sucursal WHERE sucursal_id = 1) AS nuevo) v
UNION ALL
SELECT 'Productos: cantidad (viejo vs sucursal 1)',
       CASE WHEN (SELECT COUNT(*) FROM productos) = (SELECT COUNT(*) FROM productos_sucursal WHERE sucursal_id = 1) THEN 'OK' ELSE 'DIFERENCIA' END,
       (SELECT COUNT(*) FROM productos)::text || ' vs ' || (SELECT COUNT(*) FROM productos_sucursal WHERE sucursal_id = 1)::text
UNION ALL
SELECT 'Productos con precio o disponibilidad distinta',
       CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'DIFERENCIA' END,
       COUNT(*)::text || COALESCE(' -> ids: ' || string_agg(p.id::text, ', ' ORDER BY p.id), '')
FROM productos p LEFT JOIN productos_sucursal ps ON ps.producto_id = p.id AND ps.sucursal_id = 1
WHERE ps.producto_id IS NULL
   OR p.precio IS DISTINCT FROM ps.precio
   OR COALESCE(p.disponible, true) <> ps.disponible
UNION ALL
SELECT 'Cierre de caja: unico por fecha y sucursal',
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cierre_caja_fecha_sucursal_key')
             AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cierre_caja_fecha_key') THEN 'OK' ELSE 'FALTA' END,
       'restriccion cierre_caja_fecha_sucursal_key'
UNION ALL
SELECT 'Comprobantes: columna pto_vta en facturas y notas de credito',
       CASE WHEN COUNT(*) = 2 THEN 'OK' ELSE 'FALTA' END,
       COUNT(*)::text || ' de 2 columnas'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'pto_vta' AND table_name IN ('facturas_venta', 'notas_credito')
UNION ALL
SELECT 'Pedidos, gastos, compras y cierres sin sucursal asignada',
       CASE WHEN (SELECT COUNT(*) FROM pedidos WHERE sucursal_id IS NULL)
               + (SELECT COUNT(*) FROM gastos WHERE sucursal_id IS NULL)
               + (SELECT COUNT(*) FROM facturas_compra WHERE sucursal_id IS NULL)
               + (SELECT COUNT(*) FROM cierre_caja WHERE sucursal_id IS NULL) = 0 THEN 'OK' ELSE 'DIFERENCIA' END,
       'pedidos ' || (SELECT COUNT(*) FROM pedidos)::text || ', gastos ' || (SELECT COUNT(*) FROM gastos)::text
       || ', compras ' || (SELECT COUNT(*) FROM facturas_compra)::text || ', cierres ' || (SELECT COUNT(*) FROM cierre_caja)::text
UNION ALL
SELECT 'Sucursales cargadas (informativo)', 'INFO',
       COALESCE(string_agg(id::text || ': ' || nombre || ' (punto de venta ' || COALESCE(pto_vta::text, 'sin cargar') || ')', ' | ' ORDER BY id), 'ninguna')
FROM sucursales
UNION ALL
SELECT 'Migraciones registradas (informativo)', 'INFO', COUNT(*)::text || ' -> ' || COALESCE(string_agg(name, ', ' ORDER BY id), '')
FROM pgmigrations;
