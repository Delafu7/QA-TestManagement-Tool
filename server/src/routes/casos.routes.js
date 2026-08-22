const express = require('express');
const controller = require('../controllers/casos.controller');
const { requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/suites/:suiteId/casos', controller.list);
router.post('/suites/:suiteId/casos', requireRole('qa'), controller.create);
router.get('/casos/:id', controller.getById);
router.get('/casos/:id/versiones', controller.versiones);
router.patch('/casos/:id', requireRole('qa'), controller.update);
router.patch('/casos/:id/publicar', requireRole('qa'), controller.publicar);
router.patch('/casos/:id/deprecar', requireRole('qa'), controller.deprecar);
router.patch('/casos/:id/reactivar', requireRole('qa'), controller.reactivar);
router.delete('/casos/:id', requireRole('qa'), controller.remove);

module.exports = router;
