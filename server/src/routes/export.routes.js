const express = require('express');
const controller = require('../controllers/export.controller');

const router = express.Router();

router.get('/ciclos/:cicloId/export/json', controller.exportJson);
router.get('/ciclos/:cicloId/export/markdown', controller.exportMarkdown);
router.post('/ciclos/:cicloId/export/notion', controller.exportNotion);

module.exports = router;
