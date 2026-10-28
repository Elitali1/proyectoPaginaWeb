-- Up Migration

-- 1) Tipo de gasto: fijo (no depende de cuánto se vende: sueldos, alquiler, servicios) o variable
--    (sube y baja con las ventas). Los gastos que ya existen quedan "sin clasificar" hasta que se
--    marquen (la migración siguiente clasifica los que se pueden reconocer por el concepto).
ALTER TABLE gastos ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'sin_clasificar';
ALTER TABLE gastos ADD CONSTRAINT gastos_tipo_check CHECK (tipo IN ('fijo', 'variable', 'sin_clasificar'));

-- 2) Configuración general del negocio (el CUIT es el mismo para todas las sucursales).
--    Hoy es monotributista: las ventas se toman tal cual. Si pasa a Responsable Inscripto, se cambia
--    'condicion_iva' a 'responsable_inscripto' y el estado de resultados usa ventas netas de IVA.
CREATE TABLE configuracion (
  clave VARCHAR(50) PRIMARY KEY,
  valor VARCHAR(100) NOT NULL
);
INSERT INTO configuracion (clave, valor) VALUES
  ('condicion_iva', 'monotributo'),
  ('alicuota_iva', '21');

-- 3) Cuenta donde cada sucursal cobra las transferencias (Mercado Pago, un banco, etc.).
--    Es solo un nombre para mostrar y controlar: las sucursales existentes quedan en 'MercadoPago',
--    que es como se mostraba hasta ahora.
ALTER TABLE sucursales ADD COLUMN cuenta_transferencia VARCHAR(100) NOT NULL DEFAULT 'MercadoPago';

-- 4) Gastos recurrentes de cada sucursal (alquiler, luz, internet, sueldos fijos...): se cargan una vez
--    y después, cada mes, un botón los convierte en gastos sin volver a tipearlos.
CREATE TABLE gastos_recurrentes (
  id SERIAL PRIMARY KEY,
  sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
  concepto VARCHAR(200) NOT NULL,
  categoria VARCHAR(100),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('fijo', 'variable')),
  monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_gastos_recurrentes_sucursal ON gastos_recurrentes (sucursal_id);

-- Down Migration

-- Ojo: borra los gastos recurrentes cargados y la clasificación fijo/variable de los gastos.
DROP TABLE gastos_recurrentes;
ALTER TABLE sucursales DROP COLUMN cuenta_transferencia;
DROP TABLE configuracion;
ALTER TABLE gastos DROP CONSTRAINT gastos_tipo_check;
ALTER TABLE gastos DROP COLUMN tipo;
