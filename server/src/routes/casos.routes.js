const express = require('express');
const controller = require('../controllers/casos.controller');

const router = express.Router();

router.get('/suites/:suiteId/casos', controller.list);
router.post('/suites/:suiteId/casos', controller.create);
router.get('/casos/:id', controller.getById);
router.patch('/casos/:id', controller.update);
router.patch('/casos/:id/publicar', controller.publicar);
router.patch('/casos/:id/deprecar', controller.deprecar);
router.patch('/casos/:id/reactivar', controller.reactivar);
router.delete('/casos/:id', controller.remove);

module.exports = router;
