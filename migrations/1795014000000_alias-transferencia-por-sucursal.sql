-- Up Migration

-- Alias de transferencia de cada local y nombre del titular de la cuenta.
-- Los muestra el menú online cuando el cliente elige pagar por transferencia (con un botón para copiar el alias).
-- Son datos públicos a propósito: solo el alias, nunca el CBU. No tienen nada que ver con cuenta_transferencia,
-- que es solo el nombre de la cuenta donde cobra el local (MercadoPago, un banco...) y se usa internamente.
-- Son opcionales: un local sin alias cargado no muestra nada en el menú.
ALTER TABLE sucursales ADD COLUMN alias_transferencia VARCHAR(20);
ALTER TABLE sucursales ADD COLUMN titular_transferencia VARCHAR(100);

-- Down Migration

ALTER TABLE sucursales DROP COLUMN titular_transferencia;
ALTER TABLE sucursales DROP COLUMN alias_transferencia;
