# Audit — ROADMAP vs. código real (2026-08-22)

Auditoría de solo lectura del repositorio contra [docs/ROADMAP.md](ROADMAP.md) y [docs/design/](design/). Objetivo: verificar en el código qué ítems de §3 del ROADMAP siguen vigentes, y detectar riesgos no documentados.

**Nota sobre alcance:** no se encontró en el repo ningún archivo que defina "prompts 3 a 7" (se buscó `PROMPTS.md`, menciones de "prompt 3", etc., sin resultado). La sección 5 de este informe es una propuesta de secuenciación de los ítems de §3 del ROADMAP, no la recuperación de un plan preexistente.

## 1. Tabla — Estado real de §3 High/Medium priority

| Ítem del ROADMAP | Estado real | Evidencia |
|---|---|---|
| **High: Wire up `requireRole`** | No existe (sigue tal cual el ROADMAP lo describe) | `server/src/middleware/auth.middleware.js:16-21` define `requireRole` pero no aparece importado en ningún `server/src/routes/*.routes.js` (verificado por grep) |
| **High: Backups automatizados** | No existe | `docs/DEPLOYMENT.md:74` "There is **no automated backup job**" |
| **High: Suite de tests backend** | No existe (parcial: smoke test) | `server/scripts/smoke-test.js:1-42` — 2 endpoints (`/health`, `POST /api/usuarios`) + 1 aserción de auth; `server/package.json` `"test": "node scripts/smoke-test.js"` |
| **High: Suite de tests frontend** | No existe | `find` de `*.test.js`/`*.spec.js` en todo el repo: 0 resultados; `client/package.json` no tiene runner de tests (`vitest`, `jest`, etc.) |
| **High: Paginación de listados** | No existe | Server: grep de `pagination/LIMIT/OFFSET` en `server/src/models|controllers|services` no da coincidencias relevantes; Cliente: 0 coincidencias de `pagination/limit/offset` en `client/src`, todo consumidor asume `.data` = lista completa (ej. `client/src/screens/CasosPrueba/CasosListado.jsx:108`) |
| **High: Rate limiting** | No existe | `server/package.json` no incluye `express-rate-limit` ni similar; grep en `server/src/` sin coincidencias |
| **Medium: Bulk import CSV/Excel** | No existe | Sin rutas de import en ningún `*.routes.js` |
| **Medium: Full-text search** | No existe | Sin rutas `/search` ni FTS en `server/src/routes/` ni `server/src/db/schema.sql` |
| **Medium: Attachments en ejecuciones/defectos** | No existe | Sin `multer`/`upload` en `server/src/`; `defectos`/`ejecuciones` en `schema.sql:83-115` solo tienen `comentario TEXT` |
| **Medium: Comentarios/actividad en defectos** | No existe | `server/src/routes/defectos.routes.js:7-12` solo expone list/detalle/crear/asignar/resolver/verificar/reabrir, sin sub-recurso de comentarios |
| **Medium: Reportes a nivel suite/proyecto** | No existe | `server/src/routes/export.routes.js:6-8` — solo `/api/ciclos/:cicloId/export/*` |
| **Medium: Enlace a trackers externos en defectos** | No existe | `casos_prueba`/`defectos` en `schema.sql:41-53,104-115` sin campo `url`/`externalId` |
| **Medium: Notificaciones in-app** | No existe | Sin coincidencias de `notificacion/notification` en `server/src/` ni `client/src/` |
| **Medium: Toggle manual dark/light** | No existe (infra sí) | Tokens dark listos en `client/src/styles/tokens.css:47,71-72`; ningún JS/JSX llama `setAttribute('data-theme', ...)` |
| **Medium: Versionado de casos de prueba** | No existe — y es más grave de lo descrito (ver Riesgo #2) | `server/src/models/casos.model.js:67-73,110` (`replacePasos`: `DELETE FROM pasos` + reinsert); `client/src/screens/CasosPrueba/CasoFormModal.jsx:39-50` reenvía el array completo de pasos renumerado, sin IDs previos |

Los gaps de §1 del ROADMAP (paginación, `requireRole`, dark mode) están confirmados igual de vigentes con la misma evidencia de arriba.

## 2. Dashboards

Solo existe un dashboard: `client/src/screens/Dashboard/Dashboard.jsx` (170 líneas), ruta `/`.

| KPI | Origen | Servidor vs Cliente |
|---|---|---|
| Ciclos activos | `proyectosApi.getById` → `proyectoDetalle.ciclosActivos` (`Dashboard.jsx:32-35`) | Servidor: `server/src/models/proyectos.model.js:60-67` (`metricasResumen`, cuenta ciclos en estado planificada/en_progreso/bloqueada) |
| Casos activos | `proyectoDetalle.totalCasos` | Servidor: `proyectos.model.js:57-59` |
| Tasa de éxito | `ciclosApi.getById` → `cicloActivo.tasaExito`, formateado en `Dashboard.jsx:72` | Servidor calcula el ratio: `server/src/models/ciclos.model.js:69` (`passed/(passed+failed)` o `null`); cliente solo hace `Math.round(x*100)` |
| Defectos abiertos | `defectosApi.list(proyectoId, {estado:'abierto'})` → `.data.length` (`Dashboard.jsx:49-52,99`) | **Cliente-derivado**: es el `.length` de una lista filtrada, no un contador dedicado del servidor |
| Barra de avance del ciclo (segmentos passed/failed/blocked/pendiente) | `Dashboard.jsx:172-175` (`pct()`), aplicado sobre conteos crudos de `cicloActivo` | **Cliente-computado** (aritmética real sobre los conteos) — misma fórmula duplicada en `FasesTesting.jsx:13-16` |
| `tasaAvance` | `cicloActivo.tasaAvance` | Servidor: `ciclos.model.js:68`; cliente solo formatea |

Endpoints que alimentan el dashboard: `GET /api/proyectos/:id`, `GET /api/proyectos/:id/ciclos`, `GET /api/ciclos/:id`, `GET /api/proyectos/:id/defectos?estado=abierto` (dos veces, con y sin filtro). Ninguno pagina — el cliente trunca "Últimos defectos"/"Ciclos recientes" con `.slice(0,5)` client-side (`Dashboard.jsx:131,157`), no con un parámetro de servidor.

## 3. Cambios en test cases

Flujo: `client/src/screens/CasosPrueba/CasoDetalleModal.jsx` (botón "Editar", solo visible si `usuario.rol==='qa'`, línea 49) abre `CasoFormModal.jsx`, que edita `titulo, descripcion, precondiciones, prioridad, tipo, etiquetaIds, pasos`. Al guardar (`CasoFormModal.jsx:39-50`) hace `PATCH /api/casos/:id` (`client/src/api/casosApi.js:13`) reenviando **todo** el array de `pasos` renumerado (`orden: i+1`), sin los `id` originales.

En servidor, `PATCH /api/casos/:id` → `casosService.update` → `casosModel.update` (`server/src/models/casos.model.js:98-115`) llama `replacePasos` si `fields.pasos` viene presente:

```js
replacePasos = (casoId, pasos) => {
  db.prepare('DELETE FROM pasos WHERE caso_id = ?').run(casoId);   // línea 68
  ... reinsert con nuevos UUID ...                                  // líneas 69-72
}
```

**Qué se pierde:** los `id` de los pasos anteriores se destruyen y se generan nuevos; no hay historial de versiones ni diff — coincide con el ROADMAP, pero además hay un bug de integridad no listado (ver Riesgo #2).

## 4. Riesgos — 5 hallazgos graves no listados en el ROADMAP

1. **`PATCH /api/usuarios/:id` no requiere autenticación y permite auto-escalar rol.** `server/src/app.js:20-22` monta `usuariosRoutes` **antes** del middleware `identifyUser`. `usuarios.controller.js:20-22` pasa `req.body` completo a `usuariosService.update`, y `usuarios.model.js:39-50` persiste `rol` y `activo` sin ninguna validación de quién hace la petición. Resultado: cualquier request sin `X-User-Id` puede convertir a cualquier usuario en `gestor`, o reactivar un usuario dado de baja (`activo=1`). Esto hace que "wire up `requireRole`" (ROADMAP High) sea insuficiente por sí solo — primero hay que cerrar este agujero de creación/edición de usuarios sin auth.

2. **Editar los `pasos` de un caso con ejecuciones ya cerradas provoca un 500 sin manejar.** `resultados_paso.paso_id` referencia `pasos(id)` (`server/src/db/schema.sql:99`) con `PRAGMA foreign_keys = ON` (`server/src/db/connection.js:9`) y sin `ON DELETE CASCADE`. `replacePasos` (`casos.model.js:67-73`) hace `DELETE FROM pasos WHERE caso_id = ?` incondicionalmente. Si el caso ya tiene un `resultado_paso` apuntando a esos `paso_id` (cualquier ejecución `passed/failed/blocked/skipped` con pasos registrados), SQLite lanza `SQLITE_CONSTRAINT_FOREIGNKEY`; no es un `AppError`, así que `errorHandler.middleware.js:6-9` lo devuelve como `500 INTERNAL_ERROR` genérico. Esto rompe el flujo normal de "editar un caso ya ejecutado" — muy probable en producción real.

3. **El `comentario` de "bloquear ciclo" se exige pero nunca se guarda.** `ciclos.service.js` (`bloquear`) lanza `badRequest` si falta `comentario`, pero la tabla `ciclos` (`schema.sql:69-81`) no tiene columna `comentario`, y `ciclosModel.setEstado` (`ciclos.model.js:46-55`) nunca la recibe ni persiste. El diseño (`04-ui-ux.md:195`) promete al gestor un botón "Ver detalle de bloqueo" que muestra ese motivo — ese dato simplemente no existe en BD. Pérdida de datos silenciosa en cada uso de esta función.

4. **La transición `planificada → en_progreso` no exige ninguna ejecución generada**, pese a que `02-modelo-datos.md:269` lo especifica como condición ("requiere al menos 1 ejecución generada"). `ciclos.service.js` (`iniciar`) solo comprueba el mapa de estados, sin contar `ejecuciones`. Deriva del diseño sin estar recogido como gap en ROADMAP §1.

5. **Ningún consumidor del cliente lee `pagination`; todos asumen `.data` = lista completa** (confirmado: 0 coincidencias de `pagination/limit/offset` en `client/src`). El día que se implemente el ítem "paginación" del ROADMAP (High priority) sin tocar el cliente, los contadores "N casos" (`CasosListado.jsx:108`), "N ciclos" (`FasesTesting.jsx:138`) y el KPI "Defectos abiertos" del dashboard (`.data.length`) pasarán a reportar silenciosamente el tamaño de página en vez del total real — un riesgo de regresión oculto que conecta directamente con la secuenciación de §3.

## 5. Orden de ejecución propuesto (propuesta propia, no un plan preexistente)

**Prompt 3 — Corrección de bugs de integridad + hardening de seguridad** *(primero: bloquea todo lo demás y son bugs activos, no features)*
- Cerrar el agujero de auth en `/api/usuarios` (mover la ruta detrás de `identifyUser`, o separar claramente "bootstrap sin auth" de "editar usuario existente").
- Decidir la matriz real qa/gestor y cablear `requireRole`.
- Arreglar el crash de FK al editar `pasos` (bloquear edición de pasos si el caso tiene ejecuciones, o mover a un modelo de snapshot/versión).
- Añadir columna `comentario` a `ciclos` y persistirla en `bloquear`.
- (Opcional, bajo coste) Añadir el check de "≥1 ejecución" en `iniciar`.

**Prompt 4 — Suite de tests backend**
Depende de Prompt 3: si se escriben tests antes de fijar la matriz de roles y las reglas de transición corregidas, habría que rehacerlos. Cubrir máquinas de estado, reglas de integridad y el propio bug de FK como regresión.

**Prompt 5 — Paginación + rate limiting (servidor) y actualización de todos los consumidores del cliente**
Depende de Prompt 4 (para no cambiar el shape de todos los endpoints de listado sin red de seguridad). Debe incluir explícitamente el fix del Riesgo #5 en el mismo prompt, no como seguimiento.

**Prompt 6 — Suite de tests frontend**
Tiene más sentido después de Prompt 5 (para no testear un shape de API que va a cambiar) y después de Prompt 3 (para que los tests de gating por rol sean significativos).

**Prompt 7 — Backlog de producto (medium priority)**
Una vez estabilizada la base: toggle de dark mode (trivial, ya con infra lista) → versionado de casos (retoma el fix del Riesgo #2, ya no es solo "nice to have") → import masivo → búsqueda full-text → adjuntos → comentarios en defectos → reportes a nivel suite/proyecto → enlace a trackers externos. Beneficia de tener paginación (Prompt 5) ya en producción antes de construir búsqueda/import, que generan listados grandes.
