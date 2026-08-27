const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidos.controller.js');
const verificarToken = require('../middlewares/auth.js');

router.get('/', verificarToken, pedidosController.listar);
router.get('/:id', verificarToken, pedidosController.obtenerUno);
router.post('/', verificarToken, pedidosController.crear);
router.post('/:id/facturar', verificarToken, pedidosController.facturar);
router.put('/:id', verificarToken, pedidosController.actualizarEstado);
router.delete('/:id', verificarToken, pedidosController.eliminar);
router.get('/:id/pdf', verificarToken, pedidosController.generarPdf);
router.get('/:id/comanda', verificarToken, pedidosController.verComanda);
router.post('/:id/imprimir-comanda', verificarToken, pedidosController.imprimirComandaFisica);
router.put('/:id/productos', verificarToken, pedidosController.modificarProductos);

module.exports = router;