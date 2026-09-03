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

Crear un `.env` con las variables usadas en `src/config/db.js`, `arca.service.js` y `servidor.js` (conexión a base de datos, JWT, credenciales de ARCA, Cloudinary y Brevo).

```bash
npm run dev
```

> Los certificados de ARCA y las credenciales no se incluyen en el repositorio por seguridad.

---

**Autor:** Elias Aguirre — desarrollado como proyecto real para su propio negocio mientras cursa la Licenciatura en Gestión de la Tecnología Informática (UAI). Sistema en uso productivo.
