-- Up Migration

-- Número de WhatsApp de cada local (solo dígitos, con código de país, ej. 5491165838528).
-- Lo usa el menú público para armar el link "Enviar pedido por WhatsApp" de esa sucursal.
-- Es opcional: una sucursal sin número no puede recibir pedidos desde el menú.
ALTER TABLE sucursales ADD COLUMN whatsapp VARCHAR(20);

-- El local original ya publica este número en el sitio (index.html); se carga para que su menú ande de entrada.
UPDATE sucursales SET whatsapp = '5491165838528' WHERE id = 1 AND whatsapp IS NULL;

-- Down Migration

ALTER TABLE sucursales DROP COLUMN whatsapp;
