const express = require('express');
const router = express.Router();
const contactoController = require('../controllers/contacto.controller.js');
const rateLimit = require('express-rate-limit');

const contactoLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

router.post('/', contactoLimiter, contactoController.enviarContacto);

module.exports = router;