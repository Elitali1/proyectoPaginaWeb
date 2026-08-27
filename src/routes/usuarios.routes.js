const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller.js');
const verificarToken = require('../middlewares/auth.js');
const verificarRol = require('../middlewares/verificarRol.js');

// Per-route rate limiters
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

router.get('/', verificarToken, verificarRol('admin'), usuariosController.listar);
router.post('/', verificarToken, verificarRol('admin'), usuariosController.crear);
router.post('/login', loginLimiter, usuariosController.login);
router.post('/logout', usuariosController.logout);
router.delete('/:id', verificarToken, verificarRol('admin'), usuariosController.eliminar);
router.put('/:id', verificarToken, verificarRol('admin'), usuariosController.actualizar);

// Password reset endpoints
router.post('/solicitar-reset', resetLimiter, usuariosController.solicitarReset);
router.post('/confirmar-reset', resetLimiter, usuariosController.confirmarReset);

module.exports = router;