# Preguntas abiertas — iteración de repositorios, Unit Tests y técnicas de testing

Decisiones que no puedo tomar sin tu input. Cada una indica qué bloquea y, cuando la hay, cuál es mi recomendación y por qué.

Las especificaciones ([spec-repo-integration.md](spec-repo-integration.md), [spec-testcase-model.md](spec-testcase-model.md), [spec-testing-techniques.md](spec-testing-techniques.md)) están escritas de forma que **ninguna de estas preguntas bloquea empezar**: en cada punto he elegido la opción más conservadora y la he documentado. Lo que hay aquí son cosas que conviene confirmar antes de que la elección se vuelva cara de cambiar.

Esto es distinto de la lista de [ROADMAP.md §4](ROADMAP.md), que recoge preguntas abiertas de iteraciones anteriores (importación CSV, token de Notion, dark mode). Aquellas siguen vigentes y no se tocan aquí.

---

## 1. El modelo de usuario ~~contradice~~ contradecía el enunciado de "un solo usuario" — RESUELTO (2026-09-10)

**Decisión tomada:** la herramienta pasa a ser **single-user de verdad**. Ejecutado en la rama `refactor/single-user`:

- Eliminada la tabla `usuarios` y **todas** las columnas de autoría (`proyectos.propietario_id`, `casos_prueba.autor_id`, `caso_versiones.editado_por_id`, `ciclos.responsable_id`, `ejecuciones.ejecutor_id`, `defectos.reportado_por_id`, `runner_runs.iniciado_por_id`).
- Eliminados `auth.middleware.js` (`identifyUser`/`requireRole`), la cabecera `X-User-Id`, los roles `qa`/`gestor`, la pantalla `SeleccionUsuario` y el `UsuarioContext`.
- Sin migración in-place: se reescribió `schema.sql` y se documentó que una BD con el esquema antiguo debe borrarse.
- Sin identidad visible en la UI ni en los exports: el historial de versiones de un caso muestra solo fecha; el export pierde `ejecutor` y `exportadoPor`; la propiedad `Ejecutor` desaparece del export a Notion.

**Efecto en las specs de esta iteración:** las tres specs se actualizaron para quitar toda referencia a `requireRole('qa')`, `req.usuarioId`, `iniciado_por_id`, `X-User-Id`, `generaciones_casos.creado_por_id` y `usuarios`. El runner sigue detrás de `requireRunnerEnabled` (opt-in por variable de entorno), que no tiene nada que ver con identidad. Las historias US-12..US-24 usan el rol genérico `usuario`.

---

## 2. ¿Una sola raíz de workspace, o repositorios en rutas arbitrarias?

**Bloquea:** el campo `repositorios.ruta_relativa` y todo el modelo de vinculación de [spec-repo-integration.md §2](spec-repo-integration.md).

Hoy `RUNNER_WORKSPACE_ROOT` es una única variable de entorno, y toda la jaula de `runnerWorkspace.service.js` se apoya en que existe exactamente una raíz. He diseñado `Repositorio` como una **ruta relativa a esa raíz única**, porque conserva intacta la invariante de seguridad y no requiere tocar el servicio de jaula.

El coste: no puedes vincular un repositorio que viva fuera de la raíz sin cambiar el montaje y reiniciar. Con Docker Compose eso significa editar `docker-compose.yml`, que está fuera de lo que puedo tocar.

Opciones:
- **(a)** Una raíz, rutas relativas. Lo especificado. Cero cambios en la jaula.
- **(b)** Varias raíces (`RUNNER_WORKSPACE_ROOTS` separadas por `:`), y `repositorios` guarda `raiz_id` + ruta relativa. Cambio moderado en `runnerWorkspace.service.js`: `getRoot()` pasa a `getRoot(raizId)` y toda ruta lleva su raíz.
- **(c)** Rutas absolutas por repositorio, validadas contra una lista blanca en base de datos. **Desaconsejo**: mueve la frontera de seguridad de una variable de entorno (que solo controla quien despliega) a filas de base de datos (que controla la API). Es exactamente el cambio que convierte la jaula en decorativa.

**Mi recomendación: (a) ahora, (b) si aparece la necesidad real de más de un árbol.** ¿Cuántos repositorios distintos, y en cuántos sitios del disco, esperas vincular en la práctica?

---

## 3. ¿Qué formato de resultados de test hay que soportar de verdad?

**Bloquea:** US-14, que es la historia más cara del backlog, y la extensión de `ALLOWED_COMMANDS`.

He especificado dos formatos: `tap` (parser propio, para `node --test --test-reporter=tap`) y `json-file` (un esquema JSON propio de la herramienta que el repositorio produce). La elección de TAP se apoya en un hecho del repositorio: `server/package.json` ya usa `"test": "node --test test/*.test.js"`, así que la propia suite del proyecto sería el primer caso de uso.

