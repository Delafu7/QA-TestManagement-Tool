const express = require('express');
const controller = require('../controllers/defectos.controller');
const { requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/proyectos/:proyectoId/defectos', controller.list);
router.get('/defectos/:id', controller.getById);
router.post('/ejecuciones/:id/defectos', requireRole('qa'), controller.createFromEjecucion);
router.post('/proyectos/:proyectoId/defectos', requireRole('qa'), controller.createStandalone);
router.patch('/defectos/:id/asignar', requireRole('qa'), controller.asignar);
router.patch('/defectos/:id/resolver', requireRole('qa'), controller.resolver);
router.patch('/defectos/:id/verificar', requireRole('qa'), controller.verificar);
router.patch('/defectos/:id/reabrir', requireRole('qa'), controller.reabrir);

module.exports = router;
