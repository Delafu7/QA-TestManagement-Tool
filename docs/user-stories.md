# Historias de usuario

Basado en el backlog priorizado de [docs/ROADMAP.md](ROADMAP.md) §3 ("High priority" y "Medium priority"). Cada historia referencia el modelo de datos y contrato de API existentes en [docs/design/](design/) cuando aplica. Donde el ítem carece de una decisión de producto (ver ROADMAP §4 y las notas `[verificar]`/"fuera de esta iteración" de `docs/design/08-decisiones.md`), se marca explícitamente en vez de inventar la respuesta.

> **Nota (2026-09-10) — single-user.** La herramienta ya no tiene usuarios ni roles (ver [ROADMAP §1](ROADMAP.md)). Donde una historia dice "Como gestor" o "Como qa", léase **"Como usuario"** (el único operador local). Los criterios de aceptación que verificaban gating o redirección por rol ya no aplican y están tachados abajo.

---

### US-01 — Backups automáticos del volumen SQLite
**Como** usuario **quiero** que los datos del proyecto se respalden automáticamente **para** no perder el historial de casos, ejecuciones y defectos si se pierde el volumen `sqlite-data`

**Origen:** ROADMAP §3 High priority — Automated backups for the SQLite volume

**Criterios de aceptación:**
- Dado que el servidor está en marcha con posibles escrituras en curso, cuando se ejecuta el proceso de backup, entonces usa el método de copia en caliente de SQLite (`.backup()` / `VACUUM INTO`) en vez de copiar el archivo `.sqlite` directamente (ver [[08-decisiones]] §15).
- Dado que se genera un backup, cuando se completa, entonces el archivo resultante se guarda fuera del volumen `sqlite-data` que respalda, de modo que un `docker volume rm` accidental sobre `sqlite-data` no destruye también las copias.
- Dado un backup que falla (p. ej. sin espacio en disco), cuando ocurre el fallo, entonces queda registrado como línea NDJSON en los logs del servidor, igual que el resto de errores de aplicación (ver `DEPLOYMENT.md` "Logging & the ELK pipeline").
- Dado un backup completado con éxito, cuando se restaura ese archivo en una instancia limpia de `better-sqlite3`, entonces contiene el mismo número de filas en `proyectos`, `casos_prueba`, `ejecuciones` y `defectos` que la base de datos original en el momento del backup.

