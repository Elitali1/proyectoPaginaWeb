-- ============================================================================================
-- CAMBIOS RECOMENDADOS EN LA BASE DE DATOS  —  NINGUNO ESTÁ APLICADO
--
-- El código ya valida todo esto, pero la base no lo garantiza: un bug futuro o un script manual
-- podría dejar datos inconsistentes. Antes de ejecutar cada bloque, corré la consulta de chequeo
-- que lo precede: si devuelve filas, hay datos que lo violan y hay que corregirlos primero.
-- Probalos primero en una copia de la base (Neon permite crear branches).
--
-- TAREA PENDIENTE: exportar el esquema actual (pg_dump --schema-only) y guardarlo acá como
-- 000_esquema_actual.sql, para poder reconstruir la base y saber qué restricciones existen.
-- ============================================================================================

-- 1) YA APLICADO en Neon (no ejecutar de nuevo): una sola factura por pedido.
--      CREATE UNIQUE INDEX IF NOT EXISTS ux_facturas_venta_pedido_id ON facturas_venta (pedido_id);
--    Ese índice único ya cubre las búsquedas por pedido_id, así que NO hace falta un índice común
--    aparte sobre la misma columna (ix_facturas_venta_pedido_id): se elimina con
--      DROP INDEX IF EXISTS ix_facturas_venta_pedido_id;
--    También está aplicado el índice parcial para el agente de impresión:
--      CREATE INDEX IF NOT EXISTS ix_pedidos_pendiente_impresion ON pedidos (pendiente_impresion) WHERE pendiente_impresion = true;

-- 2) Cantidades siempre positivas en el detalle del pedido
--    Chequeo:  SELECT id FROM pedido_detalle WHERE cantidad <= 0;
ALTER TABLE pedido_detalle ADD CONSTRAINT pedido_detalle_cantidad_positiva CHECK (cantidad > 0) NOT VALID;
ALTER TABLE pedido_detalle VALIDATE CONSTRAINT pedido_detalle_cantidad_positiva;

-- 3) Email de usuario único sin distinguir mayúsculas
--    Chequeo:  SELECT LOWER(email), COUNT(*) FROM usuarios GROUP BY 1 HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_minusculas ON usuarios (LOWER(email));

-- 4) Montos de gastos y compras positivos
--    Chequeo:  SELECT id FROM gastos WHERE monto <= 0;  SELECT id FROM facturas_compra WHERE monto <= 0;
ALTER TABLE gastos ADD CONSTRAINT gastos_monto_positivo CHECK (monto > 0) NOT VALID;
ALTER TABLE facturas_compra ADD CONSTRAINT facturas_compra_monto_positivo CHECK (monto > 0) NOT VALID;

-- 5) Índices para las consultas más frecuentes (pedidos por fecha, detalle, recetas)
CREATE INDEX IF NOT EXISTS pedidos_creado_en_idx ON pedidos (creado_en);
CREATE INDEX IF NOT EXISTS pedidos_estado_idx ON pedidos (estado);
CREATE INDEX IF NOT EXISTS pedido_detalle_pedido_idx ON pedido_detalle (pedido_id);
CREATE INDEX IF NOT EXISTS receta_detalle_producto_idx ON receta_detalle (producto_id);

-- 6) Auditoría de stock: hoy los ajustes manuales solo quedan en el log del servidor.
--    Con esta tabla se podría registrar cada movimiento (venta, cancelación, compra, ajuste manual).
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id           BIGSERIAL PRIMARY KEY,
  insumo_id    INTEGER NOT NULL REFERENCES insumos(id),
  cantidad     NUMERIC NOT NULL,            -- positivo suma, negativo resta
  motivo       TEXT NOT NULL,               -- 'venta', 'cancelacion', 'compra', 'ajuste_manual', ...
  detalle      TEXT,
  usuario_id   INTEGER,
  pedido_id    INTEGER,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7) Fecha real del comprobante ARCA (hoy se deduce de creado_en). Permitiría dejar de depender de la
--    variable ARCA_FECHA_ART_DESDE. Requiere además un cambio en el código para guardarla.
-- ALTER TABLE facturas_venta ADD COLUMN IF NOT EXISTS fecha_comprobante DATE;
-- ALTER TABLE notas_credito  ADD COLUMN IF NOT EXISTS fecha_comprobante DATE;

-- 8) RESUELTO EN EL CÓDIGO: la columna clientes.cuit existe y ahora el backend la guarda (normalizada a
--    11 dígitos y validada). Solo falta decidir si querés que sea única: revisá antes con
--      SELECT cuit, COUNT(*) FROM clientes WHERE cuit IS NOT NULL GROUP BY cuit HAVING COUNT(*) > 1;
--    y, si no hay repetidos:
--      CREATE UNIQUE INDEX IF NOT EXISTS ux_clientes_cuit ON clientes (cuit) WHERE cuit IS NOT NULL;
