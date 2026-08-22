# Historias de usuario

Basado en el backlog priorizado de [docs/ROADMAP.md](ROADMAP.md) §3 ("High priority" y "Medium priority"). Cada historia referencia el modelo de datos y contrato de API existentes en [docs/design/](design/) cuando aplica. Donde el ítem carece de una decisión de producto (ver ROADMAP §4 y las notas `[verificar]`/"fuera de esta iteración" de `docs/design/08-decisiones.md`), se marca explícitamente en vez de inventar la respuesta.

---

### US-01 — Backups automáticos del volumen SQLite
**Como** gestor **quiero** que los datos del proyecto se respalden automáticamente **para** no perder el historial de casos, ejecuciones y defectos si se pierde el volumen `sqlite-data`

**Origen:** ROADMAP §3 High priority — Automated backups for the SQLite volume

**Criterios de aceptación:**
- Dado que el servidor está en marcha con posibles escrituras en curso, cuando se ejecuta el proceso de backup, entonces usa el método de copia en caliente de SQLite (`.backup()` / `VACUUM INTO`) en vez de copiar el archivo `.sqlite` directamente (ver [[08-decisiones]] §15).
- Dado que se genera un backup, cuando se completa, entonces el archivo resultante se guarda fuera del volumen `sqlite-data` que respalda, de modo que un `docker volume rm` accidental sobre `sqlite-data` no destruye también las copias.
- Dado un backup que falla (p. ej. sin espacio en disco), cuando ocurre el fallo, entonces queda registrado como línea NDJSON en los logs del servidor, igual que el resto de errores de aplicación (ver `DEPLOYMENT.md` "Logging & the ELK pipeline").
- Dado un backup completado con éxito, cuando se restaura ese archivo en una instancia limpia de `better-sqlite3`, entonces contiene el mismo número de filas en `usuarios`, `proyectos`, `casos_prueba` y `ejecuciones` que la base de datos original en el momento del backup.