**Resuelto (2026-08-22):** frecuencia diaria vía crontab del host (no un contenedor/cron nuevo en `docker-compose.yml`); retención de las 7 copias más recientes; destino local (`./backups/` en el host, fuera del volumen `sqlite-data`), sin copia offsite — no hay infraestructura de almacenamiento externo en el proyecto. Implementado en `scripts/backup.sh` + `server/scripts/backup.js`, documentado en [docs/DEPLOYMENT.md#backups](DEPLOYMENT.md#backups).

**Fuera de alcance:** restauración automática/con un clic desde un backup (el comando manual de restore ya existe en `DEPLOYMENT.md`); cifrado de los archivos de backup (el cifrado en reposo está fuera de alcance general, ROADMAP §2); copia offsite.

**Dependencias:** ninguna

**Tamaño:** S

---

### US-02 — Suite de pruebas de frontend
**Como** usuario **quiero** que el frontend cuente con una suite de pruebas automatizada de componentes e interacción **para** tener confianza de que un cambio en la interfaz no rompe las pantallas que superviso a diario (dashboard, cobertura, resultados)

**Origen:** ROADMAP §3 High priority — Frontend test suite

**Criterios de aceptación:**
- Dado un cambio en el código de `client/`, cuando se ejecuta la suite de pruebas de frontend, entonces el proceso falla si alguna prueba de componente/interacción falla, de forma análoga a como `npm test` ya falla el pipeline en el backend (ver `DEVELOPMENT.md` "Linting & CI").
- Dado que la app abre directamente en el Dashboard (ya no hay pantalla de selección de usuario), cuando se ejecuta la suite, entonces existe al menos una prueba automatizada que cubre la carga inicial del Dashboard con un proyecto activo.
- ~~Dado un usuario con rol `gestor` que intenta acceder a `/ciclos/:id/ejecutar`...~~ — obsoleto: no hay roles, todas las pantallas son accesibles para el único usuario.
- Dado el bloque de exportación de la pantalla "Resultados" ([[04-ui-ux]] §8), cuando se ejecuta la suite, entonces existe al menos una prueba de interacción que cubre los tres botones de exportación (JSON, Markdown, Enviar a Notion).
- Dado que la suite se integra en CI, cuando se abre un pull request contra `master`/`main`, entonces el job de frontend en `.github/workflows/ci.yml` ejecuta esta suite además de `lint` y `build`.

**Fuera de alcance:** pruebas end-to-end contra un backend real desplegado (se asume mocking/stub de la API); fijar un umbral mínimo de cobertura de código.

**Dependencias:** ninguna

**Tamaño:** M

---

### US-03 — Importación masiva de casos de prueba
**Como** usuario **quiero** importar casos de prueba existentes desde un archivo **para** no tener que recrearlos manualmente al migrar desde una hoja de cálculo u otra herramienta

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
**Como** usuario **quiero** buscar por texto entre casos de prueba, suites y defectos **para** encontrar algo sin tener que filtrar suite por suite o proyecto por proyecto

**Origen:** ROADMAP §3 Medium priority — Full-text search across test cases/suites/defects

**Criterios de aceptación:**
- Dado un caso de prueba con título "Login con credenciales válidas", cuando se busca el término "credenciales", entonces ese caso aparece en los resultados.
- Dado un término de búsqueda que no coincide con ningún título de caso, nombre de suite o título de defecto, cuando se ejecuta la búsqueda, entonces la respuesta es una lista vacía, no un error.
- Dado que los resultados de una búsqueda abarcan más elementos que `pageSize`, cuando se solicita la página siguiente, entonces la respuesta sigue el mismo contrato de paginación que el resto de listados (`{ data, pagination: { page, pageSize, total } }`, [[03-api-contract]]).

**Pregunta abierta bloqueante:** ni ROADMAP ni `docs/design/` especifican si la búsqueda cubre solo los campos "nombre"/"título" de cada entidad, o también campos de texto libre como `descripcion` y `comentario` — sin esa decisión no puede fijarse qué constituye una coincidencia válida.

**Fuera de alcance:** búsqueda difusa/tolerante a errores tipográficos; ranking de relevancia entre resultados de distinto tipo.

**Dependencias:** ninguna

**Tamaño:** M

---

### US-05 — Adjuntos en ejecuciones y defectos
**Como** usuario **quiero** adjuntar archivos (capturas, logs) a una ejecución fallida/bloqueada o a un defecto **para** dejar evidencia además de un comentario de texto

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
**Como** usuario **quiero** añadir comentarios a un defecto además de sus cambios de estado **para** discutir su seguimiento con quien más lo trabaja

**Origen:** ROADMAP §3 Medium priority — Comments/activity feed on defects

**Criterios de aceptación:**
- Dado un defecto existente, cuando un usuario autorizado añade un comentario de texto, entonces el comentario queda visible en el detalle del defecto junto con su autor y fecha de creación.
- Dado un defecto con 3 comentarios guardados, cuando se consulta su detalle, entonces se devuelven los 3 comentarios asociados.
- Dado un defecto con comentarios que pasa de `resuelto` a `reabierto` ([[02-modelo-datos]] §3.4), cuando ocurre esa transición, entonces los comentarios previos siguen visibles y no se eliminan.

**Pregunta abierta bloqueante:** ni ROADMAP ni `docs/design/` especifican si se permite comentar un defecto ya en estado `cerrado`.

**Fuera de alcance:** edición o borrado de un comentario ya publicado; menciones (`@usuario`) o notificaciones a partir de un comentario.

**Dependencias:** ninguna

**Tamaño:** S

---

### US-07 — Informes a nivel de suite y de proyecto
**Como** usuario **quiero** un informe agregado a nivel de suite o de proyecto, no solo por ciclo **para** ver el estado global de las pruebas sin tener que sumar manualmente el resultado de cada ciclo

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
**Como** usuario **quiero** guardar una referencia (URL o ID) a un ticket de Jira o GitHub Issues en un defecto **para** vincularlo con el seguimiento que ya usa el equipo, sin montar una integración completa

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
**Como** usuario **quiero** recibir notificaciones dentro de la aplicación cuando se me asigna una ejecución o se reabre un defecto que reporté **para** enterarme sin tener que revisar cada pantalla manualmente

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
**Como** usuario **quiero** un interruptor manual de tema claro/oscuro **para** no depender solo de la preferencia del sistema operativo

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
**Como** usuario **quiero** conservar el historial de versiones de los pasos de un caso de prueba al editarlo **para** poder auditar cómo evolucionó el caso, no solo su estado actual

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

---

# Iteración: repositorios, Unit Tests y técnicas de testing

Historias US-12 a US-24. Origen: especificaciones [spec-repo-integration.md](spec-repo-integration.md), [spec-testcase-model.md](spec-testcase-model.md) y [spec-testing-techniques.md](spec-testing-techniques.md).

**Rol.** La herramienta es de un solo usuario local sin autenticación ni roles, así que el rol de todas estas historias es `usuario` (el único operador). Ver [open-questions.md §1](open-questions.md) (resuelto).

---

### US-12 — Vincular un repositorio a un proyecto
**Como** usuario **quiero** vincular un directorio de mi workspace como repositorio de un proyecto **para** no tener que volver a navegar hasta él cada vez que quiera ejecutar sus tests

**Origen:** [spec-repo-integration.md §2](spec-repo-integration.md)

**Criterios de aceptación:**
- Dado que el runner está deshabilitado (`RUNNER_ENABLED` sin definir o `RUNNER_WORKSPACE_ROOT` sin definir), cuando pido vincular un repositorio, entonces la API responde `501 RUNNER_DISABLED` y la interfaz no muestra la sección de repositorios, igual que ya ocurre con la pantalla `/terminal`.
- Dado un directorio dentro de `RUNNER_WORKSPACE_ROOT`, cuando lo vinculo con un nombre, un `commandId` de la lista blanca y un formato de resultado, entonces se crea el repositorio con `estado_vinculo = 'ok'` y la API responde `201`.
- Dado que envío una `rutaRelativa` absoluta, con `..` que escapa de la raíz, o que apunta a un symlink que sale de la raíz, cuando intento vincular, entonces la API responde `400` y no se crea nada.
- Dado un `commandId` que no está en `ALLOWED_COMMANDS`, cuando intento vincular, entonces la API responde `400`.
- Dado un nombre que ya usa otro repositorio del mismo proyecto, cuando intento vincular, entonces la API responde `409 REPOSITORIO_DUPLICADO`.
- Dado un directorio sin `package.json`, cuando lo vinculo con un comando npm, entonces la vinculación **se completa** pero la respuesta incluye un aviso no bloqueante.

**Fuera de alcance:** clonar repositorios desde una URL remota; raíces de workspace múltiples.

**Dependencias:** ninguna

**Tamaño:** M

---

### US-13 — Ejecutar los tests de un repositorio vinculado
**Como** usuario **quiero** lanzar el comando de test de un repositorio vinculado con un clic **para** comprobar el estado de la automatización sin salir de la herramienta

**Origen:** [spec-repo-integration.md §3](spec-repo-integration.md)

**Criterios de aceptación:**
- Dado un repositorio vinculado con `estado_vinculo = 'ok'`, cuando lanzo su ejecución, entonces se crea un `runner_run` con `repositorio_id` puesto y `directorio_relativo` resuelto en ese momento desde el repositorio, y la API responde `201`.
- Dado que envío `repositorioId` y `directorioRelativo` a la vez, cuando lanzo la ejecución, entonces la API responde `400` y no se lanza ningún proceso.
- Dado que envío `argumentosExtra`, cuando lanzo la ejecución, entonces la API responde `400` antes de crear ningún proceso, igual que hoy.
- Dado un repositorio cuyo directorio ya no existe en disco, cuando lanzo su ejecución, entonces la API responde `422 REPOSITORIO_NO_ENCONTRADO`, se registra el evento `runner_run_rechazado` y `estado_vinculo` pasa a `no_encontrado`.
- Dado un repositorio con una ejecución `en_progreso`, cuando lanzo una segunda ejecución sobre el mismo repositorio, entonces la API responde `409 REPOSITORIO_OCUPADO`.
- Dado un run en curso, cuando me suscribo a `GET /api/runner/ejecuciones/:id/stream`, entonces recibo la salida acumulada hasta ese momento y después los fragmentos nuevos, tal como ya funciona el SSE del runner.
- Dado un run que supera `RUNNER_TIMEOUT_MS`, cuando vence el plazo, entonces se mata el grupo de procesos completo y el run queda en `timeout`.

**Fuera de alcance:** lanzar ejecuciones automáticamente (webhooks, CI, planificador).

**Dependencias:** US-12

**Tamaño:** S

---

### US-14 — Parsear los resultados de un run en tests individuales
**Como** usuario **quiero** que la herramienta lea la salida del run y me diga qué tests concretos han pasado y cuáles han fallado **para** no tener que leer cientos de líneas de salida a mano

**Origen:** [spec-repo-integration.md §4](spec-repo-integration.md)

**Criterios de aceptación:**
- Dado un repositorio con `formato_resultado = 'tap'` y un comando que emite TAP, cuando el run termina, entonces se crea una fila en `runner_run_resultados` por cada test leído, con su estado `passed`/`failed`/`skipped`.
- Dado un run cuyo plan TAP (`1..N`) no coincide con el número de assertions leídas, cuando termina el parseo, entonces `parseo_estado = 'parcial'`.
- Dado un run cuya salida se truncó por `RUNNER_OUTPUT_CAP_BYTES`, cuando termina el parseo, entonces `parseo_estado = 'parcial'` y se registra el evento `runner_salida_truncada`.
- Dado un run que falla antes de ejecutar ningún test (error de sintaxis, dependencia ausente), cuando termina, entonces se leen 0 assertions, `parseo_estado = 'fallido'`, se registra `runner_parseo_fallido` y **no se modifica ningún unit test**.
- Dado un comando con `formato: 'ninguno'` (`npm test`), cuando el run termina, entonces `parseo_estado = 'no_aplica'` y el run se comporta exactamente como hoy.
- Dado un parser que lanza una excepción, cuando ocurre, entonces el run ya está persistido con su estado y código de salida, y el servidor no se cae.
- Dado un repositorio con `formato_resultado = 'json-file'` cuyo fichero de informe tiene un `mtime` anterior al inicio del run, cuando termina el parseo, entonces `parseo_estado = 'fallido'` con motivo `informe_obsoleto`.

**Fuera de alcance:** soportar JUnit XML o el formato nativo de frameworks de terceros (ver [open-questions.md §3](open-questions.md)).

**Dependencias:** US-13

**Tamaño:** L

---

### US-15 — Ver el catálogo de Unit Tests descubiertos
**Como** usuario **quiero** ver la lista de unit tests que la herramienta ha descubierto en un repositorio **para** saber qué automatización existe realmente antes de vincular nada

**Origen:** [spec-testcase-model.md §3](spec-testcase-model.md)

**Criterios de aceptación:**
- Dado un run parseado con éxito, cuando consulto `GET /api/repositorios/:id/unit-tests`, entonces veo un unit test por cada clave descubierta, con su `archivo`, `nombre`, `descubrimiento` y `ultimo_estado`, paginado con el contrato `{ data, pagination }` habitual.
- Dado un unit test ya conocido que vuelve a aparecer en un run posterior, cuando termina la reconciliación, entonces **no** se duplica la fila: se actualiza `ultimo_estado`, `ultimo_run_id` y `ultima_vez_visto_en`, y `primera_vez_visto_en` se conserva.
- Dado el catálogo, cuando filtro por `descubrimiento=ausente`, entonces solo veo los unit tests que el último run parseado con éxito no encontró.
- Dado el catálogo, cuando filtro por `vinculado=false`, entonces solo veo unit tests sin ningún Test Case vinculado.

**Fuera de alcance:** editar o crear unit tests desde la herramienta — la herramienta nunca escribe en el repositorio.

**Dependencias:** US-14

**Tamaño:** M

---

### US-16 — Vincular un Test Case a uno o varios Unit Tests
**Como** usuario **quiero** vincular un caso de prueba a los unit tests que lo automatizan **para** saber de un vistazo qué parte de mi plan de pruebas está cubierta por código

**Origen:** [spec-testcase-model.md §4](spec-testcase-model.md)

**Criterios de aceptación:**
- Dado un caso de prueba y un repositorio del mismo proyecto con unit tests descubiertos, cuando envío `PUT /api/casos/:id/unit-tests` con una lista de ids, entonces el conjunto de vínculos del caso queda reemplazado por esa lista.
- Dado un caso de prueba sin ningún vínculo, cuando lo consulto, entonces su `estadoAutomatizacion` derivado es `manual` y su `resultadoAutomatico` es `null` (no `passed`).
- Dado un caso vinculado a unit tests todos `presente`, cuando lo consulto, entonces `estadoAutomatizacion` es `automatizado`.
- Dado un unit test de un repositorio de **otro** proyecto, cuando intento vincularlo, entonces la API responde `400` y no se crea el vínculo.
- Dado un unit test, cuando consulto `GET /api/unit-tests/:id/casos`, entonces veo todos los casos vinculados a él (la relación es muchos a muchos en ambos sentidos).
- Dado un caso cuyo título coincide con el nombre normalizado de un unit test sin vincular, cuando abro el diálogo de vinculación, entonces la herramienta **sugiere** ese vínculo y **no lo aplica** hasta que lo confirmo.

**Fuera de alcance:** crear Test Cases automáticamente a partir de unit tests descubiertos.

**Dependencias:** US-15

**Tamaño:** M

---

### US-17 — Detectar Test Cases desincronizados
**Como** usuario **quiero** que la herramienta me avise cuando el unit test que automatizaba un caso ha desaparecido del repositorio **para** no seguir creyendo que ese caso está cubierto cuando ya no lo está

**Origen:** [spec-testcase-model.md §5.1](spec-testcase-model.md)

**Criterios de aceptación:**
- Dado un unit test vinculado que no aparece en un run con `parseo_estado = 'ok'`, cuando termina la reconciliación, entonces pasa a `descubrimiento = 'ausente'` con `ultimo_estado = 'desconocido'`, y se registra el evento `unit_test_ausente`.
- Dado ese mismo unit test ausente, cuando consulto su Test Case vinculado, entonces `estadoAutomatizacion` es `desincronizado` y `resultadoAutomatico` es `desconocido`.
- Dado un unit test vinculado que no aparece en un run con `parseo_estado = 'parcial'` o `'fallido'`, cuando termina el run, entonces **sigue en `presente`** y ningún caso pasa a `desincronizado`.
- Dado un unit test que pasó a `ausente`, cuando vuelve a aparecer en un run posterior, entonces vuelve a `presente` **conservando** su vínculo con el Test Case, sin que yo tenga que re-vincular nada.
- Dado un unit test que pasa a `ausente`, cuando termina la reconciliación, entonces la fila `caso_unit_tests` **no se borra** y `casos_prueba.estado` (`borrador`/`activo`/`obsoleto`) **no cambia**.
- Dado un proyecto con casos desincronizados, cuando abro el dashboard, entonces veo un contador de "casos desincronizados".

**Fuera de alcance:** notificaciones (no existe mecanismo de notificación en la aplicación); detección de renombrados.

**Dependencias:** US-16

**Tamaño:** M

---

### US-18 — Consultar si los Test Cases de un ciclo pasan
**Como** usuario **quiero** ver un informe de qué casos de un ciclo pasan según la última ejecución automática **para** saber dónde estoy sin abrir el ciclo caso por caso

**Origen:** [spec-repo-integration.md §5.1](spec-repo-integration.md)

**Criterios de aceptación:**
- Dado un ciclo con casos automatizados, cuando consulto `GET /api/ciclos/:cicloId/verificacion`, entonces recibo por cada caso su `estadoAutomatizacion`, su `resultadoAutomatico` y la lista de unit tests con su estado.
- Dado un caso vinculado a tres unit tests de los que uno está en `failed` y dos en `passed`, cuando consulto el informe, entonces su `resultadoAutomatico` es `failed` (peor resultado gana).
- Dado un caso vinculado a un unit test `ausente` y otro `failed`, cuando consulto el informe, entonces su `resultadoAutomatico` es `desconocido` (`desconocido` tiene precedencia sobre `failed`).
- Dado un caso sin unit tests vinculados, cuando consulto el informe, entonces aparece como `manual` con `resultadoAutomatico: null`.
- Dado que consulto el informe, cuando termina la petición, entonces **no se ha modificado ninguna ejecución, caso ni defecto**.

**Fuera de alcance:** ninguno.

**Dependencias:** US-16

**Tamaño:** S

---

### US-19 — Aplicar los resultados automáticos a las ejecuciones de un ciclo
**Como** usuario **quiero** cerrar de golpe las ejecuciones pendientes de un ciclo con el resultado del run **para** no transcribir a mano lo que la automatización ya ha comprobado

**Origen:** [spec-repo-integration.md §5.2](spec-repo-integration.md)

**Criterios de aceptación:**
- Dado un ciclo con ejecuciones `pendiente` de casos automatizados y un run con `parseo_estado = 'ok'`, cuando invoco `POST /api/ciclos/:cicloId/verificacion/aplicar`, entonces cada ejecución pasa por `tomar` (a `en_progreso`) y después se cierra con el estado derivado del run.
- Dado un caso cuyo resultado automático es `passed`, cuando se aplica, entonces la ejecución se cierra como `passed` con un `resultado_paso` = `pass` por **cada** paso del caso, cumpliendo la regla que ya exige `resultadosPaso` completo (`422 PASOS_INCOMPLETOS` si no).
- Dado un caso `manual` o `desincronizado`, cuando se aplica el lote, entonces su ejecución **no se toca** y aparece en `omitidos` con su motivo.
- Dado un run con `parseo_estado` distinto de `ok`, cuando intento aplicarlo, entonces la API responde `422 RUN_NO_PARSEADO` y no se modifica ninguna ejecución.
- Dado un ciclo en estado `completada`, cuando intento aplicar resultados, entonces la API responde `409 INVALID_TRANSITION`.
- Dado un run cuyo `proyecto_id` no coincide con el del ciclo, cuando intento aplicarlo, entonces la API responde `400`.
- Dado que se aplican resultados, cuando termina la operación, entonces cada ejecución cerrada lleva un `comentario` que cita el `runId` y el comando, y **ningún defecto se ha creado automáticamente**.
- Dado un run cualquiera, cuando termina **sin** que yo invoque este endpoint, entonces ninguna ejecución del ciclo ha cambiado de estado.

**Fuera de alcance:** producir el estado `blocked` automáticamente; creación automática de defectos.

**Dependencias:** US-18

**Tamaño:** M

---

### US-20 — Crear un defecto desde un fallo automático
**Como** usuario **quiero** abrir un defecto pre-rellenado a partir de un unit test que ha fallado **para** no copiar a mano el diagnóstico del fallo

**Origen:** [spec-testcase-model.md §5.2](spec-testcase-model.md)

**Criterios de aceptación:**
- Dado una ejecución cerrada como `failed` por la aplicación de resultados, cuando pulso "crear defecto desde este fallo", entonces el formulario de defecto aparece con `descripcion` pre-rellenada con el diagnóstico del unit test y `ejecucion_origen_id` fijado a esa ejecución.
- Dado ese formulario, cuando lo envío, entonces el defecto se crea por el camino existente, heredando `proyecto_id` y `tipo_prueba_id` de la ejecución (reglas de integridad 5 y 7 de [DATA_MODEL.md §4](DATA_MODEL.md)), sin permitir fijar `tipo_prueba_id` a mano.
- Dado un unit test que falla, cuando termina el run, entonces **no se crea ningún defecto** hasta que yo envíe el formulario.
- Dado un diagnóstico de fallo de más de 4 KB, cuando se pre-rellena la descripción, entonces se recorta a 4 KB.

**Fuera de alcance:** cerrar defectos automáticamente cuando un unit test vuelve a pasar.

**Dependencias:** US-19

**Tamaño:** S

---

### US-21 — Generar casos por análisis de valores límite (BVA)
**Como** usuario **quiero** describir una variable con su rango válido y obtener los casos de sus fronteras **para** cubrir los límites sin escribir seis casos casi idénticos a mano

**Origen:** [spec-testing-techniques.md §3](spec-testing-techniques.md)

**Criterios de aceptación:**
- Dado una variable `edad` de tipo `entero` con `min: 18`, `max: 65` y estrategia `3-valores`, cuando genero, entonces se producen exactamente 6 casos con los valores 17, 18, 19, 64, 65 y 66.
- Dado esa misma variable con estrategia `2-valores`, cuando genero, entonces se producen exactamente 4 casos con los valores 17, 18, 65 y 66.
- Dado cada caso generado, cuando lo consulto, entonces su `datos_entrada` contiene el valor concreto de la variable y tiene al menos un paso con su `resultado_esperado` (el `resultadoValido` o el `resultadoInvalido` declarado, según corresponda).
- Dado una variable de tipo `decimal` sin campo `paso`, cuando intento generar, entonces la API responde `400`.
- Dado una variable con `min` mayor que `max`, cuando intento generar, entonces la API responde `400`.
- Dado una variable de tipo `longitud-cadena` con `min: 0`, cuando genero, entonces el caso "por debajo del mínimo" se omite y la respuesta incluye un aviso explicándolo.
- Dado un lote generado, cuando consulto sus casos, entonces todos están en estado `borrador`.

**Fuera de alcance:** fechas con granularidad menor al día.

**Dependencias:** ninguna

**Tamaño:** M

---

### US-22 — Generar casos por particiones de equivalencia
**Como** usuario **quiero** declarar las clases de equivalencia de una entrada y obtener un caso por clase **para** cubrir cada clase exactamente una vez, sin repetir ni olvidarme de ninguna

**Origen:** [spec-testing-techniques.md §4](spec-testing-techniques.md)

**Criterios de aceptación:**
- Dado una variable con 5 particiones declaradas, cuando genero, entonces se producen exactamente 5 casos, uno por partición.
- Dado cada caso generado, cuando lo consulto, entonces su `datos_entrada` contiene el `representante` de su partición y su `descripcion` cita el `criterio` de la clase.
- Dado una variable con una sola partición, cuando intento generar, entonces la API responde `400`.
- Dado dos particiones de la misma variable con el mismo `representante`, cuando intento generar, entonces la API responde `400`.
- Dado una definición sin ninguna partición de clase `invalida`, cuando genero, entonces los casos **sí** se generan y la respuesta incluye un aviso.
- Dado un lote generado, cuando consulto sus casos, entonces todos están en estado `borrador`.

**Fuera de alcance:** derivar particiones automáticamente a partir de un tipo o esquema.

**Dependencias:** ninguna

**Tamaño:** S

---

### US-23 — Generar casos por tabla de decisión
**Como** usuario **quiero** definir condiciones, acciones y reglas en una matriz y obtener un caso por regla **para** descubrir las combinaciones que no había especificado

**Origen:** [spec-testing-techniques.md §5](spec-testing-techniques.md)

**Criterios de aceptación:**
- Dado 2 condiciones binarias, 2 acciones y las 4 reglas en modo `cartesiano`, cuando genero, entonces se producen exactamente 4 casos, uno por regla.
- Dado cada caso generado, cuando lo consulto, entonces tiene 1 + N pasos (uno para preparar el escenario y uno por acción a verificar), y su `datos_entrada` contiene el valor de cada condición.
- Dado modo `cartesiano` con una combinación sin regla, cuando intento generar, entonces la API responde `400 REGLAS_INCOMPLETAS` con la lista de combinaciones que faltan, y **no se crea ningún caso**.
- Dado dos reglas con la misma combinación de condiciones, cuando intento generar, entonces la API responde `400 REGLAS_DUPLICADAS` con las reglas en conflicto.
- Dado una regla que no nombra todas las condiciones, o que usa un valor no declarado, cuando intento generar, entonces la API responde `400`.
- Dado dos reglas con condiciones distintas y acciones idénticas, cuando genero, entonces los casos **sí** se generan y la respuesta incluye un aviso de posible condición irrelevante.
- Dado modo `explicito`, cuando genero con menos reglas que el producto cartesiano, entonces se generan solo las reglas declaradas, sin error.

**Fuera de alcance:** reducción automática de la tabla (colapsar condiciones irrelevantes en "-").

**Dependencias:** ninguna

**Tamaño:** L

---

### US-24 — Previsualizar y regenerar un lote de casos
**Como** usuario **quiero** ver qué casos va a crear un generador antes de aceptarlos, y poder reaplicar la definición más tarde **para** no llenar la suite de casos que luego tengo que borrar a mano

**Origen:** [spec-testing-techniques.md §2.5 y §2.6](spec-testing-techniques.md)

**Criterios de aceptación:**
- Dado una definición válida de cualquiera de las tres técnicas, cuando invoco `POST /api/tecnicas/:tecnica/previsualizar`, entonces recibo la lista de casos que se generarían y **no se ha escrito nada** en la base de datos.
- Dado una definición que generaría más de 200 casos, cuando la envío (a previsualizar o a generar), entonces la API responde `400 LOTE_DEMASIADO_GRANDE`.
- Dado que acepto un lote, cuando se persiste, entonces la definición completa queda guardada en `generaciones_casos` y cada caso creado apunta a ella con su `clave_generacion`.
- Dado un fallo al insertar uno de los casos del lote, cuando termina la operación, entonces **ningún** caso del lote queda creado (la escritura es una única transacción).
- Dado un lote existente y una definición modificada, cuando invoco `POST /api/generaciones/:id/regenerar`, entonces solo se crean los casos cuya `clave_generacion` es nueva; los ya existentes se devuelven en `sinCambios` sin modificarse y los que ya no se generan en `huerfanos` sin borrarse.
- Dado un `:tecnica` que no es `bva`, `particiones` ni `tabla_decision`, cuando invoco la previsualización, entonces la API responde `400`.

**Fuera de alcance:** ninguno.

**Dependencias:** US-21, US-22, US-23

**Tamaño:** M


## Índice

| ID | Título | Rol | Prioridad | Tamaño | Dependencias |
|---|---|---|---|---|---|
| US-01 | Backups automáticos del volumen SQLite | usuario | High | S | ninguna |
| US-02 | Suite de pruebas de frontend | usuario | High | M | ninguna |
| US-03 | Importación masiva de casos de prueba | usuario | Medium | M | ninguna |
| US-04 | Búsqueda de texto completo | usuario | Medium | M | ninguna |
| US-05 | Adjuntos en ejecuciones y defectos | usuario | Medium | M | ninguna |
| US-06 | Comentarios en defectos | usuario | Medium | S | ninguna |
| US-07 | Informes a nivel de suite y de proyecto | usuario | Medium | M | ninguna |
| US-08 | Enlace de defectos a trackers externos | usuario | Medium | S | ninguna |
| US-09 | Notificaciones in-app | usuario | Medium | M | ninguna |
| US-10 | Alternar manualmente entre tema claro y oscuro | usuario | Medium | S | ninguna |
| US-11 | Versionado / historial de cambios de un caso de prueba | usuario | Medium | M | ninguna |

| US-12 | Vincular un repositorio a un proyecto | usuario | Nueva iteración | M | ninguna |
| US-13 | Ejecutar los tests de un repositorio vinculado | usuario | Nueva iteración | S | US-12 |
| US-14 | Parsear los resultados de un run en tests individuales | usuario | Nueva iteración | L | US-13 |
| US-15 | Ver el catálogo de Unit Tests descubiertos | usuario | Nueva iteración | M | US-14 |
| US-16 | Vincular un Test Case a uno o varios Unit Tests | usuario | Nueva iteración | M | US-15 |
| US-17 | Detectar Test Cases desincronizados | usuario | Nueva iteración | M | US-16 |
| US-18 | Consultar si los Test Cases de un ciclo pasan | usuario | Nueva iteración | S | US-16 |
| US-19 | Aplicar los resultados automáticos a las ejecuciones de un ciclo | usuario | Nueva iteración | M | US-18 |
| US-20 | Crear un defecto desde un fallo automático | usuario | Nueva iteración | S | US-19 |
| US-21 | Generar casos por análisis de valores límite (BVA) | usuario | Nueva iteración | M | ninguna |
| US-22 | Generar casos por particiones de equivalencia | usuario | Nueva iteración | S | ninguna |
| US-23 | Generar casos por tabla de decisión | usuario | Nueva iteración | L | ninguna |
| US-24 | Previsualizar y regenerar un lote de casos | usuario | Nueva iteración | M | US-21, US-22, US-23 |

### Orden de implementación sugerido

Dos cadenas independientes que se pueden abordar en paralelo:

- **Repositorios y automatización:** US-12 → US-13 → US-14 → US-15 → US-16 → US-17 → US-18 → US-19 → US-20. US-14 (el parser) es la pieza que desbloquea todo lo demás y la más cara.
- **Técnicas de testing:** US-21, US-22 y US-23 son independientes entre sí y de la cadena anterior; US-24 las cierra. US-22 es la más barata y la mejor primera para fijar el contrato común de generador.

Ambas cadenas dependen del campo `datos_entrada` en `casos_prueba` ([spec-testcase-model.md §2.2](spec-testcase-model.md)) solo en el lado de las técnicas.
