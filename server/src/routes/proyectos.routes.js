const express = require('express');
const controller = require('../controllers/proyectos.controller');

const router = express.Router();

router.get('/proyectos', controller.list);
router.get('/proyectos/:id', controller.getById);
router.get('/proyectos/:id/casos-modificados', controller.casosModificados);
router.get('/proyectos/:id/resumen-tipos-prueba', controller.resumenPorTipoPrueba);
router.post('/proyectos', controller.create);
router.patch('/proyectos/:id', controller.update);
router.patch('/proyectos/:id/archivar', controller.archivar);

module.exports = router;
