const express = require('express');
const controller = require('../controllers/usuarios.controller');

const router = express.Router();

router.get('/usuarios', controller.list);
router.get('/usuarios/:id', controller.getById);
router.post('/usuarios', controller.create);
router.patch('/usuarios/:id', controller.update);

module.exports = router;
