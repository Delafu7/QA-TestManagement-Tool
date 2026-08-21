# 03 — Contrato de API

## Convenciones generales

- Base path: `/api`
- Formato: JSON (`Content-Type: application/json`) en petición y respuesta.
- Fechas en ISO 8601.
- Todas las entidades y enums referencian [[02-modelo-datos]].
- Paginación en listados: query params `page` (default 1) y `pageSize` (default 20, máx 100). Respuesta envuelta:

```json
{
  "data": [ /* recursos */ ],
  "pagination": { "page": 1, "pageSize": 20, "total": 137 }
}
```

- Códigos de error comunes a todos los endpoints:

| Código | Cuándo |
|---|---|
| `400` | Payload inválido (campo faltante, tipo incorrecto, enum no reconocido) |
| `401` | Sin identificación de usuario (header `X-User-Id` ausente, ver [[08-decisiones]] sobre alcance de autenticación) |
| `403` | Rol sin permiso para la acción (p. ej. gestor intentando editar un caso) |
| `404` | Recurso no encontrado |
| `409` | Conflicto de estado (transición inválida, ver máquinas de estado en [[02-modelo-datos]]) |
| `422` | Regla de integridad violada (ej. eliminar suite con casos activos) |
| `500` | Error interno |

Cuerpo de error estándar:

```json
{
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "No se puede pasar de 'completada' a 'en_progreso'",
    "details": {}
  }
}
```

## 1. Usuarios — `/api/usuarios`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/usuarios` | Lista usuarios. Query: `rol` |
| GET | `/api/usuarios/:id` | Detalle |
| POST | `/api/usuarios` | Crear usuario |
| PATCH | `/api/usuarios/:id` | Editar (nombre, rol, activo) |

**POST payload**
```json
{ "nombre": "Ana Gómez", "email": "ana@example.com", "rol": "qa" }
```
Errores específicos: `409` si `email` ya existe.

## 2. Proyectos — `/api/proyectos`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/proyectos` | Lista. Query: `estado` |
| GET | `/api/proyectos/:id` | Detalle + métricas resumen (`totalSuites`, `totalCasos`, `ciclosActivos`) |
| POST | `/api/proyectos` | Crear |
| PATCH | `/api/proyectos/:id` | Editar |
| PATCH | `/api/proyectos/:id/archivar` | Transición a `archivado` |

**POST payload**
```json
{ "nombre": "App Móvil Banca", "descripcion": "...", "propietarioId": "u-123" }
```

## 3. Etiquetas — `/api/proyectos/:proyectoId/etiquetas`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/proyectos/:proyectoId/etiquetas` | Lista |
| POST | `/api/proyectos/:proyectoId/etiquetas` | Crear (`nombre`, `color`) |
| DELETE | `/api/etiquetas/:id` | Eliminar. `422` si está en uso y se decide bloquear (ver [[08-decisiones]]) |

## 4. Suites — `/api/proyectos/:proyectoId/suites`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/proyectos/:proyectoId/suites` | Árbol de suites (anidado por `suitePadreId`) |
| GET | `/api/suites/:id` | Detalle + `cobertura` (campo derivado, [[02-modelo-datos]] §5) |
| POST | `/api/proyectos/:proyectoId/suites` | Crear |
| PATCH | `/api/suites/:id` | Editar / mover (`suitePadreId`) |
| DELETE | `/api/suites/:id` | `422` si tiene casos `activo` asociados |

**POST payload**
```json
{ "nombre": "Autenticación", "descripcion": "...", "suitePadreId": null }
```

## 5. Casos de prueba — `/api/suites/:suiteId/casos`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/suites/:suiteId/casos` | Lista. Query: `estado`, `prioridad`, `tipo`, `etiqueta` |
| GET | `/api/casos/:id` | Detalle con `pasos` |
| POST | `/api/suites/:suiteId/casos` | Crear (estado inicial `borrador`) |
| PATCH | `/api/casos/:id` | Editar campos y/o reemplazar `pasos` |
| PATCH | `/api/casos/:id/publicar` | `borrador → activo` |
| PATCH | `/api/casos/:id/deprecar` | `activo → obsoleto` |
| PATCH | `/api/casos/:id/reactivar` | `obsoleto → activo` |
| DELETE | `/api/casos/:id` | `422` si tiene ejecuciones históricas (usar deprecar en su lugar) |

**POST payload**
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

Errores específicos: `409 INVALID_TRANSITION` en los endpoints de cambio de estado si la transición no es válida según [[02-modelo-datos]] §3.1.

