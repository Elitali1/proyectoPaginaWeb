-- Up Migration

-- Días y horario de atención de cada local, como texto libre (ej. "Miércoles a domingos de 19:30 a 00:00").
-- Lo muestra la página Visitanos en la tarjeta de cada local: cada local tiene su propio horario.
-- Es opcional: sin horario, la tarjeta no muestra nada.
ALTER TABLE sucursales ADD COLUMN horario VARCHAR(200);

-- El local original ya publicaba este horario en Visitanos. El del local 2 se carga desde la pantalla Sucursales.
UPDATE sucursales SET horario = 'Viernes, sábado y domingo de 20:00 a 00:00' WHERE id = 1 AND horario IS NULL;

-- Down Migration

ALTER TABLE sucursales DROP COLUMN horario;
