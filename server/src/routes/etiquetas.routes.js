const express = require('express');
const controller = require('../controllers/etiquetas.controller');
const { requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/proyectos/:proyectoId/etiquetas', controller.list);
router.post('/proyectos/:proyectoId/etiquetas', requireRole('qa'), controller.create);
router.delete('/etiquetas/:id', requireRole('qa'), controller.remove);

module.exports = router;
