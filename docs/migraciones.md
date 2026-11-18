# Migraciones de la base de datos

Cada cambio en la base (agregar una columna, una tabla, un índice) se escribe como un archivo en esta carpeta. Así queda registrado, se prueba primero en staging y se aplica en producción igual que lo probado.

## Reglas

1. Nunca se cambia la base a mano desde el SQL Editor de Neon. Todo cambio es una migración.
2. Nunca se edita una migración que ya se aplicó en staging o producción. Si hay un error, se crea otra migración que lo corrige.
3. Antes de cualquier `npm run migrate`, se confirma el host de la base:

   ```powershell
   ($env:DATABASE_URL -split '@')[-1]
   ```

   Se compara contra la lista de hosts (staging / producción). Si no coincide, no se corre nada.
4. Las migraciones usan la cadena **directa** de Neon (sin `-pooler`), entre comillas simples por el `&`.
5. Producción solo se migra después de probar en staging, y con una branch de respaldo en Neon.

## Cómo crear una migración

```powershell
npm run migrate -- create nombre-del-cambio --migration-file-language sql
```

Genera `migrations/<numero>_nombre-del-cambio.sql`. Se escribe así:

```sql
-- Up Migration
ALTER TABLE pedidos ADD COLUMN sucursal_id INTEGER;

-- Down Migration
ALTER TABLE pedidos DROP COLUMN sucursal_id;
```

`Up` es lo que se aplica. `Down` es cómo se deshace.

## Cómo probarla y aplicarla

1. Staging: poner la cadena directa de staging, confirmar el host y correr:

   ```powershell
   npm run migrate -- up --dry-run
   npm run migrate -- up
   ```

   `--dry-run` muestra el SQL sin ejecutarlo.
2. Probar el sistema contra staging.
3. Producción: crear una branch de respaldo en Neon, poner la cadena directa de producción, confirmar el host y correr `npm run migrate -- up`.

## Cómo volver atrás

```powershell
npm run migrate -- down
```

Deshace la última migración con su bloque `Down`. Si el cambio ya generó datos nuevos, se restaura desde la branch de respaldo de Neon.

## Archivos importantes

- `1792687650808_esquema-inicial.sql`: foto del esquema al 22/10/2026 (14 tablas). Se marcó como aplicada con `up --fake` en staging y producción, porque ahí las tablas ya existían. En una base vacía sí se ejecuta y reconstruye todo.
- `../scripts/exportar-esquema.js`: genera una foto del esquema de cualquier base, en modo solo lectura.
- `../db-historico/`: SQL viejos de referencia. No son migraciones, por eso están fuera de esta carpeta.

## Pendientes conocidos

- Índice `ix_facturas_venta_pedido_id`: es redundante con el único `ux_facturas_venta_pedido_id`. Se puede borrar con una migración.
- Mejoras recomendadas sin aplicar (restricciones de cantidades y montos positivos, índices de consulta): están en `db-historico/recomendadas_NO_APLICADAS.sql` y pueden pasar a migraciones más adelante.
