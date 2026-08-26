const express = require('express');

const router = express.Router();

router.use(require('./proyectos.routes'));
router.use(require('./tiposPrueba.routes'));
router.use(require('./etiquetas.routes'));
router.use(require('./suites.routes'));
router.use(require('./casos.routes'));
router.use(require('./ciclos.routes'));
router.use(require('./ejecuciones.routes'));
router.use(require('./defectos.routes'));
router.use(require('./export.routes'));

module.exports = router;
