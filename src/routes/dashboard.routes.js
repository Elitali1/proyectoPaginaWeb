const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

router.get('/', verificarToken, verificarRol('admin'), dashboardController.obtenerDashboard);

module.exports = router;