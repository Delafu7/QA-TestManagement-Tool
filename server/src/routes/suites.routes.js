const express = require('express');
const controller = require('../controllers/suites.controller');
const { requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/proyectos/:proyectoId/suites', controller.tree);
router.post('/proyectos/:proyectoId/suites', requireRole('qa'), controller.create);
router.get('/suites/:id', controller.getById);
router.patch('/suites/:id', requireRole('qa'), controller.update);
router.delete('/suites/:id', requireRole('qa'), controller.remove);

module.exports = router;