## 6. Fases / Ciclos de testing — `/api/proyectos/:proyectoId/ciclos`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/proyectos/:proyectoId/ciclos` | Lista. Query: `estado` |
| GET | `/api/ciclos/:id` | Detalle + métricas derivadas (`totalCasos`, `tasaAvance`, `tasaExito`) |
| POST | `/api/proyectos/:proyectoId/ciclos` | Crear (estado inicial `planificada`) |
| POST | `/api/ciclos/:id/casos` | Asignar casos al ciclo (genera `Ejecucion` en `pendiente` por cada `casoId`) |
| PATCH | `/api/ciclos/:id/iniciar` | `planificada → en_progreso` |
| PATCH | `/api/ciclos/:id/bloquear` | `en_progreso → bloqueada` (requiere `comentario`) |
| PATCH | `/api/ciclos/:id/desbloquear` | `bloqueada → en_progreso` |
| PATCH | `/api/ciclos/:id/completar` | `en_progreso → completada` |

**POST `/ciclos/:id/casos` payload**
```json
{ "casoIds": ["c-1", "c-2", "c-3"] }
```
`422` si algún `casoId` referencia un caso `obsoleto`.

## 7. Ejecuciones — `/api/ciclos/:cicloId/ejecuciones`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/ciclos/:cicloId/ejecuciones` | Lista. Query: `estado`, `ejecutorId` |
| GET | `/api/ejecuciones/:id` | Detalle con `resultadosPaso` |
| PATCH | `/api/ejecuciones/:id/tomar` | `pendiente → en_progreso`, asigna `ejecutorId` |
| PATCH | `/api/ejecuciones/:id/resultado` | Cierra la ejecución (`passed`/`failed`/`blocked`/`skipped`) |
| PATCH | `/api/ejecuciones/:id/reintentar` | `failed`/`blocked → pendiente` |

**PATCH `/resultado` payload**
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
Errores específicos: `422` si `resultadosPaso` no cubre todos los `pasoId` del caso (regla de integridad 4 en [[02-modelo-datos]]); `409` si la ejecución no está en `en_progreso`.

## 8. Defectos — `/api/proyectos/:proyectoId/defectos`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/proyectos/:proyectoId/defectos` | Lista. Query: `estado`, `severidad` |
| GET | `/api/defectos/:id` | Detalle |
| POST | `/api/ejecuciones/:id/defectos` | Crear defecto desde una ejecución fallida |
| PATCH | `/api/defectos/:id/asignar` | `abierto → en_progreso` |
| PATCH | `/api/defectos/:id/resolver` | `en_progreso → resuelto` |
| PATCH | `/api/defectos/:id/verificar` | `resuelto → cerrado` |
| PATCH | `/api/defectos/:id/reabrir` | `resuelto → reabierto` |

**POST payload**
```json
{ "titulo": "Login no redirige tras éxito", "descripcion": "...", "severidad": "alta", "reportadoPorId": "u-123" }
```

## 9. Exportación — `/api/ciclos/:cicloId/export`

| Método | Ruta | Descripción | Respuesta |
|---|---|---|---|
| GET | `/api/ciclos/:cicloId/export/json` | Exporta resultados del ciclo | `200`, `Content-Type: application/json`, cuerpo según esquema de [[06-exportacion]] §1 |
| GET | `/api/ciclos/:cicloId/export/markdown` | Exporta tabla Markdown | `200`, `Content-Type: text/markdown`, cuerpo según plantilla de [[06-exportacion]] §2 |
| POST | `/api/ciclos/:cicloId/export/notion` | Envía resultados a una base de datos de Notion | ver payload y mapeo en [[06-exportacion]] §3 |

**POST `/export/notion` payload**
```json
{
  "notionDatabaseId": "a1b2c3d4e5f6...",
  "notionToken": "secret_..."
}
```

**POST `/export/notion` respuesta**
```json
{
  "enviados": 24,
  "fallidos": 0,
  "notionPageIds": ["page-id-1", "page-id-2"]
}
```

Errores específicos:

| Código | Causa |
|---|---|
| `400` | `notionDatabaseId` o `notionToken` ausentes |
| `502` | La API de Notion respondió con error (se retransmite `details.notionError`) |
| `504` | Timeout contactando con Notion |

`notionToken` no se persiste en la base de datos de la aplicación; se usa solo para la llamada saliente (ver riesgos en [[08-decisiones]]).

## 10. Resumen de recursos y sus prefijos

| Recurso | Prefijo base |
|---|---|
| Usuario | `/api/usuarios` |
| Proyecto | `/api/proyectos` |
| Etiqueta | `/api/proyectos/:proyectoId/etiquetas`, `/api/etiquetas/:id` |
| Suite | `/api/proyectos/:proyectoId/suites`, `/api/suites/:id` |
| Caso de prueba | `/api/suites/:suiteId/casos`, `/api/casos/:id` |
| Ciclo | `/api/proyectos/:proyectoId/ciclos`, `/api/ciclos/:id` |
| Ejecución | `/api/ciclos/:cicloId/ejecuciones`, `/api/ejecuciones/:id` |
| Defecto | `/api/proyectos/:proyectoId/defectos`, `/api/defectos/:id`, `/api/ejecuciones/:id/defectos` |
| Exportación | `/api/ciclos/:cicloId/export/*` |
