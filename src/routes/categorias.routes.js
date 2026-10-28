const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categorias.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

router.get('/', verificarToken, categoriasController.listar);
router.post('/', verificarToken, verificarRol('admin'), categoriasController.crear);
router.put('/:id', verificarToken, verificarRol('admin'), categoriasController.actualizar);
router.delete('/:id', verificarToken, verificarRol('admin'), categoriasController.eliminar);

module.exports = router;
