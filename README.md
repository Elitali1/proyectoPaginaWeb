# 🍕 Donchichopizza — Sistema de Gestión

Sistema web full-stack para la gestión integral de una pizzería real (Lanús Oeste, Buenos Aires), desarrollado end-to-end: modelo de datos, backend, frontend, facturación electrónica oficial y despliegue en producción.

🔗 **En producción:** [www.donchichopizza.com.ar](https://www.donchichopizza.com.ar)

## Qué resuelve

Centraliza la operación diaria de un comercio gastronómico: toma de pedidos, facturación electrónica con CAE ante AFIP/ARCA, impresión de comandas en impresora térmica física, control de caja, costos y estado de resultados, y una landing pública con menú en vivo y pedido online — todo conectado a la misma base de datos.

Funciona con **varias sucursales**: cada una tiene su propio stock, costos, precios, disponibilidad de productos, caja y punto de venta de ARCA, y el panel puede mostrar los números de una sola sucursal o el consolidado de todas.

## Stack

- **Backend:** Node.js (22.12 o superior), Express, PostgreSQL (Neon)
- **Frontend:** HTML/CSS/JS vanilla
- **Infraestructura:** Railway (deploy automático por push a `main`), Cloudflare, GitHub, Cloudinary
- **Integraciones:** `@arcasdk` (facturación AFIP/ARCA), `escpos` (impresión térmica), Brevo (email)

## Decisiones de arquitectura

**Categorías configurables, no hardcodeadas.** Los productos pertenecen a una categoría que define qué atributos aplican (por ejemplo, "requiere tipo de masa"), en vez de asumir que todo el catálogo es pizza. Hace que el sistema sea adaptable a otro rubro sin tocar código.

**Datos por sucursal.** El catálogo (nombre, imagen, categoría) es común, pero el precio y la disponibilidad de cada producto viven en `productos_sucursal`, y el stock, el costo y el stock mínimo de cada insumo en `insumo_sucursal`. Las emisiones de facturas se encolan por punto de venta para que cada local numere sus comprobantes en orden.

**Impresión desacoplada del backend en la nube.** El servidor corre en Railway, sin acceso físico a la impresora del local. Se resolvió con un patrón de cola de trabajos: el backend marca un pedido como pendiente de impresión, y un agente Node liviano corriendo en la PC del comercio lo detecta y ejecuta la impresión vía comandos ESC/POS reales — el mismo patrón que usan los sistemas POS comerciales.

**Precio siempre recalculado en el servidor, nunca confiado al cliente.**

**Cambios de base de datos versionados.** Todo cambio de esquema es una migración (`node-pg-migrate`) que se prueba primero en staging. Ver [Base de datos y migraciones](#base-de-datos-y-migraciones).

**Certificados y credenciales fuera del control de versiones**, inyectados como variables de entorno en producción.

## Correr localmente

```bash
git clone <este-repo>
cd donchichopizza-sistema-web
npm install
```

Copiar `.env.example` como `.env` y completar los valores (conexión a base de datos, JWT, credenciales de ARCA, Cloudinary y Brevo). Se necesita **Node 22.12 o superior** (está fijado en `engines` de `package.json`).

```bash
npm run dev            # servidor con recarga automática
npm start              # servidor (producción)
npm test               # tests automáticos (no necesitan base de datos ni credenciales)
npm run test:staging   # prueba multi-sucursal pensada para un ambiente de staging
```

### ⚠️ Cuidado con ARCA

**Por defecto el sistema emite en homologación** (comprobantes de prueba, sin validez fiscal). Solo emite comprobantes reales si `ARCA_PRODUCTION` vale exactamente `true`; cualquier otro valor, o no definirla, es homologación. Un certificado de producción no funciona contra homologación (y al revés): si ARCA responde `Certificado no emitido por AC de confianza`, el modo y el certificado no coinciden.

## Variables de entorno

Los nombres y ejemplos están en [`.env.example`](.env.example). Los valores reales nunca se suben al repositorio. Las más importantes:

- `DATABASE_URL`: conexión a PostgreSQL. Usar `sslmode=verify-full`.
- `JWT_SECRET`: firma de las sesiones.
- `ARCA_CUIT`, `ARCA_PTO_VTA`, `ARCA_CBTE_TIPO`, `ARCA_CERT`, `ARCA_KEY`, `ARCA_PRODUCTION`: facturación electrónica.
- `CLOUDINARY_*`: imágenes de productos.
- `BREVO_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME`: emails.
- `API_URL_PRODUCCION`, `AGENTE_TOKEN`: los usa el agente de impresión (en la PC del local).

Al arrancar, el servidor valida las variables críticas y avisa por nombre cuáles faltan, sin mostrar nunca sus valores.

## Estructura

```
servidor.js              arranque, seguridad (helmet, CORS, rate limit) y rutas
src/routes/              endpoints y permisos por rol
src/controllers/         validan la entrada y arman la respuesta HTTP
src/services/            reglas de negocio (pedidos, ARCA, comanda, email, impresora)
src/repositories/        consultas SQL
src/config/              conexión a la base, transacciones y reglas fijas del negocio
src/utils/               validaciones, errores y fechas
public/                  frontend: panel de gestión, landing y menú online
migrations/              migraciones de base de datos (node-pg-migrate, archivos .sql)
test/                    tests automáticos (node --test)
e2e/                     prueba multi-sucursal para staging
scripts/                 utilidades manuales (por ejemplo, exportar el esquema de la base)
docs/                    documentación (migraciones)
db-historico/            scripts de la mudanza a multi-sucursal (ver LEER_PRIMERO.md)
agente-impresora.js      corre en la PC del local: imprime las comandas en cola
instalar-servicio-agente.js   instala el agente como servicio de Windows
probar-arca.js           script manual para probar la facturación con ARCA
railpack.json            librerías del sistema que necesita el servidor en Railway
openssl.cnf              ajustes de OpenSSL del servidor (no tocar sin probar la facturación)
```

### Frontend

- **Panel de gestión:** Pedidos, Productos, Insumos, Compras, Clientes, Historial, Caja, Dashboard, Sucursales y Usuarios. Comparten la hoja `panel-base.css` (la base visual, con todo bajo la clase `.panel-base` del `<body>`) más un `*-pro.css` por pantalla. En el celular el menú del panel se agrupa en un botón de tres líneas.
- **Menú online (`pedir.html`):** el cliente arma su pedido y se envía por WhatsApp al local. Si elige pagar por transferencia, ve el alias y el titular de la sucursal con un botón para copiarlo. El alias y el titular se cargan por sucursal desde el panel (Sucursales) y son públicos a propósito: nunca se carga el CBU.

## Base de datos y migraciones

Los cambios de esquema se hacen **solo con migraciones**, nunca a mano en la base. El detalle completo y las reglas están en [`docs/migraciones.md`](docs/migraciones.md). Lo esencial:

```bash
npm run migrate -- up --dry-run   # muestra qué se aplicaría, sin tocar nada
npm run migrate -- up             # aplica las migraciones pendientes
```

1. **Siempre staging primero.** Producción solo después de probar en staging.
2. **El dry-run se corre solo, en un comando aparte**, y se revisa la lista antes de aplicar. Un dry-run también termina con `Migrations complete!`, así que ese mensaje no alcanza para saber si algo se aplicó.
3. **Confirmar el host antes de correr nada** (por ejemplo, en PowerShell: `($env:DATABASE_URL -split '@')[-1]`). Se usa la cadena **directa** de Neon (sin `-pooler`).
4. **Producción:** antes de migrar se crea una rama de respaldo en Neon. La rama de respaldo es solo un backup: **no se migra**; se migra la rama principal de producción.
5. **Nunca se edita una migración ya aplicada**: si hay que corregir algo, se crea una nueva.
6. Los borrados de columnas (`DROP COLUMN`) no se pueden deshacer en datos: se hacen sin `CASCADE` y recién después de comprobar que el código ya no las usa.

La limpieza del modelo de un solo local se hizo en tres pasos: las columnas viejas de stock, costo y precio (`insumos.stock_actual`, `insumos.stock_minimo`, `insumos.costo_unitario`, `productos.precio`, `productos.disponible`) primero pasaron a ser opcionales, después el código dejó de usarlas, y por último una migración las elimina. Los datos reales viven en las tablas por sucursal. Los scripts de `db-historico/obsoletos/` **no se deben correr**.

## Agente de impresión

Corre en la PC del local (no en el servidor). Necesita `AGENTE_TOKEN` y `API_URL_PRODUCCION` en su `.env`. Para instalarlo como servicio de Windows: `npm install node-windows --no-save` y luego `node instalar-servicio-agente.js`.

`node-windows` se instala solo en esa PC y no está en `package.json` a propósito, porque el servidor corre en Linux. Tampoco hay que actualizar `usb` a una versión mayor sin probar la impresora: está en la versión 1.x porque lo necesita `escpos-usb`.

## Fecha de los comprobantes ARCA

Históricamente los comprobantes se emitían con la fecha UTC, por lo que entre las 21:00 y las 24:00 salían con la fecha del día siguiente. Para corregirlo sin modificar los ya emitidos, definir `ARCA_FECHA_ART_DESDE` con la fecha y hora ISO del momento del deploy (por ejemplo `2026-09-21T12:00:00Z`): los comprobantes posteriores usan la fecha de Argentina y los anteriores conservan la que ya tenían en ARCA.

Los certificados de ARCA y las credenciales no se incluyen en el repositorio por seguridad.

---

**Autor:** Elias Aguirre — desarrollado como proyecto real para su propio negocio mientras cursa la Licenciatura en Gestión de la Tecnología Informática (UAI). Sistema en uso productivo.
