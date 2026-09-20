// Tiene que ser lo primero: carga las variables del .env antes de que cualquier otro módulo las lea.
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

if (!process.env.JWT_SECRET) {
  console.error('Falta la variable de entorno JWT_SECRET: el servidor no puede firmar ni validar sesiones.');
  process.exit(1);
}

const pool = require('./src/config/db.js');
const app = express();

// Cantidad de proxies que hay delante del servidor (Railway = 1; si además el tráfico pasa por
// Cloudflare y las IPs de los usuarios salen todas iguales, probá TRUST_PROXY=2).
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

const pedidosRoutes = require('./src/routes/pedidos.routes.js');
const clientesRoutes = require('./src/routes/clientes.routes.js');
const productosRoutes = require('./src/routes/productos.routes.js');
const usuariosRoutes = require('./src/routes/usuarios.routes.js');
const cierreCajaRoutes = require('./src/routes/cierreCaja.routes.js');
const facturasCompraRoutes = require('./src/routes/facturasCompra.routes.js');
const facturasVentaRoutes = require('./src/routes/facturasVenta.routes.js');
const gastosRoutes = require('./src/routes/gastos.routes.js');
const categoriasRoutes = require('./src/routes/categorias.routes.js');
const insumosRoutes = require('./src/routes/insumos.routes.js');
const recetasRoutes = require('./src/routes/recetas.routes.js');
const dashboardRoutes = require('./src/routes/dashboard.routes.js');
const contactoRoutes = require('./src/routes/contacto.routes.js');

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"]
    }
  }
}));

// Archivos estáticos (HTML, CSS, JS, imágenes). Van ANTES del "no-store" de más abajo: antes ese
// encabezado se aplicaba a todo, así que ni la landing pública cacheaba imágenes ni estilos.
//  - imágenes: se cachean 1 día
//  - resto (html/js/css): el navegador revalida en cada visita (usa ETag), así los cambios se ven al toque
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, rutaArchivo) => {
    if (/\.(png|jpe?g|webp|svg|ico|gif)$/i.test(rutaArchivo)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Chequeo de salud para Railway / monitoreo (no requiere sesión ni toca la base).
app.get('/health', (req, res) => res.json({ ok: true }));

app.use(cookieParser());

// CORS: restrict allowed origin to FRONTEND_URL for production
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

app.use(express.json());

// Las respuestas de la API (datos, sesiones, PDFs) nunca deben quedar en caché.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Rate limiting: general (los límites más estrictos de login, reset y contacto están en cada router)
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(generalLimiter);

app.use('/pedidos', pedidosRoutes);
app.use('/clientes', clientesRoutes);
app.use('/productos', productosRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/cierre-caja', cierreCajaRoutes);
app.use('/facturas-compra', facturasCompraRoutes);
app.use('/facturas-venta', facturasVentaRoutes);
app.use('/gastos', gastosRoutes);
app.use('/categorias', categoriasRoutes);
app.use('/insumos', insumosRoutes);
app.use('/recetas', recetasRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/contacto', contactoRoutes);

// Manejo de errores que no atrapó ningún controller (JSON mal formado, archivo inválido, etc.).
// Siempre responde JSON y nunca filtra detalles internos en errores 500.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status = error.status || error.statusCode || 500;
  if (status >= 500) {
    console.error('Error no manejado:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
  res.status(status).json({ error: error.message || 'Solicitud inválida' });
});

const PUERTO = process.env.PORT || 3000;
const servidor = app.listen(PUERTO, () => {
  console.log(`Servidor corriendo en http://localhost:${PUERTO}`);
});

process.on('unhandledRejection', (error) => {
  console.error('Error no manejado (no crashea el servidor):', error);
});

// Railway manda SIGTERM en cada deploy: se termina lo que está en curso antes de cerrar.
function apagar(senal) {
  console.log(`${senal} recibido: cerrando el servidor...`);
  servidor.close(async () => {
    try {
      await pool.end();
    } catch (error) {
      console.error('Error al cerrar el pool de la base:', error.message);
    }
    process.exit(0);
  });
  // Si algo no termina, se fuerza el cierre a los 10 segundos.
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
