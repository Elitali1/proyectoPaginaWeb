const express = require('express');
const router = express.Router();
const configuracionController = require('../controllers/configuracion.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

// La configuración del negocio es solo para el admin.
router.get('/iva', verificarToken, verificarRol('admin'), configuracionController.obtenerIva);
router.put('/iva', verificarToken, verificarRol('admin'), configuracionController.guardarIva);

module.exports = router;
