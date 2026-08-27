const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productos.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');
const upload = require('../middlewares/upload.js');

router.get('/publico', productosController.listarPublico);
router.get('/', verificarToken, productosController.listar);
router.get('/:id', verificarToken, productosController.obtenerUno);
router.post('/', verificarToken, verificarRol('admin'), productosController.crear);
router.put('/:id', verificarToken, verificarRol('admin'), productosController.actualizar);
router.delete('/:id', verificarToken, verificarRol('admin'), productosController.eliminar);
router.post('/:id/imagen', verificarToken, verificarRol('admin'), upload.single('imagen'), productosController.subirImagen);

module.exports = router;