const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const app = express();
app.set('trust proxy', 1);



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

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

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
app.use(cookieParser());

// CORS: restrict allowed origin to FRONTEND_URL for production
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// Rate limiting: general
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(generalLimiter);

app.use(express.static('public'));
app.use('/pedidos', pedidosRoutes);
app.use('/clientes', clientesRoutes);
app.use('/productos', productosRoutes);
// Apply authLimiter to usuarios routes that are sensitive inside the router where needed
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

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof SyntaxError && error.status === 400 && error.body) {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  if (error.message && (
    error.message.includes('Solo se permiten imágenes') ||
    error.code === 'LIMIT_FILE_SIZE'
  )) {
    return res.status(400).json({ error: error.message });
  }

  console.error('Error no controlado:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
  console.log(`Servidor corriendo en http://localhost:${PUERTO}`);
});

process.on('unhandledRejection', (error) => {
  console.error('Error no manejado (no crashea el servidor):', error);
});