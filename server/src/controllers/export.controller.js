const exportService = require('../services/export.service');
const notionClient = require('../integrations/notion.client');
const asyncHandler = require('../utils/asyncHandler');
const { badRequest, AppError } = require('../utils/errors');
const { slugify } = require('../utils/slug');

const nombreArchivo = (payload, extension) =>
  `${slugify(payload.proyecto.nombre)}_${slugify(payload.ciclo.nombre)}_${payload.exportadoEn.slice(0, 10)}.${extension}`;

const exportJson = asyncHandler(async (req, res) => {
  const payload = exportService.buildExportPayload(req.params.cicloId, req.usuarioId);
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(payload, 'json')}"`);
  res.json(payload);
});

const exportMarkdown = asyncHandler(async (req, res) => {
  const payload = exportService.buildExportPayload(req.params.cicloId, req.usuarioId);
  const markdown = exportService.toMarkdown(payload);
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(payload, 'md')}"`);
  res.send(markdown);
});

const exportNotion = asyncHandler(async (req, res) => {
  const { notionDatabaseId, notionToken } = req.body;
  if (!notionDatabaseId || !notionToken) {
    throw badRequest('notionDatabaseId y notionToken son obligatorios');
  }

  const payload = exportService.buildExportPayload(req.params.cicloId, req.usuarioId);
  const ejecucionesConResultado = payload.ejecuciones.filter((e) =>
    ['passed', 'failed', 'blocked', 'skipped'].includes(e.estado)
  );

  try {
    const resultado = await notionClient.enviarEjecuciones({
      notionDatabaseId,
      notionToken,
      ejecuciones: ejecucionesConResultado,
      cicloNombre: payload.ciclo.nombre,
    });
    res.json(resultado);
  } catch (err) {
    throw new AppError(502, 'NOTION_API_ERROR', 'Error al contactar con la API de Notion', {
      notionError: err.notionBody || err.message,
    });
  }
});

module.exports = { exportJson, exportMarkdown, exportNotion };
