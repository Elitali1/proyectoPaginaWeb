-- Up Migration

-- Clasifica los gastos ya cargados reconociendo el concepto. Solo toca los que están "sin clasificar"
-- (no pisa nada que alguien haya marcado) y respeta la categoría si ya tenían una.
-- Lo que no se reconoce (por ejemplo "varios") queda sin clasificar y se marca a mano desde Caja.

-- Sueldos: gasto fijo.
UPDATE gastos
   SET tipo = 'fijo', categoria = COALESCE(categoria, 'Sueldos')
 WHERE tipo = 'sin_clasificar'
   AND concepto ILIKE 'sueldo%';

-- Empanadas, tomate y huevos: es mercadería que se compra para vender o cocinar, o sea un costo
-- variable directo (va a la ganancia bruta, junto con las compras de insumos).
UPDATE gastos
   SET tipo = 'variable', categoria = COALESCE(categoria, 'Mercadería')
 WHERE tipo = 'sin_clasificar'
   AND (concepto ILIKE 'empan%' OR concepto ILIKE 'tomate%' OR concepto ILIKE 'huevo%');

-- Down Migration

-- No hay vuelta atrás exacta (no se sabe cuáles estaban marcadas a mano antes). Es inofensivo: la
-- migración anterior, al deshacerse, elimina la columna "tipo"; la categoría puesta puede quedar.
SELECT 1;
