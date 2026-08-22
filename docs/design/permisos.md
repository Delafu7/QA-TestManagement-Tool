# Permisos — Matriz de autorización por rol

Documenta la autorización aplicada por `requireRole` ([[08-decisiones]] §2) sobre las rutas mutadoras de la API, complementando el resumen de perfiles de [[04-ui-ux]] §1. Toda ruta que muta estado pasa por `identifyUser` (401 si falta o no es válido `X-User-Id`) y, salvo que la tabla diga lo contrario, por `requireRole('qa')` (403 si el rol no coincide). Las rutas de solo lectura (`GET`) no están en esta tabla: ambos roles tienen acceso de lectura completo.

Formato de error 403 (consistente con el resto de la API, ver `server/src/utils/errors.js`):

```json
{ "error": { "code": "FORBIDDEN", "message": "El rol del usuario no tiene permiso para esta acción" } }
```

## Matriz

| Recurso | Acción | Método + ruta | qa | gestor |
|---|---|---|---|---|
| Proyectos | Crear | `POST /api/proyectos` | ✅ | ❌ |
| Proyectos | Editar | `PATCH /api/proyectos/:id` | ✅ | ❌ |
| Proyectos | Archivar | `PATCH /api/proyectos/:id/archivar` | ✅ | ❌ |
| Etiquetas | Crear | `POST /api/proyectos/:proyectoId/etiquetas` | ✅ | ❌ |
| Etiquetas | Eliminar | `DELETE /api/etiquetas/:id` | ✅ | ❌ |
| Suites | Crear | `POST /api/proyectos/:proyectoId/suites` | ✅ | ❌ |
| Suites | Editar | `PATCH /api/suites/:id` | ✅ | ❌ |
| Suites | Eliminar | `DELETE /api/suites/:id` | ✅ | ❌ |
| Casos | Crear | `POST /api/suites/:suiteId/casos` | ✅ | ❌ |
| Casos | Editar | `PATCH /api/casos/:id` | ✅ | ❌ |
| Casos | Publicar | `PATCH /api/casos/:id/publicar` | ✅ | ❌ |
| Casos | Deprecar | `PATCH /api/casos/:id/deprecar` | ✅ | ❌ |
| Casos | Reactivar | `PATCH /api/casos/:id/reactivar` | ✅ | ❌ |
| Casos | Eliminar | `DELETE /api/casos/:id` | ✅ | ❌ |
| Ciclos | Crear | `POST /api/proyectos/:proyectoId/ciclos` | ✅ | ❌ |
| Ciclos | Asignar casos | `POST /api/ciclos/:id/casos` | ✅ | ❌ |
| Ciclos | Iniciar | `PATCH /api/ciclos/:id/iniciar` | ✅ | ❌ |
| Ciclos | Bloquear | `PATCH /api/ciclos/:id/bloquear` | ✅ | ❌ |
| Ciclos | Desbloquear | `PATCH /api/ciclos/:id/desbloquear` | ✅ | ❌ |
| Ciclos | Completar | `PATCH /api/ciclos/:id/completar` | ✅ | ❌ |
| Ejecuciones | Tomar | `PATCH /api/ejecuciones/:id/tomar` | ✅ | ❌ |
| Ejecuciones | Registrar resultado | `PATCH /api/ejecuciones/:id/resultado` | ✅ | ❌ |
| Ejecuciones | Reintentar | `PATCH /api/ejecuciones/:id/reintentar` | ✅ | ❌ |
| Defectos | Crear desde ejecución | `POST /api/ejecuciones/:id/defectos` | ✅ | ❌ |
| Defectos | Asignar | `PATCH /api/defectos/:id/asignar` | ✅ | ❌ |
| Defectos | Resolver | `PATCH /api/defectos/:id/resolver` | ✅ | ❌ |
| Defectos | Verificar | `PATCH /api/defectos/:id/verificar` | ✅ | ❌ |
| Defectos | Reabrir | `PATCH /api/defectos/:id/reabrir` | ✅ | ❌ |
| Export | JSON | `GET /api/ciclos/:cicloId/export/json` | ✅ | ✅ |
| Export | Markdown | `GET /api/ciclos/:cicloId/export/markdown` | ✅ | ✅ |
| Export | Notion | `POST /api/ciclos/:cicloId/export/notion` | ✅ | ✅ |
| Usuarios | Ver / listar | `GET /api/usuarios`, `GET /api/usuarios/:id` | ✅ | ✅ |
| Usuarios | Crear | `POST /api/usuarios` | sin autenticar (bootstrap del selector, [[08-decisiones]] §2) | sin autenticar |
| Usuarios | Editar (nombre, email, rol, activo) | `PATCH /api/usuarios/:id` | ❌ | ✅ |

## Notas

- **Export es la única acción mutadora del gestor**: coincide con [[04-ui-ux]] §1 ("El gestor tiene acceso de solo lectura salvo en exportación") y con la pantalla de ejecución de ciclo ([[04-ui-ux]] "única pantalla de ejecución en la que el gestor tiene acciones activas").
- **`PATCH /api/usuarios/:id` requiere rol `gestor`**, no `qa`, a diferencia de todo el resto de la tabla. Es la excepción intencional: antes de esta matriz, el endpoint solo exigía una identidad válida (`identifyUser`) sin chequear rol, así que un `qa` podía editar su propio registro (o el de cualquiera) y auto-promocionarse a `gestor` cambiando `rol`. Al exigir `requireRole('gestor')`, solo un `gestor` puede dar de alta/baja usuarios o cambiar roles. Efecto secundario: un `qa` tampoco puede editar su propio nombre/email por este endpoint — no existe hoy un endpoint de auto-edición de perfil separado del de administración.
- **`POST /api/usuarios` y `GET /api/usuarios` quedan sin autenticar deliberadamente**: son el arranque del selector de usuario activo ([[08-decisiones]] §2), que necesita listar/crear usuarios antes de que exista una identidad (`X-User-Id`) que verificar.
- La UI (`client/src/`) oculta o deshabilita en pantalla las acciones que esta tabla marca como ❌ para el rol activo, como defensa en profundidad — nunca como sustituto de esta autorización de backend.
