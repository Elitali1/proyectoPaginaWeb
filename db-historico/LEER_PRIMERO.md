# db-historico

Scripts de la mudanza a multi-sucursal. Ya cumplieron su funcion. NO correr:

- refrescar_sucursal_1.sql: copia stock y precio desde las columnas viejas (congeladas) a las
  tablas por sucursal. Hoy pisaria los datos reales con valores viejos.
- verificar_pasada.sql: compara columnas viejas contra las nuevas; las viejas ya no se actualizan,
  y despues de la limpieza ni existen.

Se mueven a `obsoletos/` (git mv) para que nadie los corra por error.
