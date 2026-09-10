# Especificación funcional — Integración con repositorios

**Estado:** propuesta de diseño para la próxima iteración. No implementada.
**Alcance:** un único usuario local (la app no tiene autenticación ni roles). No se diseña sincronización en la nube.
**Restricción técnica:** Node.js / JavaScript, y solo con las dependencias ya presentes (`express`, `better-sqlite3`, `pino`, `uuid`, `cors`, `express-rate-limit`, `node-fetch` en el servidor; React 19 + React Router en el cliente). Cualquier dependencia nueva se propone en [open-questions.md](open-questions.md), no se instala.

Documentos hermanos: [spec-testcase-model.md](spec-testcase-model.md) (qué se hace con los resultados), [spec-testing-techniques.md](spec-testing-techniques.md), [user-stories.md](user-stories.md), [open-questions.md](open-questions.md).

---

## 1. Punto de partida real en el código

Esta especificación **extiende** el runner de terminal que ya existe (commit `9ca444e`, "sandboxed in-app terminal runner"). No lo reemplaza. Lo que hay hoy:

| Pieza | Fichero | Qué hace hoy |
|---|---|---|
| Configuración y lista blanca | `server/src/config/runner.js` | `RUNNER_ENABLED` + `RUNNER_WORKSPACE_ROOT` (opt-in, apagado por defecto → `501 RUNNER_DISABLED`); `ALLOWED_COMMANDS` con exactamente dos entradas (`npm-test` → `npm test`, `npm-run-test` → `npm run test`); `RUNNER_TIMEOUT_MS` (600000); `RUNNER_OUTPUT_CAP_BYTES` (2 MB); `childEnv()` mínimo (`PATH`, `HOME`, `LANG`). |
| Jaula de directorios | `server/src/services/runnerWorkspace.service.js` | `pwd`/`ls`/`cd` sobre rutas **siempre relativas** a la raíz; rechaza rutas absolutas, `\0`, escapes por `..` y symlinks que salgan de la raíz (doble comprobación: sobre la ruta resuelta y sobre `realpathSync`). |
| Proceso hijo | `server/src/services/runnerProceso.service.js` | `spawn(bin, args, { shell: false, detached: true })`; mata **el grupo de procesos** (`process.kill(-pid)`) en abort y en timeout (SIGTERM → SIGKILL a los 2 s); acumula salida hasta el cap y marca `truncada`; `EventEmitter` por run con eventos `chunk`/`end` y `snapshot()` para suscriptores tardíos. Rechaza cualquier `argumentosExtra`. |
| Orquestación | `server/src/services/runnerEjecuciones.service.js` | Valida `proyectoId`/`cicloId`/`tipoPruebaId`, crea la fila `runner_runs`, lanza el proceso, y al `end` persiste `estado`/`codigoSalida`/`salida`. Loguea `runner_run_iniciado`, `runner_run_finalizado`, `runner_run_timeout`, `runner_run_rechazado`. |
| Persistencia | `runner_runs` en `server/src/db/schema.sql` | `proyecto_id`, `ciclo_id`, `tipo_prueba_id`, `directorio_relativo`, `comando`, `argumentos` (JSON), `estado` (`en_progreso`/`passed`/`failed`/`timeout`/`cancelado`), `codigo_salida`, `salida`, `salida_truncada`, timestamps. |
| API | `server/src/routes/runner.routes.js` | `GET /runner/status`, `GET /runner/comandos`, `GET /runner/directorio`, `POST /runner/directorio/cd`, `GET|POST /runner/ejecuciones`, `GET /runner/ejecuciones/:id`, `GET /runner/ejecuciones/:id/stream` (SSE a mano), `PATCH /runner/ejecuciones/:id/abortar`. |
| Cliente | `client/src/screens/Terminal/Terminal.jsx`, `client/src/api/runnerApi.js` | Pantalla `/terminal`: navegador de directorios, selector de comando, salida en vivo por SSE, historial. |

**Las cuatro carencias que esta iteración cierra:**

