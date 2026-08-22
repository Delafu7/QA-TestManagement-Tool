const express = require('express');
const controller = require('../controllers/ejecuciones.controller');
const { requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/ciclos/:cicloId/ejecuciones', controller.list);
router.get('/casos/:casoId/ejecuciones', controller.listByCaso);
router.get('/ejecuciones/:id', controller.getById);
router.patch('/ejecuciones/:id/tomar', requireRole('qa'), controller.tomar);
router.patch('/ejecuciones/:id/resultado', requireRole('qa'), controller.registrarResultado);
router.patch('/ejecuciones/:id/reintentar', requireRole('qa'), controller.reintentar);

module.exports = router;
