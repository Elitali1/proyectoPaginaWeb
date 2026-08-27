const express = require('express');
const router = express.Router();
const cierreCajaController = require('../controllers/cierreCaja.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

router.get('/', verificarToken, verificarRol('admin'), cierreCajaController.listar);
router.post('/', verificarToken, verificarRol('admin'), cierreCajaController.crear);
router.get('/balance', verificarToken, verificarRol('admin'), cierreCajaController.balance);

module.exports = router;