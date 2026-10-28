-- Up Migration

-- Cada factura y nota de crédito guarda con QUÉ punto de venta de ARCA se emitió.
-- Hace falta porque la numeración de comprobantes es independiente por punto de venta:
-- el comprobante N° 5 del punto 3 no es el N° 5 del punto 7.
-- NULL = comprobante emitido antes de existir las sucursales (se emitió con ARCA_PTO_VTA),
-- así que no hace falta tocar los datos viejos y el código anterior sigue funcionando.
ALTER TABLE facturas_venta ADD COLUMN pto_vta integer;
ALTER TABLE notas_credito  ADD COLUMN pto_vta integer;

-- Down Migration

ALTER TABLE notas_credito  DROP COLUMN pto_vta;
ALTER TABLE facturas_venta DROP COLUMN pto_vta;