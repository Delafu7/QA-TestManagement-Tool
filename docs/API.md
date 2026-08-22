# API Reference

REST API served under `/api`, JSON in and out. This document reflects the routes and controllers actually registered in `server/src/routes/` — see [docs/DATA_MODEL.md](DATA_MODEL.md) for entity/enum definitions referenced throughout.

## Conventions

- **Base path:** `/api`
- **Content type:** `application/json` for requests with a body; `text/markdown` for the Markdown export.
- **Dates:** ISO 8601 UTC for datetimes (`2026-08-21T09:15:00Z`); plain `YYYY-MM-DD` for cycle start/end dates.
- **Authentication header:** every route except `POST /api/usuarios`, `GET /api/usuarios`, and `/health` requires `X-User-Id: <user id>` (see [Authentication](#authentication)).
- **List responses** are wrapped:

  ```json
  { "data": [ /* resources */ ] }
  ```

  (Cursor/offset pagination described in the original design docs is **not implemented** — see [docs/ROADMAP.md](ROADMAP.md).)

## Authentication

There is no login endpoint. Identity is established by:

1. `POST /api/usuarios` (no `X-User-Id` required) to create a user, or `GET /api/usuarios` to list existing ones.
2. Every subsequent request sends that user's `id` as `X-User-Id`.

| Status | When |
|---|---|
| `401 UNAUTHORIZED` | `X-User-Id` header missing, or doesn't match an active user |
| `403 FORBIDDEN` | The user's role isn't permitted to perform the action |

## Errors

Standard error body:

```json
{
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "No se puede pasar de 'completada' a 'en_progreso'",
    "details": {}
  }
}
```

| Status | `code` (example) | Meaning |
|---|---|---|
| `400` | `BAD_REQUEST` | Missing/invalid field in the payload |
| `401` | `UNAUTHORIZED` | Missing or invalid `X-User-Id` |
| `403` | `FORBIDDEN` | Role not permitted |
| `404` | `NOT_FOUND` | Resource doesn't exist |
| `409` | e.g. `INVALID_TRANSITION` | Invalid state transition, or action requires a different current state |
| `422` | e.g. integrity-rule violation code | e.g. deleting a suite with active cases |
| `502` | `NOTION_API_ERROR` | Notion API call failed (Notion export only) |
| `500` | — | Unhandled server error |

Error messages in responses are in Spanish (they come straight from the service layer) — surface `code` for programmatic handling and `message` for a human-readable fallback.

---

## Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check — `{ "status": "ok" }`. No auth required. |

## Users — `/api/usuarios`

| Method | Path | Description |
|---|---|---|
| GET | `/api/usuarios` | List. Query: `rol` |
| GET | `/api/usuarios/:id` | Detail |
| POST | `/api/usuarios` | Create. No `X-User-Id` required. |
| PATCH | `/api/usuarios/:id` | Update |

**POST body**
```json
{ "nombre": "Ana Gómez", "email": "ana@example.com", "rol": "qa", "avatarUrl": null }
```
`rol` must be `qa` or `gestor`.

## Projects — `/api/proyectos`

| Method | Path | Description |
|---|---|---|
| GET | `/api/proyectos` | List. Query: `estado` |
| GET | `/api/proyectos/:id` | Detail |
| POST | `/api/proyectos` | Create |
| PATCH | `/api/proyectos/:id` | Update (rename, edit description) |
| PATCH | `/api/proyectos/:id/archivar` | Transition to `archivado` |

**POST body**
```json
{ "nombre": "App Móvil Banca", "descripcion": "...", "propietarioId": "u-123" }
```

## Tags — `/api/proyectos/:proyectoId/etiquetas`, `/api/etiquetas/:id`

| Method | Path | Description |
|---|---|---|
| GET | `/api/proyectos/:proyectoId/etiquetas` | List |
| POST | `/api/proyectos/:proyectoId/etiquetas` | Create — body `{ "nombre", "color" }` |
| DELETE | `/api/etiquetas/:id` | Delete |

## Suites — `/api/proyectos/:proyectoId/suites`, `/api/suites/:id`

| Method | Path | Description |
|---|---|---|
| GET | `/api/proyectos/:proyectoId/suites` | Full suite tree, nested by `suitePadreId` |
| GET | `/api/suites/:id` | Detail |
| POST | `/api/proyectos/:proyectoId/suites` | Create |
| PATCH | `/api/suites/:id` | Update / move (change `suitePadreId`) |
| DELETE | `/api/suites/:id` | `422` if it has `activo` test cases attached |

**POST body**
```json
{ "nombre": "Autenticación", "descripcion": "...", "suitePadreId": null }
```

## Test cases — `/api/suites/:suiteId/casos`, `/api/casos/:id`

| Method | Path | Description |
|---|---|---|
| GET | `/api/suites/:suiteId/casos` | List. Query: `estado`, `prioridad`, `tipo`, `etiqueta` |
| GET | `/api/casos/:id` | Detail, including `pasos` |
| POST | `/api/suites/:suiteId/casos` | Create (starts in `borrador`) |
| PATCH | `/api/casos/:id` | Edit fields and/or replace `pasos` |
| PATCH | `/api/casos/:id/publicar` | `borrador → activo` |
| PATCH | `/api/casos/:id/deprecar` | `activo → obsoleto` |
| PATCH | `/api/casos/:id/reactivar` | `obsoleto → activo` |
| DELETE | `/api/casos/:id` | `422` if it has historical executions — use `deprecar` instead |

**POST body**
```json
{
  "titulo": "Login con credenciales válidas",
  "descripcion": "Verifica acceso correcto",
  "precondiciones": "Usuario registrado y activo",
  "prioridad": "alta",
  "tipo": "funcional",
  "etiquetaIds": ["et-1"],
  "autorId": "u-123",
  "pasos": [
    { "orden": 1, "accion": "Introducir email y contraseña válidos", "resultadoEsperado": "Los campos aceptan la entrada" },
    { "orden": 2, "accion": "Pulsar 'Entrar'", "resultadoEsperado": "Se redirige al dashboard" }
  ]
}
```

## Testing cycles — `/api/proyectos/:proyectoId/ciclos`, `/api/ciclos/:id`

| Method | Path | Description |
|---|---|---|
| GET | `/api/proyectos/:proyectoId/ciclos` | List. Query: `estado` |
| GET | `/api/ciclos/:id` | Detail with derived metrics (`totalCasos`, `tasaAvance`, `tasaExito`) |
| POST | `/api/proyectos/:proyectoId/ciclos` | Create (starts in `planificada`) |
| POST | `/api/ciclos/:id/casos` | Assign test cases — creates one `pendiente` execution per `casoId` |
| PATCH | `/api/ciclos/:id/iniciar` | `planificada → en_progreso` |
| PATCH | `/api/ciclos/:id/bloquear` | `en_progreso → bloqueada` — body requires `comentario` |
| PATCH | `/api/ciclos/:id/desbloquear` | `bloqueada → en_progreso` |
| PATCH | `/api/ciclos/:id/completar` | `en_progreso → completada` |

**POST body**
```json
{ "nombre": "Sprint 14 — Regresión", "descripcion": "...", "fechaInicio": "2026-09-01", "fechaFinPrevista": "2026-09-12", "responsableId": "u-123" }
```

**POST `/ciclos/:id/casos` body**
```json
{ "casoIds": ["c-1", "c-2", "c-3"] }
```
`422` if any `casoId` references an `obsoleto` case.

## Executions — `/api/ciclos/:cicloId/ejecuciones`, `/api/ejecuciones/:id`, `/api/casos/:casoId/ejecuciones`

| Method | Path | Description |
|---|---|---|
| GET | `/api/ciclos/:cicloId/ejecuciones` | List. Query: `estado`, `ejecutorId` |
| GET | `/api/casos/:casoId/ejecuciones` | Full execution history of a case across all cycles, most recent first (includes desnormalized `cicloNombre`, `ejecutorNombre`) |
| GET | `/api/ejecuciones/:id` | Detail, including `resultadosPaso` |
| PATCH | `/api/ejecuciones/:id/tomar` | `pendiente → en_progreso`; assigns `ejecutorId` to the caller |
| PATCH | `/api/ejecuciones/:id/resultado` | Closes the execution as `passed`/`failed`/`blocked`/`skipped` |
| PATCH | `/api/ejecuciones/:id/reintentar` | `failed`/`blocked → pendiente` |

**PATCH `/resultado` body**
```json
{
  "estado": "failed",
  "comentario": "Falla en el paso 2, no redirige",
  "duracionSegundos": 95,
  "resultadosPaso": [
    { "pasoId": "p-1", "estado": "pass" },
    { "pasoId": "p-2", "estado": "fail", "comentario": "Se queda en blanco" }
  ]
}
```
`422` if `resultadosPaso` doesn't cover every `pasoId` of the case; `409` if the execution isn't currently `en_progreso`.

## Defects — `/api/proyectos/:proyectoId/defectos`, `/api/defectos/:id`, `/api/ejecuciones/:id/defectos`

| Method | Path | Description |
|---|---|---|
| GET | `/api/proyectos/:proyectoId/defectos` | List. Query: `estado`, `severidad` |
| GET | `/api/defectos/:id` | Detail |
| POST | `/api/ejecuciones/:id/defectos` | File a defect from a (typically failed) execution |
| PATCH | `/api/defectos/:id/asignar` | `abierto → en_progreso` |
| PATCH | `/api/defectos/:id/resolver` | `en_progreso → resuelto` |
| PATCH | `/api/defectos/:id/verificar` | `resuelto → cerrado` |
| PATCH | `/api/defectos/:id/reabrir` | `resuelto → reabierto` |

**POST body**
```json
{ "titulo": "Login no redirige tras éxito", "descripcion": "...", "severidad": "alta", "reportadoPorId": "u-123" }
```

## Export — `/api/ciclos/:cicloId/export/*`

| Method | Path | Response |
|---|---|---|
| GET | `/api/ciclos/:cicloId/export/json` | `200`, `application/json`, downloadable (`Content-Disposition: attachment`) |
| GET | `/api/ciclos/:cicloId/export/markdown` | `200`, `text/markdown`, downloadable |
| POST | `/api/ciclos/:cicloId/export/notion` | Pushes every closed execution (`passed`/`failed`/`blocked`/`skipped`) in the cycle into a Notion database as one page each |

Both JSON and Markdown exports name the downloaded file `{project-slug}_{cycle-slug}_{yyyy-mm-dd}.{ext}`.

**POST `/export/notion` body**
```json
{ "notionDatabaseId": "a1b2c3d4e5f6...", "notionToken": "secret_..." }
```

**POST `/export/notion` response**
```json
{ "enviados": 24, "fallidos": 0, "notionPageIds": ["page-id-1", "page-id-2"] }
```

`notionToken` is used only for this outbound call and is **never persisted** in the app's database. A `401`/`404` from Notion (bad token, missing database) fails the whole request as `502 NOTION_API_ERROR`; a `429` is retried once with a 1s backoff before counting as a per-page failure.

## Resource path summary

| Resource | Base path(s) |
|---|---|
| User | `/api/usuarios` |
| Project | `/api/proyectos` |
| Tag | `/api/proyectos/:proyectoId/etiquetas`, `/api/etiquetas/:id` |
| Suite | `/api/proyectos/:proyectoId/suites`, `/api/suites/:id` |
| Test case | `/api/suites/:suiteId/casos`, `/api/casos/:id` |
| Testing cycle | `/api/proyectos/:proyectoId/ciclos`, `/api/ciclos/:id` |
| Execution | `/api/ciclos/:cicloId/ejecuciones`, `/api/ejecuciones/:id`, `/api/casos/:casoId/ejecuciones` |
| Defect | `/api/proyectos/:proyectoId/defectos`, `/api/defectos/:id`, `/api/ejecuciones/:id/defectos` |
| Export | `/api/ciclos/:cicloId/export/*` |
