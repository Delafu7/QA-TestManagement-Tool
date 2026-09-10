const express = require('express');
const controller = require('../controllers/tiposPrueba.controller');

const router = express.Router();

router.get('/proyectos/:proyectoId/tipos-prueba', controller.list);
router.post('/proyectos/:proyectoId/tipos-prueba', controller.create);
router.get('/tipos-prueba/:id', controller.getById);
router.patch('/tipos-prueba/:id', controller.update);
router.patch('/tipos-prueba/:id/archivar', controller.archivar);

module.exports = router;
