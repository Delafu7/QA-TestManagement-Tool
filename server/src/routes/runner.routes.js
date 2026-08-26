const express = require('express');
const controller = require('../controllers/runner.controller');
const ejecucionesController = require('../controllers/runnerEjecuciones.controller');
const { requireRole } = require('../middleware/auth.middleware');
const { requireRunnerEnabled } = require('../config/runner');

const router = express.Router();

// Sin requireRunnerEnabled: el cliente lo usa precisamente para decidir si
// mostrar el resto del panel.
router.get('/runner/status', controller.status);

router.get('/runner/comandos', requireRunnerEnabled, controller.comandos);
router.get('/runner/directorio', requireRunnerEnabled, controller.directorio);
router.post('/runner/directorio/cd', requireRunnerEnabled, controller.cambiarDirectorio);

router.get('/runner/ejecuciones', requireRunnerEnabled, ejecucionesController.list);
router.post('/runner/ejecuciones', requireRunnerEnabled, requireRole('qa'), ejecucionesController.iniciar);
router.get('/runner/ejecuciones/:id', requireRunnerEnabled, ejecucionesController.getById);
router.get('/runner/ejecuciones/:id/stream', requireRunnerEnabled, ejecucionesController.stream);
router.patch('/runner/ejecuciones/:id/abortar', requireRunnerEnabled, requireRole('qa'), ejecucionesController.abortar);

module.exports = router;
