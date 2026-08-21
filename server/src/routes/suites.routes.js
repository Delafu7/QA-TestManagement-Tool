const express = require('express');
const controller = require('../controllers/suites.controller');

const router = express.Router();

router.get('/proyectos/:proyectoId/suites', controller.tree);
router.post('/proyectos/:proyectoId/suites', controller.create);
router.get('/suites/:id', controller.getById);
router.patch('/suites/:id', controller.update);
router.delete('/suites/:id', controller.remove);

module.exports = router;
