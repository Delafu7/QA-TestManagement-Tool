const express = require('express');
const controller = require('../controllers/etiquetas.controller');

const router = express.Router();

router.get('/proyectos/:proyectoId/etiquetas', controller.list);
router.post('/proyectos/:proyectoId/etiquetas', controller.create);
router.delete('/etiquetas/:id', controller.remove);

module.exports = router;
