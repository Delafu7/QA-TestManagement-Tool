const fetch = require('node-fetch');

const NOTION_API_BASE_URL = process.env.NOTION_API_BASE_URL || 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const buildProperties = (ejecucion, cicloNombre) => ({
  Nombre: { title: [{ text: { content: ejecucion.casoTitulo } }] },
  Suite: { rich_text: [{ text: { content: ejecucion.suiteNombre } }] },
  Prioridad: { select: { name: ejecucion.prioridad } },
  Estado: { select: { name: ejecucion.estado } },
  Ejecutor: { rich_text: [{ text: { content: ejecucion.ejecutor || '' } }] },
  ...(ejecucion.fechaEjecucion ? { Fecha: { date: { start: ejecucion.fechaEjecucion } } } : {}),
  'Duración (s)': { number: ejecucion.duracionSegundos ?? null },
  Comentario: { rich_text: [{ text: { content: ejecucion.comentario || '' } }] },
  Defecto: { rich_text: [{ text: { content: ejecucion.defectos.map((d) => d.id).join(', ') } }] },
  Ciclo: { rich_text: [{ text: { content: cicloNombre } }] },
});

const crearPagina = async ({ notionDatabaseId, notionToken, ejecucion, cicloNombre }) => {
  const response = await fetch(`${NOTION_API_BASE_URL}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: notionDatabaseId },
      properties: buildProperties(ejecucion, cicloNombre),
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || 'Error al crear la página en Notion');
    error.notionStatus = response.status;
    error.notionBody = body;
    throw error;
  }
  return body.id;
};

const crearPaginaConReintento = async (params) => {
  try {
    return await crearPagina(params);
  } catch (err) {
    if (err.notionStatus === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return crearPagina(params);
    }
    throw err;
  }
};

// Un fallo de autenticación o de base de datos no existente afecta a todo el envío por
// igual (no es un problema de una ejecución concreta), así que se propaga como error del
// lote completo en vez de contarse como "fallido" individual (ver 03-api-contract.md §9).
const ERRORES_SISTEMICOS = [401, 404];

const enviarEjecuciones = async ({ notionDatabaseId, notionToken, ejecuciones, cicloNombre }) => {
  const notionPageIds = [];
  let fallidos = 0;
  for (const ejecucion of ejecuciones) {
    try {
      const pageId = await crearPaginaConReintento({ notionDatabaseId, notionToken, ejecucion, cicloNombre });
      notionPageIds.push(pageId);
    } catch (err) {
      if (ERRORES_SISTEMICOS.includes(err.notionStatus)) throw err;
      fallidos += 1;
    }
  }
  return { enviados: notionPageIds.length, fallidos, notionPageIds };
};

module.exports = { enviarEjecuciones };
