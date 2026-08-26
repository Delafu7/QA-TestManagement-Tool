const db = require('../db/connection');
const ciclosModel = require('../models/ciclos.model');
const proyectosModel = require('../models/proyectos.model');
const usuariosModel = require('../models/usuarios.model');
const { notFound } = require('../utils/errors');
const { now } = require('../utils/ids');

const buildEjecucionesExport = (cicloId) => {
  const rows = db
    .prepare(
      `SELECT
         e.id, e.caso_id AS casoId, c.titulo AS casoTitulo, s.nombre AS suiteNombre,
         c.prioridad, c.tipo, e.estado, u.nombre AS ejecutor,
         e.fecha_ejecucion AS fechaEjecucion, e.duracion_segundos AS duracionSegundos, e.comentario,
         tp.id AS tipoPruebaId, tp.nombre AS tipoPruebaNombre, tp.slug AS tipoPruebaSlug, tp.color AS tipoPruebaColor
       FROM ejecuciones e
       JOIN casos_prueba c ON c.id = e.caso_id
       JOIN suites s ON s.id = c.suite_id
       LEFT JOIN usuarios u ON u.id = e.ejecutor_id
       LEFT JOIN tipos_prueba tp ON tp.id = e.tipo_prueba_id
       WHERE e.ciclo_id = ?`
    )
    .all(cicloId);

  const resultadosStmt = db.prepare(
    `SELECT rp.estado, rp.comentario, p.orden AS pasoOrden, p.accion
     FROM resultados_paso rp
     JOIN pasos p ON p.id = rp.paso_id
     WHERE rp.ejecucion_id = ?
     ORDER BY p.orden`
  );
  const defectosStmt = db.prepare(
    `SELECT d.id, d.titulo, d.severidad, d.estado,
            dtp.id AS tipoPruebaId, dtp.nombre AS tipoPruebaNombre, dtp.slug AS tipoPruebaSlug, dtp.color AS tipoPruebaColor
     FROM defectos d
     LEFT JOIN tipos_prueba dtp ON dtp.id = d.tipo_prueba_id
     WHERE d.ejecucion_origen_id = ?`
  );

  const tipoPruebaDe = (row) =>
    row.tipoPruebaId
      ? { id: row.tipoPruebaId, nombre: row.tipoPruebaNombre, slug: row.tipoPruebaSlug, color: row.tipoPruebaColor }
      : null;

  return rows.map((row) => ({
    id: row.id,
    casoId: row.casoId,
    casoTitulo: row.casoTitulo,
    suiteNombre: row.suiteNombre,
    prioridad: row.prioridad,
    tipo: row.tipo,
    tipoPrueba: tipoPruebaDe(row),
    estado: row.estado,
    ejecutor: row.ejecutor || null,
    fechaEjecucion: row.fechaEjecucion,
    duracionSegundos: row.duracionSegundos,
    comentario: row.comentario || '',
    resultadosPaso: resultadosStmt.all(row.id),
    defectos: defectosStmt.all(row.id).map((d) => ({
      id: d.id,
      titulo: d.titulo,
      severidad: d.severidad,
      estado: d.estado,
      tipoPrueba: tipoPruebaDe(d),
    })),
  }));
};

const buildExportPayload = (cicloId, exportadoPorId) => {
  const ciclo = ciclosModel.findById(cicloId);
  if (!ciclo) throw notFound('Fase/Ciclo');
  const proyecto = proyectosModel.findById(ciclo.proyectoId);
  const resumen = ciclosModel.metricas(cicloId);
  const ejecuciones = buildEjecucionesExport(cicloId);
  const exportadoPor = usuariosModel.findById(exportadoPorId);

  return {
    ciclo: {
      id: ciclo.id,
      nombre: ciclo.nombre,
      estado: ciclo.estado,
      fechaInicio: ciclo.fechaInicio,
      fechaFinPrevista: ciclo.fechaFinPrevista,
      fechaFinReal: ciclo.fechaFinReal,
    },
    proyecto: { id: proyecto.id, nombre: proyecto.nombre },
    resumen,
    ejecuciones,
    exportadoEn: now(),
    exportadoPor: exportadoPor ? exportadoPor.nombre : null,
  };
};

const toMarkdown = (payload) => {
  const { ciclo, proyecto, resumen, ejecuciones } = payload;
  const tasaExitoPct = resumen.tasaExito !== null ? Math.round(resumen.tasaExito * 100) : 'N/D';
  const lines = [
    `# Resultados — ${ciclo.nombre}`,
    '',
    `**Proyecto:** ${proyecto.nombre}`,
    `**Estado del ciclo:** ${ciclo.estado}`,
    `**Periodo:** ${ciclo.fechaInicio} → ${ciclo.fechaFinPrevista}`,
    `**Resumen:** ${resumen.totalCasos} casos · ${resumen.passed} passed · ${resumen.failed} failed · ${resumen.blocked} blocked · ${resumen.skipped} skipped · Tasa de éxito: ${tasaExitoPct}%`,
    '',
    '| Caso | Suite | Tipo de prueba | Prioridad | Estado | Ejecutor | Fecha | Duración (s) | Defecto | Comentario |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const e of ejecuciones) {
    const defecto = e.defectos[0] ? e.defectos[0].id : '—';
    const comentario = e.comentario || '—';
    const ejecutor = e.ejecutor || '—';
    const fecha = e.fechaEjecucion ? e.fechaEjecucion.slice(0, 10) : '—';
    const duracion = e.duracionSegundos ?? '—';
    const tipoPrueba = e.tipoPrueba ? e.tipoPrueba.nombre : '—';
    lines.push(
      `| ${e.casoTitulo} | ${e.suiteNombre} | ${tipoPrueba} | ${e.prioridad} | ${e.estado} | ${ejecutor} | ${fecha} | ${duracion} | ${defecto} | ${comentario} |`
    );
  }
  return lines.join('\n') + '\n';
};

module.exports = { buildExportPayload, toMarkdown };
