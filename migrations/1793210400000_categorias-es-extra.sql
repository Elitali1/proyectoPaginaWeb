-- Up Migration

-- Marca las categorías cuyos productos son "extras" (agregados como Extra muzzarella o Extra jamón).
-- Esos productos no salen como productos sueltos en el menú online: se ofrecen dentro de cada pizza,
-- cada uno con su propio precio. Siguen siendo productos comunes (precio por sucursal, receta, stock).
ALTER TABLE categorias ADD COLUMN es_extra BOOLEAN NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE categorias DROP COLUMN es_extra;
