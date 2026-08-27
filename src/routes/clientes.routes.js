const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientes.controller.js');
const verificarToken = require('../middlewares/auth.js');

router.get('/', verificarToken, clientesController.listar);
router.get('/:id', verificarToken, clientesController.obtenerUno);
router.post('/', verificarToken, clientesController.crear);
router.put('/:id', verificarToken, clientesController.actualizar);
router.delete('/:id', verificarToken, clientesController.eliminar);

module.exports = router;