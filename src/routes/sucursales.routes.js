const express = require('express');
const router = express.Router();
const sucursalesController = require('../controllers/sucursales.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

// Administrar sucursales es solo para el admin.
router.get('/', verificarToken, verificarRol('admin'), sucursalesController.listar);
router.post('/', verificarToken, verificarRol('admin'), sucursalesController.crear);
router.put('/:id', verificarToken, verificarRol('admin'), sucursalesController.actualizar);

module.exports = router;