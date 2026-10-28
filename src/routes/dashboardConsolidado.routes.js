const express = require('express');
const router = express.Router();
const controller = require('../controllers/dashboardConsolidado.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

// El consolidado ve todos los locales: solo para el admin.
router.get('/', verificarToken, verificarRol('admin'), controller.obtenerConsolidado);

module.exports = router;