1. **No existe la noción de "repositorio".** El usuario navega un árbol de directorios y elige uno cada vez; nada queda vinculado a un proyecto de QA de forma persistente.
2. **El resultado de un run es un entero.** `estado` sale de `codigoSalida === 0`. La salida se guarda como texto plano y nunca se parsea: no se sabe *qué* tests corrieron ni cuáles fallaron.
3. **No hay vínculo con casos de prueba.** Un run "passed" no dice nada sobre ningún `caso_prueba`.
4. **La raíz del workspace es global** (`RUNNER_WORKSPACE_ROOT`, una variable de entorno del proceso), no algo que el usuario gestione desde la aplicación.

---

## 2. Modelo de vinculación de repositorios

### 2.1 Qué significa "conceder acceso" en una app local-first

No hay OAuth, ni clonado desde GitHub, ni credenciales de terceros. **Conceder acceso = que el repositorio esté físicamente dentro de `RUNNER_WORKSPACE_ROOT`** (montado en el contenedor, o simplemente presente en el disco si se ejecuta en local). El usuario concede acceso una vez, a nivel de despliegue, y desde la aplicación solo *selecciona* qué subdirectorios de esa raíz son repositorios vinculados.

Esta decisión es deliberada y conserva la invariante de seguridad que ya implementa `runnerWorkspace.service.js`: **ninguna ruta absoluta entra ni sale nunca por la API**. La entidad `Repositorio` guarda una ruta relativa, exactamente igual que `runner_runs.directorio_relativo` hoy. Un `Repositorio` no es una capacidad nueva: es un marcador con nombre sobre una ruta que el runner ya podía visitar.

Consecuencia aceptada: no se puede vincular un repositorio que viva fuera de la raíz configurada. Para hacerlo, el usuario cambia el montaje/`RUNNER_WORKSPACE_ROOT` y reinicia. Alternativas (raíces múltiples, rutas absolutas por repositorio) están en [open-questions.md §2](open-questions.md).

### 2.2 Entidad `Repositorio`

