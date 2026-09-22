-- ============================================================================================
-- REQUERIDO — correr esto en Neon ANTES de desplegar el código que lo usa.
--
-- Agrega la columna que permite bloquear la reimpresión de una comanda ya impresa, y solo
-- habilitarla de nuevo si el pedido se modifica.
--
-- Es seguro correrlo en cualquier momento: agregar una columna nueva no rompe el código viejo
-- (que la ignora), así que no hace falta coordinar el horario con el deploy. Lo que sí es
-- obligatorio es que esté aplicada ANTES de que el código nuevo llegue a producción: si el
-- servidor nuevo corre sin esta columna, cualquier intento de editar o imprimir un pedido
-- responde error 500 (la consulta SQL referencia una columna que no existe).
-- ============================================================================================

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS impreso_en TIMESTAMPTZ;

-- Verificación (tiene que devolver 1 fila con impreso_en):
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'impreso_en';
