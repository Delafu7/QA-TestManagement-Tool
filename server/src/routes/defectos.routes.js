const express = require('express');
const controller = require('../controllers/defectos.controller');

const router = express.Router();

router.get('/proyectos/:proyectoId/defectos', controller.list);
router.get('/defectos/:id', controller.getById);
router.post('/ejecuciones/:id/defectos', controller.createFromEjecucion);
router.patch('/defectos/:id/asignar', controller.asignar);
router.patch('/defectos/:id/resolver', controller.resolver);
router.patch('/defectos/:id/verificar', controller.verificar);
router.patch('/defectos/:id/reabrir', controller.reabrir);

module.exports = router;
