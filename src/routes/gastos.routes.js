const express = require('express');
const router = express.Router();
const gastosController = require('../controllers/gastos.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

// Las rutas fijas ("categorias", "recurrentes") van antes que las de "/:id".
router.get('/categorias', verificarToken, verificarRol('admin'), gastosController.listarCategorias);
router.get('/recurrentes', verificarToken, verificarRol('admin'), gastosController.listarRecurrentes);
router.post('/recurrentes', verificarToken, verificarRol('admin'), gastosController.crearRecurrente);
router.post('/recurrentes/cargar', verificarToken, verificarRol('admin'), gastosController.cargarRecurrentes);
router.delete('/recurrentes/:id', verificarToken, verificarRol('admin'), gastosController.eliminarRecurrente);

router.get('/', verificarToken, verificarRol('admin'), gastosController.listar);
router.post('/', verificarToken, verificarRol('admin'), gastosController.crear);
router.put('/:id/clasificacion', verificarToken, verificarRol('admin'), gastosController.clasificar);
router.delete('/:id', verificarToken, verificarRol('admin'), gastosController.eliminar);

module.exports = router;
