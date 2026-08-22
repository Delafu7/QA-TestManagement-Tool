const express = require('express');
const controller = require('../controllers/ciclos.controller');
const { requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/proyectos/:proyectoId/ciclos', controller.list);
router.post('/proyectos/:proyectoId/ciclos', requireRole('qa'), controller.create);
router.get('/ciclos/:id', controller.getById);
router.get('/ciclos/:id/cobertura', controller.coberturaPorSuite);
router.post('/ciclos/:id/casos', requireRole('qa'), controller.asignarCasos);
router.patch('/ciclos/:id/iniciar', requireRole('qa'), controller.iniciar);
router.patch('/ciclos/:id/bloquear', requireRole('qa'), controller.bloquear);
router.patch('/ciclos/:id/desbloquear', requireRole('qa'), controller.desbloquear);
router.patch('/ciclos/:id/completar', requireRole('qa'), controller.completar);

module.exports = router;
