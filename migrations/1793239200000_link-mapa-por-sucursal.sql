-- Up Migration

-- Link de Google Maps de cada local (el que sale de "Compartir" en Maps). Lo usa la página Visitanos para el
-- botón "Cómo llegar": ese link abre el lugar con su ubicación, las reseñas y las fotos del local.
-- Es opcional: sin link, Visitanos arma la búsqueda en Maps con la dirección.
ALTER TABLE sucursales ADD COLUMN link_mapa VARCHAR(500);

-- El local original (Lanús). El del local 2 se carga desde la pantalla Sucursales.
UPDATE sucursales SET link_mapa = 'https://maps.app.goo.gl/DToFTcv5CEoBoqmR8' WHERE id = 1 AND link_mapa IS NULL;

-- Down Migration

ALTER TABLE sucursales DROP COLUMN link_mapa;
