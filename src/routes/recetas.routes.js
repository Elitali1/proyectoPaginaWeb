const express = require('express');
const router = express.Router();
const recetasController = require('../controllers/recetas.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

router.get('/:productoId', verificarToken, verificarRol('admin'), recetasController.obtener);
router.put('/:productoId', verificarToken, verificarRol('admin'), recetasController.guardar);
router.get('/:productoId/costo', verificarToken, verificarRol('admin'), recetasController.obtenerCostoYMargen);

module.exports = router;