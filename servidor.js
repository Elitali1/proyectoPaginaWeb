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

app.use(express.json());

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      scriptSrc: ["'self'"],
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

// Rate limiting: stricter for auth endpoints (applied per-route below)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

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


const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
  console.log(`Servidor corriendo en http://localhost:${PUERTO}`);
});

process.on('unhandledRejection', (error) => {
  console.error('Error no manejado (no crashea el servidor):', error);
});