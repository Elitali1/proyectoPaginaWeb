-- Up Migration
-- ============================================================================
-- ESQUEMA INICIAL de la base "neondb" (exportado el 2026-10-22).
-- Solo estructura, sin datos. Sirve para reconstruir la base desde cero.
--
-- En una base que YA tiene estas tablas (por ejemplo producción) NO se ejecuta:
-- se marca como aplicada con  npm run migrate -- up --fake
-- ============================================================================

CREATE TABLE categorias (
  id SERIAL,
  nombre text NOT NULL,
  requiere_masa boolean DEFAULT false
);

CREATE TABLE cierre_caja (
  id SERIAL,
  fecha date NOT NULL,
  total_efectivo numeric DEFAULT 0 NOT NULL,
  total_transferencia numeric DEFAULT 0 NOT NULL,
  total_general numeric DEFAULT 0 NOT NULL,
  cerrado_por integer,
  creado_en timestamp with time zone DEFAULT now()
);

CREATE TABLE clientes (
  id SERIAL,
  nombre text,
  telefono text,
  direccion text,
  creado_en timestamp without time zone DEFAULT now(),
  cuit text
);

CREATE TABLE compra_detalle (
  id SERIAL,
  factura_compra_id integer,
  insumo_id integer,
  cantidad numeric NOT NULL,
  precio_unitario numeric NOT NULL,
  creado_en timestamp with time zone DEFAULT now()
);

CREATE TABLE facturas_compra (
  id SERIAL,
  proveedor text NOT NULL,
  concepto text,
  monto numeric NOT NULL,
  fecha date NOT NULL,
  archivo_url text,
  subido_por integer,
  creado_en timestamp with time zone DEFAULT now()
);

CREATE TABLE facturas_venta (
  id SERIAL,
  pedido_id integer NOT NULL,
  tipo_comprobante text NOT NULL,
  numero_comprobante text,
  cae text,
  vencimiento_cae date,
  monto numeric NOT NULL,
  estado text DEFAULT 'pendiente'::text NOT NULL,
  creado_en timestamp with time zone DEFAULT now()
);

CREATE TABLE gastos (
  id SERIAL,
  concepto text NOT NULL,
  categoria text,
  monto numeric NOT NULL,
  fecha date NOT NULL,
  creado_en timestamp with time zone DEFAULT now()
);

CREATE TABLE insumos (
  id SERIAL,
  nombre text NOT NULL,
  unidad_medida text NOT NULL,
  stock_actual numeric DEFAULT 0,
  costo_unitario numeric DEFAULT 0,
  creado_en timestamp with time zone DEFAULT now(),
  activo boolean DEFAULT true,
  stock_minimo numeric DEFAULT 0
);

CREATE TABLE notas_credito (
  id SERIAL,
  factura_id integer,
  numero_comprobante integer,
  cae text,
  vencimiento_cae date,
  monto numeric NOT NULL,
  motivo text,
  creado_en timestamp with time zone DEFAULT now()
);

CREATE TABLE pedido_detalle (
  id SERIAL,
  pedido_id integer NOT NULL,
  producto_id integer NOT NULL,
  cantidad integer NOT NULL,
  precio_unitario numeric NOT NULL,
  producto_id_2 integer,
  tipo_masa text DEFAULT 'piedra'::text,
  aclaraciones text
);

CREATE TABLE pedidos (
  id SERIAL,
  cliente text NOT NULL,
  canal text NOT NULL,
  medio_pago text NOT NULL,
  requiere_factura boolean DEFAULT false,
  creado_en timestamp with time zone DEFAULT now(),
  estado text DEFAULT 'pendiente'::text,
  cliente_id integer,
  tipo_entrega text DEFAULT 'retiro'::text NOT NULL,
  direccion_entrega text,
  cuit_receptor text,
  pendiente_impresion boolean DEFAULT false,
  monto_efectivo numeric,
  monto_transferencia numeric,
  impreso_en timestamp with time zone
);

CREATE TABLE productos (
  id SERIAL,
  nombre text NOT NULL,
  precio numeric NOT NULL,
  disponible boolean DEFAULT true,
  creado_en timestamp without time zone DEFAULT now(),
  imagen text,
  categoria_id integer
);