**Resuelto (2026-08-22):** frecuencia diaria vía crontab del host (no un contenedor/cron nuevo en `docker-compose.yml`); retención de las 7 copias más recientes; destino local (`./backups/` en el host, fuera del volumen `sqlite-data`), sin copia offsite — no hay infraestructura de almacenamiento externo en el proyecto. Implementado en `scripts/backup.sh` + `server/scripts/backup.js`, documentado en [docs/DEPLOYMENT.md#backups](DEPLOYMENT.md#backups).

**Fuera de alcance:** restauración automática/con un clic desde un backup (el comando manual de restore ya existe en `DEPLOYMENT.md`); cifrado de los archivos de backup (el cifrado en reposo está fuera de alcance general, ROADMAP §2); copia offsite.

**Dependencias:** ninguna

**Tamaño:** S

---

### US-02 — Suite de pruebas de frontend
**Como** gestor **quiero** que el frontend cuente con una suite de pruebas automatizada de componentes e interacción **para** tener confianza de que un cambio en la interfaz no rompe las pantallas que superviso a diario (dashboard, cobertura, resultados)

**Origen:** ROADMAP §3 High priority — Frontend test suite

**Criterios de aceptación:**
- Dado un cambio en el código de `client/`, cuando se ejecuta la suite de pruebas de frontend, entonces el proceso falla si alguna prueba de componente/interacción falla, de forma análoga a como `npm test` ya falla el pipeline en el backend (ver `DEVELOPMENT.md` "Linting & CI").
- Dado el flujo de "Selección de usuario" descrito en [[04-ui-ux]] §3, cuando se ejecuta la suite, entonces existe al menos una prueba automatizada que cubre la selección de usuario y la llegada al Dashboard.
- Dado un usuario con rol `gestor` que intenta acceder a `/ciclos/:id/ejecutar` (pantalla exclusiva de `qa` según [[04-ui-ux]] §6), cuando se ejecuta la suite, entonces existe una prueba que verifica la redirección a "Vista de fases".
- Dado el bloque de exportación de la pantalla "Resultados" ([[04-ui-ux]] §8), cuando se ejecuta la suite, entonces existe al menos una prueba de interacción que cubre los tres botones de exportación (JSON, Markdown, Enviar a Notion).
- Dado que la suite se integra en CI, cuando se abre un pull request contra `master`/`main`, entonces el job de frontend en `.github/workflows/ci.yml` ejecuta esta suite además de `lint` y `build`.

**Fuera de alcance:** pruebas end-to-end contra un backend real desplegado (se asume mocking/stub de la API); fijar un umbral mínimo de cobertura de código.

**Dependencias:** ninguna

**Tamaño:** M

---

### US-03 — Importación masiva de casos de prueba
**Como** qa **quiero** importar casos de prueba existentes desde un archivo **para** no tener que recrearlos manualmente al migrar desde una hoja de cálculo u otra herramienta

**Origen:** ROADMAP §3 Medium priority — Bulk import of test cases (CSV/Excel)

**Criterios de aceptación:**
- Dado un archivo de importación con una fila cuyo campo obligatorio `prioridad` está vacío, cuando se procesa la importación, entonces esa fila se rechaza y se reporta como error, sin crear el caso (campo obligatorio según [[02-modelo-datos]] §1.5).
- Dado un archivo de importación con una fila sin ningún paso definido, cuando se procesa esa fila, entonces se rechaza porque un caso de prueba requiere mínimo 1 paso ([[02-modelo-datos]] §1.5).
- Dado un archivo de importación con filas válidas, cuando se completa la importación, entonces cada caso de prueba creado queda en estado `borrador`, igual que al crearlo individualmente vía `POST /api/suites/:suiteId/casos` ([[03-api-contract]] §5).
- Dado un archivo con N filas válidas y M filas inválidas, cuando finaliza el proceso, entonces la respuesta indica cuántas filas se crearon y cuántas se rechazaron, con el motivo de cada rechazo.

**Pregunta abierta bloqueante:** ROADMAP §4 registra como no confirmado si esta funcionalidad es necesaria en absoluto ("¿Se necesita importar casos de prueba desde un CSV/Excel existente?"). Además, ni ROADMAP ni `docs/design/` especifican qué formato(s) de archivo se soportan (CSV, Excel, o ambos) ni el mapeo de columnas a los campos de Caso de prueba — no puede diseñarse el parser sin esa decisión.

**Fuera de alcance:** mapeo de columnas configurable por el usuario; deduplicación frente a casos ya existentes; importación de la jerarquía de suites.

**Dependencias:** ninguna

**Tamaño:** M

---

### US-04 — Búsqueda de texto completo
**Como** qa **quiero** buscar por texto entre casos de prueba, suites y defectos **para** encontrar algo sin tener que filtrar suite por suite o proyecto por proyecto

**Origen:** ROADMAP §3 Medium priority — Full-text search across test cases/suites/defects

**Criterios de aceptación:**
- Dado un caso de prueba con título "Login con credenciales válidas", cuando se busca el término "credenciales", entonces ese caso aparece en los resultados.
- Dado un término de búsqueda que no coincide con ningún título de caso, nombre de suite o título de defecto, cuando se ejecuta la búsqueda, entonces la respuesta es una lista vacía, no un error.
- Dado un usuario con rol `gestor` (solo lectura salvo exportación, [[04-ui-ux]] §1), cuando ejecuta una búsqueda, entonces obtiene resultados de solo lectura, sin acciones de edición sobre ellos.
- Dado que los resultados de una búsqueda abarcan más elementos que `pageSize`, cuando se solicita la página siguiente, entonces la respuesta sigue el mismo contrato de paginación que el resto de listados (`{ data, pagination: { page, pageSize, total } }`, [[03-api-contract]]).

**Pregunta abierta bloqueante:** ni ROADMAP ni `docs/design/` especifican si la búsqueda cubre solo los campos "nombre"/"título" de cada entidad, o también campos de texto libre como `descripcion` y `comentario` — sin esa decisión no puede fijarse qué constituye una coincidencia válida.

**Fuera de alcance:** búsqueda difusa/tolerante a errores tipográficos; ranking de relevancia entre resultados de distinto tipo.

**Dependencias:** ninguna

**Tamaño:** M

---

### US-05 — Adjuntos en ejecuciones y defectos
**Como** qa **quiero** adjuntar archivos (capturas, logs) a una ejecución fallida/bloqueada o a un defecto **para** dejar evidencia además de un comentario de texto

**Origen:** ROADMAP §3 Medium priority — Attachments on executions and defects (screenshots, logs)

**Criterios de aceptación:**
- Dado una ejecución en estado `failed`, cuando el ejecutor le adjunta un archivo, entonces el archivo queda asociado a esa ejecución y es recuperable posteriormente desde su detalle (`GET /api/ejecuciones/:id`).
- Dado una ejecución en estado `blocked`, cuando se le adjunta un archivo, entonces el comportamiento es el mismo que para `failed`.
- Dado un defecto abierto, cuando se le adjunta un archivo, entonces aparece listado en el detalle de ese defecto (`GET /api/defectos/:id`).
- Dado un ciclo con ejecuciones que tienen adjuntos, cuando se genera su exportación JSON o Markdown ([[06-exportacion]] §1–§2), entonces los adjuntos no se incluyen en el archivo exportado, ya que el esquema de exportación documentado no contempla ese campo.

**Pregunta abierta bloqueante:** ni ROADMAP ni `docs/design/` especifican los tipos de archivo permitidos, el tamaño máximo por adjunto, ni si se permite adjuntar en ejecuciones que no están en `failed`/`blocked` (p. ej. `passed` o `pendiente`) — bloquea el diseño del endpoint de subida.

**Fuera de alcance:** adjuntos a nivel de paso individual (`ResultadoPaso`); edición o reemplazo de un adjunto ya subido; envío de adjuntos a Notion.

**Dependencias:** ninguna

**Tamaño:** M

---

### US-06 — Comentarios en defectos
**Como** qa **quiero** añadir comentarios a un defecto además de sus cambios de estado **para** discutir su seguimiento con quien más lo trabaja

**Origen:** ROADMAP §3 Medium priority — Comments/activity feed on defects

**Criterios de aceptación:**
- Dado un defecto existente, cuando un usuario autorizado añade un comentario de texto, entonces el comentario queda visible en el detalle del defecto junto con su autor y fecha de creación.
- Dado un defecto con 3 comentarios guardados, cuando se consulta su detalle, entonces se devuelven los 3 comentarios asociados.
- Dado un defecto con comentarios que pasa de `resuelto` a `reabierto` ([[02-modelo-datos]] §3.4), cuando ocurre esa transición, entonces los comentarios previos siguen visibles y no se eliminan.

**Pregunta abierta bloqueante:** ni ROADMAP ni `docs/design/` especifican si el rol `gestor` puede comentar, dado que su acceso es de solo lectura salvo exportación ([[04-ui-ux]] §1); tampoco si se permite comentar un defecto ya en estado `cerrado`.

**Fuera de alcance:** edición o borrado de un comentario ya publicado; menciones (`@usuario`) o notificaciones a partir de un comentario.

**Dependencias:** ninguna

**Tamaño:** S

---

### US-07 — Informes a nivel de suite y de proyecto
**Como** gestor **quiero** un informe agregado a nivel de suite o de proyecto, no solo por ciclo **para** ver el estado global de las pruebas sin tener que sumar manualmente el resultado de cada ciclo

**Origen:** ROADMAP §3 Medium priority — Suite-level and project-level reports (not just per-cycle export)

**Criterios de aceptación:**
- Dado un proyecto con varios ciclos, cuando se solicita el informe a nivel de proyecto, entonces incluye datos agregados de todos los ciclos del proyecto, no solo del ciclo actualmente `en_progreso`.
- Dado un ciclo del proyecto sin ejecuciones asignadas, cuando se genera el informe de proyecto, entonces ese ciclo se refleja con sus contadores en cero, de forma consistente con el comportamiento ya definido para la exportación de un ciclo vacío ([[06-exportacion]] §8).
- Dado un proyecto sin ningún ciclo creado todavía, cuando se solicita su informe, entonces la respuesta indica cero ciclos y cero ejecuciones en vez de fallar.

**Pregunta abierta bloqueante:** ni ROADMAP ni `docs/design/` definen en qué formato(s) se entrega este informe (¿los mismos JSON/Markdown/Notion que la exportación por ciclo, o solo alguno?), ni cómo se calcularía una métrica de "cobertura" o "tasa de éxito" a nivel de suite, dado que hoy `suite.cobertura` ([[02-modelo-datos]] §5) solo está definida por ciclo, no acumulada entre ciclos.

**Fuera de alcance:** filtrar el informe de proyecto por rango de fechas; envío del informe de proyecto a Notion.

**Dependencias:** ninguna

**Tamaño:** M

---

### US-08 — Enlace de defectos a trackers externos
**Como** qa **quiero** guardar una referencia (URL o ID) a un ticket de Jira o GitHub Issues en un defecto **para** vincularlo con el seguimiento que ya usa el equipo, sin montar una integración completa

**Origen:** ROADMAP §3 Medium priority — Defect linking to external trackers (Jira, GitHub Issues) by URL/ID

**Criterios de aceptación:**
- Dado un defecto existente, cuando se le añade una referencia externa (URL o ID), entonces esa referencia queda guardada y visible en el detalle del defecto.
- Dado un defecto con una referencia externa ya guardada, cuando se solicita su detalle, entonces la referencia se devuelve como parte de los datos del defecto, sin realizar ninguna llamada a la API de Jira/GitHub.
- Dado un defecto sin referencia externa, cuando se consulta su detalle, entonces el campo de referencia aparece vacío/`null`, sin error.
- Dado que se guarda una referencia externa, cuando ocurre el guardado, entonces no se dispara ninguna sincronización de estado hacia el tracker externo (alcance explícitamente limitado a "solo almacenar una referencia, sin sync API").

**Pregunta abierta bloqueante:** ni ROADMAP ni `docs/design/` especifican si un defecto admite una única referencia externa o varias.

**Fuera de alcance:** validar que la URL/ID corresponde a un issue real y accesible en Jira/GitHub; sincronizar el estado del defecto con el estado del ticket externo.

**Dependencias:** ninguna

**Tamaño:** S

---

### US-09 — Notificaciones in-app
**Como** qa **quiero** recibir notificaciones dentro de la aplicación cuando se me asigna una ejecución o se reabre un defecto que reporté **para** enterarme sin tener que revisar cada pantalla manualmente

**Origen:** ROADMAP §3 Medium priority — In-app notifications ("you were assigned an execution", "a defect you reported was reopened")

**Criterios de aceptación:**
- Dado un usuario `qa` al que se le asigna `ejecutorId` en una ejecución (`PATCH /api/ejecuciones/:id/tomar`, [[03-api-contract]] §7), cuando ocurre esa asignación, entonces recibe una notificación in-app referida a esa ejecución.
- Dado un defecto reportado por un usuario que pasa de `resuelto` a `reabierto` ([[02-modelo-datos]] §3.4), cuando ocurre esa transición, entonces el usuario en `reportadoPorId` recibe una notificación in-app.
- Dado un usuario con notificaciones pendientes, cuando las marca como leídas, entonces dejan de contarse como pendientes en la siguiente consulta.
- Dado un usuario sin notificaciones, cuando consulta su lista de notificaciones, entonces recibe una lista vacía, no un error.

**Pregunta abierta bloqueante:** ni ROADMAP ni `docs/design/` especifican el mecanismo de entrega (sondeo/polling vs. conexión en tiempo real) ni durante cuánto tiempo se conserva una notificación ya leída.

**Fuera de alcance:** notificaciones por email o push fuera de la aplicación (integraciones adicionales están explícitamente fuera de alcance, ROADMAP §2).

**Dependencias:** ninguna

**Tamaño:** M

---

### US-10 — Alternar manualmente entre tema claro y oscuro
**Como** gestor **quiero** un interruptor manual de tema claro/oscuro **para** no depender solo de la preferencia del sistema operativo

**Origen:** ROADMAP §3 Medium priority — Manual dark/light theme toggle

**Criterios de aceptación:**
- Dado un usuario que no ha establecido ninguna preferencia manual, cuando carga la aplicación, entonces el tema sigue la preferencia del sistema operativo, igual que el comportamiento actual (ROADMAP §1).
- Dado un usuario que activa el interruptor de tema oscuro, cuando lo hace, entonces la interfaz aplica el token `[data-theme='dark']` ya definido en `client/src/styles/tokens.css` sin necesidad de recargar la página.
- Dado un usuario que eligió manualmente un tema, cuando cierra y vuelve a abrir la aplicación, entonces se mantiene esa elección manual en vez de volver a seguir la preferencia del sistema.

**Pregunta abierta bloqueante:** ROADMAP §4 registra como no confirmado si el modo oscuro manual es necesario para el próximo release o si puede seguir dependiendo solo de la preferencia del sistema ("¿Es necesario un modo oscuro desde el primer lanzamiento?") — esta historia no debería priorizarse hasta resolver esa pregunta. Tampoco se especifica si debe existir una tercera opción "seguir al sistema" además de claro/oscuro fijos.

**Fuera de alcance:** temas personalizados más allá de claro/oscuro; sincronizar la preferencia de tema entre distintos navegadores del mismo usuario.

**Dependencias:** ninguna

**Tamaño:** S

---

### US-11 — Versionado / historial de cambios de un caso de prueba
**Como** qa **quiero** conservar el historial de versiones de los pasos de un caso de prueba al editarlo **para** poder auditar cómo evolucionó el caso, no solo su estado actual

**Origen:** ROADMAP §3 Medium priority — Test case versioning / change history

**Criterios de aceptación:**
- Dado un caso de prueba `activo` cuyos pasos se editan, cuando se guarda la edición, entonces la versión anterior de los pasos queda conservada y consultable, en vez de sobrescribirse sin dejar rastro (hoy la transición `activo → activo : editar` de [[02-modelo-datos]] §3.1 no persiste versión previa).
- Dado un caso de prueba con varias ediciones históricas, cuando se consulta su historial de versiones, entonces cada versión indica quién la guardó y cuándo, siguiendo el mismo patrón de autoría que el resto del modelo (`autorId`/`creadoEn`).
- Dado una ejecución ya cerrada que se creó cuando el caso tenía una versión anterior de pasos, cuando el caso se edita después, entonces esa ejecución sigue mostrando `resultadosPaso` tal como eran en el momento en que se creó (coherente con la regla de integridad 4 de [[02-modelo-datos]] §4).
- Dado un caso de prueba `obsoleto`, cuando se consulta su historial de versiones, entonces sigue siendo accesible aunque el caso ya no esté `activo`, igual que su historial de ejecuciones ([[04-ui-ux]] §5).

**Pregunta abierta bloqueante:** ni ROADMAP ni `docs/design/` especifican si el historial de versiones debe cubrir solo el campo `pasos` o también otros campos editables del caso (título, prioridad, tipo, etiquetas), ni si debe mostrarse un diff visual entre versiones.

**Fuera de alcance:** revertir (rollback) a una versión anterior; comparación visual (diff) entre versiones.

**Dependencias:** ninguna

**Tamaño:** M

---

## Índice

| ID | Título | Rol | Prioridad | Tamaño | Dependencias |
|---|---|---|---|---|---|
| US-01 | Backups automáticos del volumen SQLite | gestor | High | S | ninguna |
| US-02 | Suite de pruebas de frontend | gestor | High | M | ninguna |
| US-03 | Importación masiva de casos de prueba | qa | Medium | M | ninguna |
| US-04 | Búsqueda de texto completo | qa | Medium | M | ninguna |
| US-05 | Adjuntos en ejecuciones y defectos | qa | Medium | M | ninguna |
| US-06 | Comentarios en defectos | qa | Medium | S | ninguna |
| US-07 | Informes a nivel de suite y de proyecto | gestor | Medium | M | ninguna |
| US-08 | Enlace de defectos a trackers externos | qa | Medium | S | ninguna |
| US-09 | Notificaciones in-app | qa | Medium | M | ninguna |
| US-10 | Alternar manualmente entre tema claro y oscuro | gestor | Medium | S | ninguna |
| US-11 | Versionado / historial de cambios de un caso de prueba | qa | Medium | M | ninguna |
