const express = require('express');
const controller = require('../controllers/ciclos.controller');

const router = express.Router();

router.get('/proyectos/:proyectoId/ciclos', controller.list);
router.post('/proyectos/:proyectoId/ciclos', controller.create);
router.get('/ciclos/:id', controller.getById);
router.post('/ciclos/:id/casos', controller.asignarCasos);
router.patch('/ciclos/:id/iniciar', controller.iniciar);
router.patch('/ciclos/:id/bloquear', controller.bloquear);
router.patch('/ciclos/:id/desbloquear', controller.desbloquear);
router.patch('/ciclos/:id/completar', controller.completar);

module.exports = router;
