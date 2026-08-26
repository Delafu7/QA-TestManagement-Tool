const express = require('express');
const controller = require('../controllers/tiposPrueba.controller');
const { requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/proyectos/:proyectoId/tipos-prueba', controller.list);
router.post('/proyectos/:proyectoId/tipos-prueba', requireRole('qa'), controller.create);
router.get('/tipos-prueba/:id', controller.getById);
router.patch('/tipos-prueba/:id', requireRole('qa'), controller.update);
router.patch('/tipos-prueba/:id/archivar', requireRole('qa'), controller.archivar);

module.exports = router;
