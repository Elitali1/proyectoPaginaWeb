const express = require('express');
const router = express.Router();
const gastosController = require('../controllers/gastos.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

router.get('/', verificarToken, verificarRol('admin'), gastosController.listar);
router.post('/', verificarToken, verificarRol('admin'), gastosController.crear);
router.delete('/:id', verificarToken, verificarRol('admin'), gastosController.eliminar);

module.exports = router;