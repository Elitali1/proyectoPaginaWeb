function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tenés permiso para esta acción' });
    }
    next();
  };
}

module.exports = verificarRol;