# 🍕 Donchichopizza — Sistema de Gestión

Sistema web full-stack para la gestión integral de una pizzería real (Lanús Oeste, Buenos Aires), desarrollado end-to-end: modelo de datos, backend, frontend, facturación electrónica oficial y despliegue en producción.

**🔗 En producción:** [www.donchichopizza.com.ar](https://www.donchichopizza.com.ar)

---

## Qué resuelve

Centraliza la operación diaria de un comercio gastronómico: toma de pedidos, facturación electrónica con CAE ante AFIP/ARCA, impresión de comandas en impresora térmica física, control de caja y balance mensual, y una landing pública con menú en vivo — todo conectado a la misma base de datos en tiempo real.

## Stack

**Backend:** Node.js, Express, PostgreSQL (Neon)
**Frontend:** HTML/CSS/JS vanilla
**Infraestructura:** Railway, Cloudflare, GitHub (deploy automático por push), Cloudinary
**Integraciones:** `@arcasdk` (facturación AFIP/ARCA), `escpos` (impresión térmica), Brevo (email)

## Decisiones de arquitectura

- **Categorías configurables, no hardcodeadas.** Los productos pertenecen a una categoría que define qué atributos aplican (por ejemplo, "requiere tipo de masa"), en vez de asumir que todo el catálogo es pizza. Hace que el sistema sea adaptable a otro rubro sin tocar código.

- **Impresión desacoplada del backend en la nube.** El servidor corre en Railway, sin acceso físico a la impresora del local. Se resolvió con un patrón de cola de trabajos: el backend marca un pedido como pendiente de impresión, y un agente Node liviano corriendo en la PC del comercio lo detecta y ejecuta la impresión vía comandos ESC/POS reales — el mismo patrón que usan los sistemas POS comerciales.

- **Precio siempre recalculado en el servidor**, nunca confiado al cliente.

- **Certificados y credenciales fuera del control de versiones**, inyectados como variables de entorno en producción.

## Correr localmente

```bash
git clone <este-repo>
cd donchichopizza-sistema-web
npm install
```

Copiar `.env.example` como `.env` y completar los valores (conexión a base de datos, JWT, credenciales de ARCA, Cloudinary y Brevo).

```bash
npm run dev     # servidor con recarga automática
npm start       # servidor (producción)
npm test        # tests automáticos (no necesitan base de datos ni credenciales)
```

> **Cuidado con ARCA:** por defecto el sistema factura en **producción**. Para probar sin emitir comprobantes reales usá certificados de homologación y `ARCA_PRODUCTION=false`.

## Estructura

```
servidor.js              arranque, seguridad (helmet, CORS, rate limit) y rutas
src/routes/              endpoints y permisos por rol
src/controllers/         validan la entrada y arman la respuesta HTTP
src/services/            reglas de negocio (pedidos, ARCA, comanda, email, impresora)
src/repositories/        consultas SQL
src/config/              conexión a la base, transacciones y reglas fijas del negocio
src/utils/               validaciones, errores y fechas
public/                  frontend (HTML/CSS/JS vanilla)
agente-impresora.js      corre en la PC del local: imprime las comandas en cola
migrations/              cambios recomendados de base de datos (revisar antes de aplicar)
test/                    tests automáticos (node --test)
```

## Agente de impresión

Corre en la PC del local (no en el servidor). Necesita `AGENTE_TOKEN` y `API_URL_PRODUCCION` en su `.env`. Para instalarlo como servicio de Windows: `npm install node-windows --no-save` y luego `node instalar-servicio-agente.js`.

## Fecha de los comprobantes ARCA

Históricamente los comprobantes se emitían con la fecha UTC, por lo que entre las 21:00 y las 24:00 salían con la fecha del día siguiente. Para corregirlo sin modificar los ya emitidos, definir `ARCA_FECHA_ART_DESDE` con la fecha y hora ISO del momento del deploy (por ejemplo `2026-09-21T12:00:00Z`): los comprobantes posteriores usan la fecha de Argentina y los anteriores conservan la que ya tenían en ARCA.

> Los certificados de ARCA y las credenciales no se incluyen en el repositorio por seguridad.

---

**Autor:** Elias Aguirre — desarrollado como proyecto real para su propio negocio mientras cursa la Licenciatura en Gestión de la Tecnología Informática (UAI). Sistema en uso productivo.