CREATE TABLE receta_detalle (
  id SERIAL,
  producto_id integer,
  insumo_id integer,
  cantidad numeric NOT NULL,
  creado_en timestamp with time zone DEFAULT now()
);

CREATE TABLE usuarios (
  id SERIAL,
  nombre text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  rol text DEFAULT 'cajero'::text NOT NULL,
  creado_en timestamp without time zone DEFAULT now(),
  token_reset character varying(255),
  token_reset_vencimiento timestamp with time zone,
  failed_login_attempts integer DEFAULT 0,
  lock_until timestamp with time zone
);

ALTER TABLE categorias ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);
ALTER TABLE cierre_caja ADD CONSTRAINT cierre_caja_pkey PRIMARY KEY (id);
ALTER TABLE clientes ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);
ALTER TABLE compra_detalle ADD CONSTRAINT compra_detalle_pkey PRIMARY KEY (id);
ALTER TABLE facturas_compra ADD CONSTRAINT facturas_compra_pkey PRIMARY KEY (id);
ALTER TABLE facturas_venta ADD CONSTRAINT facturas_venta_pkey PRIMARY KEY (id);
ALTER TABLE gastos ADD CONSTRAINT gastos_pkey PRIMARY KEY (id);
ALTER TABLE insumos ADD CONSTRAINT insumos_pkey PRIMARY KEY (id);
ALTER TABLE notas_credito ADD CONSTRAINT notas_credito_pkey PRIMARY KEY (id);
ALTER TABLE pedido_detalle ADD CONSTRAINT pedido_detalle_pkey PRIMARY KEY (id);
ALTER TABLE pedidos ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);
ALTER TABLE productos ADD CONSTRAINT productos_pkey PRIMARY KEY (id);
ALTER TABLE receta_detalle ADD CONSTRAINT receta_detalle_pkey PRIMARY KEY (id);
ALTER TABLE usuarios ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);
ALTER TABLE cierre_caja ADD CONSTRAINT cierre_caja_fecha_key UNIQUE (fecha);
ALTER TABLE clientes ADD CONSTRAINT clientes_telefono_unique UNIQUE (telefono);
ALTER TABLE usuarios ADD CONSTRAINT usuarios_email_key UNIQUE (email);
ALTER TABLE cierre_caja ADD CONSTRAINT cierre_caja_cerrado_por_fkey FOREIGN KEY (cerrado_por) REFERENCES usuarios(id);
ALTER TABLE compra_detalle ADD CONSTRAINT compra_detalle_factura_compra_id_fkey FOREIGN KEY (factura_compra_id) REFERENCES facturas_compra(id) ON DELETE CASCADE;
ALTER TABLE compra_detalle ADD CONSTRAINT compra_detalle_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos(id);
ALTER TABLE facturas_compra ADD CONSTRAINT facturas_compra_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES usuarios(id);
ALTER TABLE facturas_venta ADD CONSTRAINT facturas_venta_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id);
ALTER TABLE notas_credito ADD CONSTRAINT notas_credito_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES facturas_venta(id);
ALTER TABLE pedido_detalle ADD CONSTRAINT pedido_detalle_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
ALTER TABLE pedido_detalle ADD CONSTRAINT pedido_detalle_producto_id_2_fkey FOREIGN KEY (producto_id_2) REFERENCES productos(id);
ALTER TABLE pedido_detalle ADD CONSTRAINT pedido_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id);
ALTER TABLE pedidos ADD CONSTRAINT pedidos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE productos ADD CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorias(id);
ALTER TABLE receta_detalle ADD CONSTRAINT receta_detalle_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos(id);
ALTER TABLE receta_detalle ADD CONSTRAINT receta_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE;

CREATE INDEX ix_facturas_venta_pedido_id ON public.facturas_venta USING btree (pedido_id);
CREATE UNIQUE INDEX ux_facturas_venta_pedido_id ON public.facturas_venta USING btree (pedido_id);
CREATE INDEX ix_pedidos_pendiente_impresion ON public.pedidos USING btree (pendiente_impresion) WHERE (pendiente_impresion = true);

-- Down Migration
-- El esquema inicial no se deshace.
