const express = require('express');
const controller = require('../controllers/ejecuciones.controller');

const router = express.Router();

router.get('/ciclos/:cicloId/ejecuciones', controller.list);
router.get('/casos/:casoId/ejecuciones', controller.listByCaso);
router.get('/ejecuciones/:id', controller.getById);
router.patch('/ejecuciones/:id/tomar', controller.tomar);
router.patch('/ejecuciones/:id/resultado', controller.registrarResultado);
router.patch('/ejecuciones/:id/reintentar', controller.reintentar);

module.exports = router;