Lo que no sé:

- **¿Qué frameworks usan los repositorios que quieres vincular?** Si son `node:test`, TAP basta. Si son Jest, Vitest o Mocha, cada uno tiene su propio reporter y su propio formato, y "soportar tests de Node" deja de ser una sola cosa.
- **¿Hay que soportar JUnit XML?** Es el formato interoperable de facto y casi todos los frameworks lo emiten. El problema: parsear XML sin dependencias en Node es desagradable, y las opciones (`fast-xml-parser`, `xml2js`) son **dependencias nuevas**, que por tu restricción se proponen aquí y no se instalan. Node ≥ 21.6 trae un reporter `junit` nativo, pero `README.md` solo exige Node 20+ y `docker-compose.yml` fija su propia imagen base.

**Dependencias nuevas que esto podría requerir (ninguna instalada):**

| Dependencia | Para qué | ¿Evitable? |
|---|---|---|
| `fast-xml-parser` o `xml2js` | Parsear JUnit XML | Sí, si nos quedamos en TAP + JSON |
| `tap-parser` | Parsear TAP en vez del parser propio | Sí — TAP 13 en el subconjunto que necesitamos son ~120 líneas de código y evita una dependencia con superficie propia |

**Mi recomendación: empezar solo con TAP**, con el parser propio, y añadir formatos cuando haya un repositorio concreto que lo pida. Un parser genérico escrito antes de conocer su entrada real acaba siendo genérico en las dimensiones equivocadas.

**Además, verificar antes de implementar** (marcado como `[asunción]` en la especificación): la forma exacta de la salida de `node --test --test-reporter=tap` en la versión de Node del despliegue, en concreto si el nombre del test de nivel superior es la ruta del fichero. De eso depende que la clave `${repositorioId}:${archivo}:${nombreCompleto}` sea estable.

---

## 4. ¿Debe la herramienta intentar detectar tests renombrados?

**Bloquea:** el comportamiento de US-17; afecta a cuánto trabajo manual genera la desincronización en el día a día.

He especificado explícitamente que **no**: un test renombrado se ve como uno que desaparece más uno nuevo, el caso queda `desincronizado` y tú re-vinculas. El razonamiento está en [spec-testcase-model.md §5.3](spec-testcase-model.md): un vínculo transferido por error a un test que comprueba otra cosa es un fallo silencioso, y un fallo silencioso en una herramienta de QA es peor que uno ruidoso.

Si renombrar tests es frecuente en tu flujo, esto se vuelve molesto rápido. Alternativas, en orden de agresividad:

- **(a)** No detectar nada. Lo especificado.
- **(b)** *Sugerir* un re-vínculo cuando desaparece un test y aparece otro **en el mismo fichero, en el mismo run**, con similitud de nombre por encima de un umbral. Sugerir, nunca aplicar. Coste bajo, riesgo bajo.
- **(c)** Aplicar (b) automáticamente cuando la coincidencia es única e inequívoca (un solo desaparecido y un solo aparecido en el fichero).

**Mi recomendación: (a) para la primera versión, y (b) si el uso real demuestra que duele.** (c) solo con una señal de confianza muy fuerte, y aun así dejando rastro en el log.

¿Con qué frecuencia se renombran tests en los repositorios que vas a vincular?

---

## 5. ¿Se pueden crear Test Cases a partir de Unit Tests descubiertos?

**Bloquea:** una posible historia de usuario adicional que **no** he escrito.

He especificado que no existe conversión automática en ninguna dirección ([spec-testcase-model.md §4.3](spec-testcase-model.md)): un unit test no es un Test Case, y convertirlo automáticamente disolvería la distinción que toda esta iteración existe para mantener. Un Test Case tiene precondiciones, prioridad, datos de entrada y un resultado esperado escrito por una persona; un unit test tiene un nombre.

Pero hay un flujo intermedio razonable que no he especificado porque no sé si lo quieres: **"crear un caso borrador desde este unit test"**, un botón que abre el formulario normal de creación con el título pre-rellenado desde el nombre del test y el vínculo ya establecido, para que tú rellenes el resto. Es análogo al atajo "crear defecto desde este fallo" de US-20.

¿Lo quieres? Si sí, es una historia de usuario más, de tamaño S, dependiente de US-16.

---

## 6. ¿Cuánto historial de ejecuciones automáticas hay que conservar?

**Bloquea:** una posible política de purga en `runner_run_resultados`; afecta al tamaño del fichero SQLite y al backup diario que ya está en producción (`scripts/backup.sh`).

He especificado que no hay purga. El razonamiento: `runner_runs.salida` ya guarda hasta `RUNNER_OUTPUT_CAP_BYTES` (2 MB por defecto) por run y domina el tamaño; las filas de resultados son pequeñas en comparación.