Nueva tabla `repositorios`. Todo cambio de esquema queda **propuesto aquí, no aplicado** (ver [Condiciones de parada](#8-fuera-de-alcance-de-esta-especificación)).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | TEXT (UUID) | sí | `utils/ids.newId()`, igual que el resto del modelo. |
| `proyecto_id` | FK → `proyectos` | sí | Un repositorio pertenece a un proyecto de QA. Un proyecto puede tener 0..N repositorios. |
| `nombre` | TEXT | sí | Etiqueta legible elegida por el usuario. Único por proyecto. |
| `ruta_relativa` | TEXT | sí | Relativa a `RUNNER_WORKSPACE_ROOT`. `''` = la raíz misma. Validada con `runnerWorkspace.resolveDentroDeRaiz` antes de guardarse. |
| `command_id` | TEXT | sí | Un `id` de `ALLOWED_COMMANDS`. Es el comando de test por defecto de este repositorio. |
| `formato_resultado` | TEXT | sí | `tap` \| `json-file` \| `ninguno`. Ver §4. Determina cómo se parsean los resultados. |
| `ruta_informe` | TEXT \| null | solo si `formato_resultado = 'json-file'` | Ruta relativa **al repositorio** del fichero de informe que el comando escribe. Validada dentro de la jaula igual que cualquier otra ruta. |
| `estado_vinculo` | TEXT | sí | `ok` \| `no_encontrado`. Ver §2.4. |
| `ultimo_run_id` | FK → `runner_runs` \| null | no | Último run ejecutado sobre este repositorio. Derivado cacheado; también obtenible con un `ORDER BY iniciado_en DESC LIMIT 1`. |
| `creado_en`, `actualizado_en` | TEXT (ISO) | sí | Convención `utils/ids.now()`. |

Índices propuestos: `idx_repositorios_proyecto ON repositorios(proyecto_id)`, y `UNIQUE (proyecto_id, nombre)`.

Cambios en tablas existentes:

- `runner_runs` gana `repositorio_id TEXT REFERENCES repositorios(id)` (nullable, para no invalidar el historial de runs previos hechos sin repositorio) y `parseo_estado TEXT NOT NULL DEFAULT 'no_aplica'` (§4.4).
- `runner_runs.directorio_relativo` se mantiene: sigue siendo la fuente de verdad del `cwd` real usado, incluso si el repositorio se renombra o se desvincula después.

### 2.3 Flujo de vinculación

1. El cliente pregunta `GET /api/runner/status`. Si `habilitado: false`, la sección de repositorios no se muestra (mismo patrón que la pantalla `/terminal` hoy).
2. El usuario navega el árbol con `GET /api/runner/directorio` / `POST /api/runner/directorio/cd` (endpoints existentes, sin cambios).
3. El usuario pulsa "Vincular este directorio como repositorio" y rellena `nombre`, `commandId`, `formatoResultado`.
4. `POST /api/proyectos/:proyectoId/repositorios` valida, en este orden:
   - runner habilitado (`requireRunnerEnabled`, `501` si no);
   - `proyectoId` existe (`404`);
   - `rutaRelativa` resuelve dentro de la jaula y es un directorio (`400`, reutilizando los mensajes de `runnerWorkspace`);
   - `commandId` está en `ALLOWED_COMMANDS` (`400`);
   - `nombre` no colisiona dentro del proyecto (`409 REPOSITORIO_DUPLICADO`);
   - si `formatoResultado = 'json-file'`, `rutaInforme` es relativa y no escapa del repositorio (`400`).
5. Se crea la fila con `estado_vinculo = 'ok'` y se devuelve `201`.

**Verificación de vínculo (`POST /api/repositorios/:id/verificar`):** re-resuelve `ruta_relativa` contra la jaula y actualiza `estado_vinculo`. No ejecuta nada. Es una operación barata que el cliente puede lanzar al abrir la pantalla de repositorios.

> `[asunción]` La comprobación de "esto parece un proyecto Node" (existencia de `package.json`, existencia de un script `test`) se propone como **aviso no bloqueante** en la respuesta de vinculación (`avisos: ['No se ha encontrado package.json en la ruta']`), no como validación dura: los dos comandos de la lista blanca son de npm, pero la lista blanca es extensible y una futura entrada podría no requerir `package.json`.

### 2.4 Desvinculación y desaparición

| Situación | Comportamiento |
|---|---|
| El usuario desvincula (`DELETE /api/repositorios/:id`) | La fila `repositorios` se borra. Los `runner_runs` históricos **se conservan** con `repositorio_id` puesto a `NULL` y su `directorio_relativo` intacto, siguiendo la misma regla que ya rige casos y ejecuciones ("el histórico no se destruye"). Los Unit Tests descubiertos por ese repositorio pasan a `ausente` (ver [spec-testcase-model.md §5](spec-testcase-model.md)). |
| El directorio ya no existe en disco | `estado_vinculo = 'no_encontrado'`. La vinculación **no se borra automáticamente**: puede ser un volumen desmontado temporalmente. Cualquier intento de ejecutar devuelve `422 REPOSITORIO_NO_ENCONTRADO`. |
| El directorio existe pero ahora es un symlink fuera de la raíz | Idéntico a `no_encontrado` de cara al usuario, pero el log de negocio registra `motivo: 'fuera_de_raiz'`. La jaula existente ya lo detecta; aquí solo se le da un estado persistente. |

---

## 3. Ejecución de comandos de test

### 3.1 Qué cambia y qué no

**No cambia nada del mecanismo de ejecución.** Se sigue usando `runnerProceso.iniciarProceso` tal cual: `spawn` sin shell, grupo de procesos detached, timeout duro, cap de salida, streaming SSE. El único cambio en el contrato de arranque es que `POST /api/runner/ejecuciones` acepta `repositorioId` como **alternativa** a `directorioRelativo`:

```
POST /api/runner/ejecuciones
{
  "repositorioId": "…",       // nuevo; si viene, aporta directorioRelativo y commandId
  "proyectoId": "…",          // se valida que coincida con repositorio.proyecto_id (400 si no)
  "cicloId": "…",             // opcional, igual que hoy
  "tipoPruebaId": "…",        // opcional, igual que hoy
  "commandId": "npm-test"     // opcional si viene repositorioId (usa el del repositorio)
}
```

Reglas:
- `repositorioId` y `directorioRelativo` son mutuamente excluyentes (`400` si vienen los dos). Se conserva `directorioRelativo` para el modo "terminal suelta" que ya existe.
- Si `repositorioId` viene, `directorioRelativo` de la fila `runner_runs` se rellena desde `repositorio.ruta_relativa` **resuelta en ese momento**, no desde una copia guardada. Si la resolución falla, se rechaza con `422 REPOSITORIO_NO_ENCONTRADO` y se emite `runner_run_rechazado` (el mecanismo de log de rechazos ya existe en `runnerEjecuciones.service.js`).
- `argumentosExtra` sigue prohibido, sin excepciones. Ver §3.2.

### 3.2 Por qué el formato de resultado va en la lista blanca y no en la petición

Para parsear resultados hace falta que el comando emita algo estructurado, y eso normalmente se pide con una flag (`--test-reporter=tap`, `--reporter=json`…). El código actual **rechaza cualquier argumento del cliente** por una razón documentada en `runnerProceso.service.js` y en `DEVELOPMENT.md`: una flag legítima del binario puede romper la jaula sin usar `..` ni metacaracteres (`npm test --prefix <otra-ruta>`).

Esta especificación **no relaja esa regla**. En su lugar: cada combinación comando+formato es una **entrada nueva y fija en `ALLOWED_COMMANDS`**, con sus `baseArgs` completos escritos a mano en `server/src/config/runner.js`. Propuesta de entradas a añadir:

```js
{ id: 'node-test-tap',  bin: 'node', baseArgs: ['--test', '--test-reporter=tap'], label: 'node --test (TAP)',  formato: 'tap' },
{ id: 'npm-test',       bin: 'npm',  baseArgs: ['test'],                          label: 'npm test',           formato: 'ninguno' },
{ id: 'npm-run-test',   bin: 'npm',  baseArgs: ['run', 'test'],                   label: 'npm run test',       formato: 'ninguno' },
```

`ALLOWED_COMMANDS` gana un campo `formato` (`tap` | `json-file` | `ninguno`) que declara qué produce ese comando. `GET /api/runner/comandos` pasa a devolver `{ id, label, formato }` en vez de `{ id, label }`, para que el cliente pueda avisar de que un repositorio con `formato_resultado = 'tap'` y un `command_id` de formato `ninguno` nunca producirá resultados parseables (`400 FORMATO_INCOMPATIBLE` al vincular o al ejecutar).

> `[asunción]` `node --test --test-reporter=tap` funciona sobre el Node 20+ que `README.md` exige, y es el reporter que la propia suite del proyecto usaría (`server/package.json` ya define `"test": "node --test test/*.test.js"`). No se ha verificado ejecutándolo en este repositorio; verificar antes de implementar.

### 3.3 Ciclo de vida de un run

Los estados de `runner_runs.estado` **no cambian**: `en_progreso` → `passed` | `failed` | `timeout` | `cancelado`, tal como los deriva `runnerProceso.finalizar` hoy (`abortado` → `cancelado`, `timedOut` → `timeout`, `codigoSalida === 0` → `passed`, resto → `failed`).

Lo que se añade es una **segunda dimensión ortogonal**: `parseo_estado` (§4.4). Un run puede ser `failed` con `parseo_estado = 'ok'` (los tests corrieron y algunos fallaron: información útil) o `failed` con `parseo_estado = 'fallido'` (ni siquiera arrancó: nada que interpretar). Distinguir estos dos casos es el motivo de que el campo exista.

---

## 4. Parseo de resultados

### 4.1 Cuándo se parsea

Al recibir el evento `end` del proceso, en el mismo callback donde hoy se llama a `runnerRunsModel.finalizar`. El parseo es **síncrono, en memoria y sobre la salida ya acumulada**; no vuelve a leer nada del disco salvo en el formato `json-file`.

Orden de operaciones propuesto en `runnerEjecuciones.service.js`:
1. `runnerRunsModel.finalizar(...)` — se persiste el resultado crudo primero, siempre. Si el parser explota, el run ya está guardado.
2. Parseo dentro de un `try/catch`. Un error de parseo nunca cambia `estado` ni tumba el proceso del servidor: se traduce a `parseo_estado = 'fallido'` + log `runner_parseo_fallido`.
3. Reconciliación de Unit Tests ([spec-testcase-model.md §4](spec-testcase-model.md)), dentro de una única transacción `better-sqlite3`.

### 4.2 Formato `tap`

Parser propio, sin dependencias nuevas: un lector de líneas sobre la salida acumulada. Se propone `server/src/services/runnerParsers/tap.parser.js`.

Se reconocen únicamente estas construcciones de TAP 13:

| Línea | Interpretación |
|---|---|
| `TAP version 13` | Cabecera. Su ausencia no es un error (algunos reporters la omiten en subtests). |
| `1..N` | Plan. Si el número de assertions leídas ≠ N → `parseo_estado = 'parcial'`. |
| `ok <n> - <nombre>` | Test en `passed`. |
| `not ok <n> - <nombre>` | Test en `failed`. |
| `ok <n> - <nombre> # SKIP <motivo>` / `# TODO` | Test en `skipped`. |
| Indentación (subtests) | El nombre completo del test es la ruta de nombres desde la raíz, unida por ` > `. |
| Bloque YAML (`  ---` … `  ...`) | Se lee `duration_ms` si está presente; el resto se ignora. |
| Cualquier otra línea | Ignorada silenciosamente (comentarios `#`, ruido de consola del propio test). |

**Identidad de un Unit Test.** La clave estable es:

```
clave = `${repositorioId}:${archivo}:${nombreCompleto}`
```

- `nombreCompleto` = ruta de nombres de subtest unida por ` > `.
- `archivo`: con `node --test`, el reporter emite un test de nivel superior por fichero, cuyo nombre es la ruta del fichero relativa al `cwd`. Ese nombre se usa como `archivo` y **se excluye** de `nombreCompleto`. `[asunción]` — la forma exacta del nombre de nivel superior depende de la versión de Node; el parser debe tratar un nombre de nivel superior que termine en `.js`/`.mjs`/`.cjs` como fichero, y en caso contrario dejar `archivo = null` y quedarse solo con el nombre.
- La clave se guarda tal cual (no se hashea): es legible en la base de datos y en los logs, lo que importa más que el ahorro de bytes en un despliegue de un solo usuario.

**Consecuencia conocida y aceptada:** renombrar un test en el repositorio produce una clave nueva. El test viejo se marcará `ausente` y aparecerá uno nuevo. La herramienta no intenta adivinar renombrados (no hay heurística fiable, y una equivocación rompería un vínculo con un Test Case en silencio). El usuario re-vincula a mano; ver [spec-testcase-model.md §5.3](spec-testcase-model.md).

### 4.3 Formato `json-file`

Para repositorios cuyo comando de test escribe un informe estructurado en disco (habitual en suites con reporters propios). El parser:

1. Resuelve `repositorio.ruta_relativa + repositorio.ruta_informe` **a través de `runnerWorkspace.resolveDentroDeRaiz`** — mismas garantías de jaula que cualquier otra ruta, incluida la comprobación de symlinks.
2. Comprueba que el `mtime` del fichero es posterior a `runner_runs.iniciado_en`. Si no lo es, el informe es de un run anterior → `parseo_estado = 'fallido'`, motivo `informe_obsoleto`. Esto evita la trampa clásica de leer resultados rancios cuando el comando peta antes de escribir.
3. Lee el fichero con un tope de tamaño igual a `RUNNER_OUTPUT_CAP_BYTES`; si lo excede → `parseo_estado = 'fallido'`, motivo `informe_demasiado_grande`.
4. Espera este esquema mínimo (esquema propio de la herramienta, documentado para que el repositorio lo produzca):

```json
{
  "tests": [
    { "archivo": "test/casos.test.js", "nombre": "crea un caso > rechaza sin pasos", "estado": "passed", "duracionMs": 12 }
  ]
}
```

`estado` ∈ `passed` | `failed` | `skipped`. Campos desconocidos se ignoran. Un `tests` ausente o no-array → `parseo_estado = 'fallido'`.

> `[asunción]` No hay hoy ningún repositorio que produzca este formato. Se especifica como punto de extensión declarado, no como integración con un reporter concreto de terceros. Adoptar el formato nativo de un framework (JUnit XML, el JSON de Jest, el reporter `junit` de Node) requiere decisión previa — ver [open-questions.md §3](open-questions.md).

### 4.4 `parseo_estado`

| Valor | Cuándo | Efecto sobre la reconciliación de Unit Tests |
|---|---|---|
| `no_aplica` | El comando tiene `formato: 'ninguno'`, o el run no tiene repositorio. | Ninguno. El run es informativo, como hoy. |
| `ok` | Se parseó la salida entera y coincide con el plan (`1..N`). | Reconciliación completa: los Unit Tests no vistos se marcan `ausente`. |
| `parcial` | Se parsearon resultados, pero la salida está incompleta: `salida_truncada = 1`, plan que no cuadra, o `estado ∈ {timeout, cancelado}`. | Se **actualizan** los tests vistos. **No** se marca `ausente` a nadie: la ausencia aquí no distingue "borrado" de "no llegó a ejecutarse". |
| `fallido` | La salida no es parseable en absoluto: 0 assertions leídas, informe ausente/obsoleto/corrupto, excepción en el parser. | Ninguno. Ni se actualiza ni se marca nada. |

Esta tabla es la regla de seguridad central del diseño: **un fallo de compilación no debe vaciar el mapa de automatización del usuario.** Un `npm test` que revienta al arrancar produce `estado = failed`, 0 assertions, `parseo_estado = 'fallido'` y **cero** cambios en Unit Tests.

### 4.5 Persistencia de los resultados parseados

Nueva tabla `runner_run_resultados` (una fila por Unit Test por run):

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | TEXT (UUID) | |
| `run_id` | FK → `runner_runs` | |
| `unit_test_id` | FK → `unit_tests` | Ver [spec-testcase-model.md §2](spec-testcase-model.md). |
| `estado` | TEXT CHECK IN (`passed`,`failed`,`skipped`) | |
| `duracion_ms` | INTEGER \| null | |
| `detalle` | TEXT \| null | Primeras líneas del bloque YAML/diagnóstico del fallo, con tope de 4 KB. |

Índices: `idx_runner_run_resultados_run ON runner_run_resultados(run_id)`, `idx_runner_run_resultados_unit_test ON runner_run_resultados(unit_test_id)`.

Retención: `[asunción]` sin política de purga en esta iteración — el volumen de un despliegue de un solo usuario no lo justifica, y `runner_runs.salida` (hasta 2 MB por run) ya domina el tamaño de la base de datos. Si se necesita, ver [open-questions.md §6](open-questions.md).

### 4.6 API de resultados

- `GET /api/runner/ejecuciones/:id/resultados` → `{ data: [...], pagination }`, siguiendo el contrato de paginación que ya usan todos los listados planos (`utils/pagination.js`, defaults 1/20, máx. 100).
- `GET /api/runner/ejecuciones/:id` gana `parseoEstado` y `resumen: { passed, failed, skipped, total }`.
- El evento SSE `end` gana los mismos campos, para que la pantalla del runner pinte el resumen sin una petición extra.

---

## 5. Comprobar que los Test Cases pasan

Este es el objetivo funcional de la integración. Se resuelve en dos piezas separadas a propósito:

### 5.1 Informe de verificación (solo lectura)

`GET /api/ciclos/:cicloId/verificacion` devuelve, para cada Test Case con ejecución pendiente en el ciclo, su estado automático derivado:

```json
{
  "cicloId": "…",
  "runId": "…",
  "casos": [
    { "casoId": "…", "titulo": "…", "estadoAutomatizacion": "automatizado",
      "resultadoAutomatico": "passed", "unitTests": [{ "clave": "…", "estado": "passed" }] },
    { "casoId": "…", "titulo": "…", "estadoAutomatizacion": "manual",
      "resultadoAutomatico": null, "unitTests": [] },
    { "casoId": "…", "titulo": "…", "estadoAutomatizacion": "desincronizado",
      "resultadoAutomatico": "desconocido", "unitTests": [{ "clave": "…", "estado": "ausente" }] }
  ]
}
```

La regla de agregación (varios unit tests → un resultado) está definida en [spec-testcase-model.md §4.2](spec-testcase-model.md).

Este endpoint **no escribe nada**. Responde a "¿pasan mis casos?" sin efectos laterales.

### 5.2 Aplicación de resultados al ciclo (escritura explícita)

`POST /api/ciclos/:cicloId/verificacion/aplicar` con `{ "runId": "…" }`. Cierra las ejecuciones pendientes de los casos automatizados usando el resultado del run. **Nunca se dispara solo**: es una acción que el usuario pulsa.

Por qué explícita y no automática: `runnerEjecuciones.service.js` hoy no toca `ejecuciones` en absoluto, y las ejecuciones son el registro de auditoría del ciclo. Que un `npm test` lanzado para depurar cerrara ejecuciones en silencio sería una sorpresa destructiva. El precio (un clic) es bajo; el coste del error es alto.

Mecánica, respetando las reglas que el código ya impone:

1. Solo se consideran ejecuciones en estado `pendiente` del ciclo (`ejecuciones.estado`).
2. Para cada una, se llama al camino existente: `ejecucionesService.tomar(id)` (`pendiente → en_progreso`), luego `ejecucionesService.registrarResultado(...)`.
3. `registrarResultado` exige (`utils/errors.unprocessable('PASOS_INCOMPLETOS')`) que `resultadosPaso` cubra **todos** los `pasoId` del caso. Un resultado automático no tiene granularidad de paso, así que se sintetiza **un `resultado_paso` por paso del caso con el mismo estado**, mapeando: `passed → pass`, `failed → fail`, `skipped → skip` (los tres únicos valores que admite el `CHECK` de `resultados_paso`).
4. `comentario` de la ejecución: `Resultado automático del run <runId> (<comando>) — <n> unit tests`. Deja rastro de la procedencia sin inventar campos nuevos.
5. `blocked` **nunca** se produce automáticamente: no hay señal en un resultado de test que lo justifique.
6. Casos `manual` (0 unit tests vinculados) y `desincronizado` se **omiten** y se devuelven en `omitidos` con el motivo. Nunca se cierran a ciegas.

Respuesta: `{ aplicadas: N, omitidas: [{ casoId, motivo }] }`.

Precondiciones que devuelven error en vez de aplicar parcialmente:
- Run con `parseo_estado ≠ 'ok'` → `422 RUN_NO_PARSEADO`. Un run parcial no es base suficiente para cerrar ejecuciones.
- Run cuyo `proyecto_id` no coincide con el del ciclo → `400`.
- Ciclo en estado `completada` → `409 INVALID_TRANSITION`, coherente con la máquina de estados de ciclos (`completada` no tiene transiciones salientes).

---

## 6. Manejo de errores

Se reutiliza íntegramente `server/src/utils/errors.js` (`AppError` con `statusCode`/`code`/`details`) y el `errorHandler.middleware.js` existente. Códigos nuevos:

| Código | HTTP | Cuándo |
|---|---|---|
| `RUNNER_DISABLED` | 501 | Ya existe. Toda la superficie de repositorios va detrás de `requireRunnerEnabled`. |
| `REPOSITORIO_DUPLICADO` | 409 | `nombre` repetido dentro del proyecto. |
| `REPOSITORIO_NO_ENCONTRADO` | 422 | La `ruta_relativa` ya no resuelve dentro de la jaula (borrada, desmontada o convertida en symlink saliente). |
| `FORMATO_INCOMPATIBLE` | 400 | `repositorio.formato_resultado` no coincide con el `formato` del `command_id`. |
| `RUN_NO_PARSEADO` | 422 | Se intenta aplicar al ciclo un run con `parseo_estado ≠ 'ok'`. |
| `BAD_REQUEST` | 400 | Ya existe. Rutas fuera de la jaula, `commandId` desconocido, `argumentosExtra` presentes, `repositorioId` + `directorioRelativo` a la vez. |
| `INVALID_TRANSITION` | 409 | Ya existe. Aplicar resultados a un ciclo `completada`; abortar un run ya terminado (`RUNNER_RUN_NO_ACTIVO`, existente). |

**Errores que no son errores HTTP.** Estos ocurren después de responder `201` al arranque del run, así que se comunican por el estado del run y por el log de negocio, no por un código de estado:

| Situación | `estado` | `parseo_estado` | Evento de log |
|---|---|---|---|
| Binario no encontrado / `spawn` falla | `failed` (con `[error al lanzar el proceso: …]` anexado a la salida, comportamiento ya existente) | `fallido` | `runner_run_finalizado` |
| Tests fallan | `failed` | `ok` | `runner_run_finalizado` |
| Timeout (`RUNNER_TIMEOUT_MS`) | `timeout` | `parcial` | `runner_run_timeout` (ya existente) |
| Abortado por el usuario | `cancelado` | `parcial` | `runner_run_finalizado` |
| Salida truncada por el cap | sin cambio | `parcial` | `runner_salida_truncada` (nuevo) |
| Salida no parseable | sin cambio | `fallido` | `runner_parseo_fallido` (nuevo), con `motivo` |

Todos los eventos nuevos siguen el formato ya usado en `runnerEjecuciones.service.js`: `logger.info({ tipo: 'evento_negocio', evento, runId, proyectoId, ... })`, con lo que aparecen en Kibana por el mismo pipeline de Logstash sin tocar `logstash/pipeline/qa-tool.conf`.

**Concurrencia.** El código actual no impide dos runs simultáneos sobre el mismo directorio. Se propone rechazar un segundo run sobre el **mismo repositorio** mientras haya uno `en_progreso`: `409 REPOSITORIO_OCUPADO`. Comprobable con una consulta a `runner_runs` (`estado = 'en_progreso' AND repositorio_id = ?`) más `runnerProceso.estaEnCurso`, sin estado nuevo en memoria. Dos runs de `npm test` a la vez sobre el mismo árbol se pisan los artefactos y producen resultados que no significan nada.

---

## 7. Impacto en la superficie existente

| Fichero | Cambio |
|---|---|
| `server/src/db/schema.sql` | + `repositorios`, + `unit_tests`, + `caso_unit_tests`, + `runner_run_resultados`, + columnas en `runner_runs`. **Propuesto, no aplicado.** |
| `server/src/config/runner.js` | `ALLOWED_COMMANDS` gana `formato`; entrada `node-test-tap`. |
| `server/src/services/runnerEjecuciones.service.js` | Acepta `repositorioId`; invoca el parser y la reconciliación tras `finalizar`. |
| `server/src/services/runnerParsers/` | Nuevo. `tap.parser.js`, `jsonFile.parser.js`, `index.js` (selector por `formato`). |
| `server/src/{routes,controllers,services,models}/repositorios.*` | Nuevos, siguiendo el layering ya establecido en `ARCHITECTURE.md §6`. |
| `client/src/api/repositoriosApi.js`, pantalla de repositorios | Nuevos, siguiendo el patrón de `runnerApi.js`. |
| `docs/API.md`, `docs/DATA_MODEL.md`, `docs/ROADMAP.md` | A actualizar cuando esto se implemente, no antes. |

Sin cambios en: `docker-compose.yml`, `Dockerfile`, `package.json`, `logstash/`.

---

## 8. Fuera de alcance de esta especificación

- Clonar repositorios desde una URL remota (git, GitHub API). El acceso se concede por sistema de ficheros.
- Ejecutar código no confiable de forma segura. `README.md` ya declara explícitamente que el runner no es un sandbox frente a un usuario malicioso; añadir repositorios no cambia esa frontera de confianza.
- Cualquier tipo de webhook, CI o disparo automático de runs. Todo run lo lanza el usuario.
- Detección de renombrados de tests (§4.2).
- Cualquier tipo de identidad, autenticación o sincronización entre instalaciones (la app es single-user).
