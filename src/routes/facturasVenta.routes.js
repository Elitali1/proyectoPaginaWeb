const express = require('express');
const router = express.Router();
const facturasVentaController = require('../controllers/facturasVenta.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

router.get('/', verificarToken, verificarRol('admin'), facturasVentaController.listar);
router.get('/:id', verificarToken, verificarRol('admin'), facturasVentaController.obtenerUna);

module.exports = router;