Aun así, el orden de magnitud importa: una suite de 500 tests ejecutada 20 veces al día son 10.000 filas diarias en `runner_run_resultados`, más hasta 40 MB diarios de salida cruda. En un mes eso es una base de datos que el backup diario (que conserva las 7 copias más recientes) empieza a notar.

Opciones:
- **(a)** Sin purga. Lo especificado.
- **(b)** Conservar los N runs más recientes por repositorio y borrar los resultados de los anteriores (manteniendo la fila `runner_runs` con su resumen).
- **(c)** Vaciar `runner_runs.salida` de los runs con más de X días, conservando los resultados parseados, que son la parte con valor a largo plazo.

**Mi recomendación: (c) si hace falta algo**, porque la salida cruda es lo voluminoso y lo que menos se consulta pasada una hora. Pero no antes de tener una medida real.

¿Cuántas veces al día esperas ejecutar los tests desde la herramienta?

---

## 7. ¿Deben los generadores de técnicas escribir en `datos_entrada` o en un campo propio?

**Bloquea:** el cambio de esquema de [spec-testcase-model.md §2.2](spec-testcase-model.md), que es la única modificación que propongo sobre una tabla existente y muy usada.

He añadido `casos_prueba.datos_entrada` como TEXT con JSON plano, porque el enunciado pide explícitamente "datos de entrada" como parte del Test Case y hoy ese hueco no existe: los datos de entrada solo se pueden escribir en prosa dentro de `paso.accion`.

Dudas que no puedo resolver solo:

- **¿Es "plano" suficiente?** He restringido `datos_entrada` a un objeto sin anidamiento, para que la interfaz pueda pintarlo como tabla clave/valor sin un editor de árbol. Un caso que necesita un payload JSON anidado no cabe. ¿Aparece eso en la práctica?
- **¿Debe entrar en `caso_versiones`?** He dicho que sí (una columna más en el snapshot), lo que mantiene el historial completo. Es coherente con lo que ya hace `casoVersiones.model.js` con `pasos_json`.
- **¿Debe ser visible y editable en casos creados a mano?** He asumido que sí — si solo lo escribieran los generadores, sería un campo de segunda clase y los usuarios acabarían sin usarlo.

**Confirmación que necesito antes de tocar el esquema:** la restricción del enunciado dice que no modifique esquema ni migraciones sin preguntar. Estos cuatro `ALTER TABLE` (`casos_prueba.datos_entrada`, `caso_versiones.datos_entrada`, `casos_prueba.generacion_id`, `casos_prueba.clave_generacion`) están **propuestos y no aplicados**. Necesito tu visto bueno explícito antes de escribir cualquier migración, y también decidir si van por `schema.sql` (que usa `CREATE TABLE IF NOT EXISTS` y no migra bases existentes) o por un script tipo `server/src/db/migrarTiposPrueba.js`, que es el precedente que ya existe en el proyecto para este problema exacto.

---

## 8. Cosas que he decidido yo y puedes revertir

No bloquean nada, pero son elecciones mías y no hechos leídos del repositorio. Las listo para que no pasen desapercibidas:

| Decisión | Dónde | Alternativa si no te convence |
|---|---|---|
| Aplicar resultados al ciclo es **explícito**, nunca automático | [spec-repo-integration.md §5.2](spec-repo-integration.md) | Un modo "auto-aplicar" configurable por ciclo |
| `desconocido` tiene precedencia sobre `failed` al agregar resultados | [spec-testcase-model.md §4.2](spec-testcase-model.md) | Invertir el orden si prefieres que un fallo real domine el aviso |
| Los casos generados nacen en `borrador`, siempre | [spec-testing-techniques.md §2.2](spec-testing-techniques.md) | Permitir generar directamente en `activo` |
| Regenerar solo **añade**: nunca sobrescribe ni borra | [spec-testing-techniques.md §2.6](spec-testing-techniques.md) | Un modo "reemplazar lote", con el riesgo de perder ediciones manuales |
| Límite de 200 casos por lote | [spec-testing-techniques.md §2.7](spec-testing-techniques.md) | Subirlo, o hacerlo configurable por variable de entorno |
| Un segundo run sobre el mismo repositorio se rechaza (`409 REPOSITORIO_OCUPADO`) | [spec-repo-integration.md §6](spec-repo-integration.md) | Permitirlo y aceptar que los resultados se pisen |
| Desvincular un repositorio con vínculos exige `?forzar=true` | [spec-testcase-model.md §5.4](spec-testcase-model.md) | Borrado en cascada silencioso |
| El formato de resultado va en `ALLOWED_COMMANDS`, no en la petición | [spec-repo-integration.md §3.2](spec-repo-integration.md) | Relajar la prohibición de argumentos del cliente — **desaconsejo fuertemente**: el motivo está documentado en `runnerProceso.service.js` y en `DEVELOPMENT.md` |
