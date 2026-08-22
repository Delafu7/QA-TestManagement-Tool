const express = require('express');
const controller = require('../controllers/usuarios.controller');
const { identifyUser } = require('../middleware/auth.middleware');

const router = express.Router();

// GET y POST quedan sin autenticar: el selector de usuario activo (08-decisiones.md §2)
// necesita poder listar y crear usuarios antes de que exista una identidad. PATCH edita
// un usuario ya existente (incluye rol/activo), así que sí requiere una identidad válida.
router.get('/usuarios', controller.list);
router.get('/usuarios/:id', controller.getById);
router.post('/usuarios', controller.create);
router.patch('/usuarios/:id', identifyUser, controller.update);

module.exports = router;
