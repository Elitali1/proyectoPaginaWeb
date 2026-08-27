const express = require('express');
const router = express.Router();
const facturasVentaController = require('../controllers/facturasVenta.controller.js');

router.get('/', facturasVentaController.listar);
router.get('/:id', facturasVentaController.obtenerUna);
router.post('/', facturasVentaController.crear);

module.exports = router;