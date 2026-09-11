const express = require('express');
const router = express.Router();
const insumosController = require('../controllers/insumos.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

router.get('/', verificarToken, verificarRol('admin'), insumosController.listar);
router.post('/', verificarToken, verificarRol('admin'), insumosController.crear);
router.post('/:id/ajustar-stock', verificarToken, verificarRol('admin'), insumosController.ajustarStockManual);
router.put('/:id/activo', verificarToken, verificarRol('admin'), insumosController.alternarActivo);
router.put('/:id/stock-minimo', verificarToken, verificarRol('admin'), insumosController.actualizarStockMinimo);
router.put('/:id', verificarToken, verificarRol('admin'), insumosController.actualizar);

module.exports = router;