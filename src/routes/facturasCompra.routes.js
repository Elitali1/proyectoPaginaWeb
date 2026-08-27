const express = require('express');
const router = express.Router();
const facturasCompraController = require('../controllers/facturasCompra.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

router.get('/', verificarToken, verificarRol('admin'), facturasCompraController.listar);
router.get('/:id', verificarToken, verificarRol('admin'), facturasCompraController.obtenerUna);
router.post('/', verificarToken, verificarRol('admin'), facturasCompraController.crear);
router.delete('/:id', verificarToken, verificarRol('admin'), facturasCompraController.eliminar);

module.exports = router;