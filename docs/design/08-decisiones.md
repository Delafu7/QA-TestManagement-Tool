# 08 — Decisiones técnicas

## 1. Base de datos local

### Opciones consideradas

| Opción | Ventajas | Desventajas |
|---|---|---|
| **SQLite** | Cero configuración, un solo archivo, ideal para app local de un equipo pequeño, transaccional, buen soporte en Node (`better-sqlite3`) | Concurrencia de escritura limitada; sin tipo `array` nativo (etiquetas/relaciones N:M requieren tablas puente) |
| PostgreSQL | Motor completo, tipos ricos (`jsonb`, arrays), buena concurrencia | Requiere contenedor y gestión adicional para un caso de uso local de bajo volumen; sobredimensionado para el problema |
| MongoDB | Esquema flexible, natural para documentos anidados (pasos embebidos) | Sin transacciones multi-documento tan maduras como SQL para las reglas de integridad de [[02-modelo-datos]] §4; el modelo aquí es fuertemente relacional (FKs, estados), no documental |

### Decisión recomendada: **SQLite**

**Motivo:** la app es local, de un solo equipo, sin necesidad de alta concurrencia de escritura ni de un servidor de BD separado. El modelo de datos es relacional con integridad referencial clara (Suite→Caso→Ejecución→Defecto), que SQLite maneja bien con claves foráneas. Reduce el número de contenedores en `docker-compose` (un archivo `.sqlite` en volumen, sin servicio `db` propio) y simplifica backup (copiar un archivo). Si el uso crece a multi-equipo concurrente, migrar a PostgreSQL es la vía de escape natural sin cambiar el modelo relacional.

**Alternativa de reserva:** PostgreSQL, si desde el inicio se prevé que varios QA escriban simultáneamente con alta frecuencia sobre el mismo ciclo (SQLite serializa escrituras).

## 2. Alcance de autenticación/roles

**Decisión:** no se implementa autenticación real (login con contraseña, SSO) en esta iteración — está explícitamente fuera de alcance. Se usa selección de usuario activo (`Usuario.id` enviado como header `X-User-Id`) para atribuir autoría y aplicar permisos por `rol` (`qa`/`gestor`).

**Motivo:** el requisito original no pide autenticación; es una app local de confianza dentro del equipo.

**Riesgo aceptado:** cualquier proceso con acceso a la API puede suplantar a cualquier usuario indicando su `id`. Aceptable en un entorno local de confianza; **no aceptable** si la app se expone fuera de `localhost`/red interna — en ese caso se necesitaría añadir autenticación antes de desplegar, lo cual queda fuera de esta iteración.

## 3. Servicio `client`: build estático vs. servidor de desarrollo

**Decisión recomendada:** el contenedor `client` sirve el build de producción de React (`npm run build`) mediante nginx, no `react-scripts start`.

**Motivo:** más fiel a cómo se usará la app día a día (no es un entorno de desarrollo activo constante), arranque más rápido del contenedor, y consistente con la idea de "aplicación local instalada" más que "entorno de desarrollo".

**Alternativa:** para desarrollo activo del propio proyecto, se puede mantener un `docker-compose.override.yml` con el servidor de desarrollo — decisión de tooling de implementación, no de arquitectura.

## 4. Filebeat vs. lectura directa de archivo por Logstash

**Decisión recomendada:** Logstash lee directamente el archivo NDJSON con `input { file {...} }` (ver [[07-infraestructura]] §3), sin Filebeat intermedio.

**Motivo:** un componente menos que desplegar y mantener en un stack ya compuesto de 6 servicios; el volumen de logs de una app de QA de equipo pequeño no justifica la robustez adicional de Filebeat (reintentos, backpressure) que sí sería relevante a mayor escala.

**Riesgo aceptado:** el input `file` de Logstash es menos resiliente ante rotación de logs agresiva; mitigable con una política de rotación diaria simple.

## 5. Relación Notion — alcance del mapeo

**Decisión:** el mapeo de exportación a Notion ([[06-exportacion]] §3) usa únicamente propiedades de texto/select/número/fecha sobre una única base de datos de Notion, sin relaciones (`relation`) hacia otras bases (p. ej. una BD de defectos ya existente del usuario en Notion).

**Motivo:** evita inventar capacidades sobre bases de datos de Notion ajenas que no se pueden verificar en esta fase de diseño (ver marcas `[verificar]` en [[06-exportacion]] §3).

**Riesgo aceptado:** si el usuario ya gestiona defectos en Notion, la exportación no los enlaza automáticamente; quedaría como mejora futura fuera de alcance.

## 6. Persistencia del token de Notion

**Decisión:** `notionToken` se recibe en cada petición de exportación (`POST /export/notion`) y no se persiste en la base de datos de la aplicación.

**Motivo:** minimizar superficie de exposición de un secreto en un almacén que no está diseñado para secretos (SQLite sin cifrado en reposo).

**Riesgo aceptado:** el usuario debe reintroducir el token en cada exportación, lo cual es fricción de UX; se acepta porque la alternativa (guardar el token en claro en la BD local) es peor desde el punto de vista de seguridad. Si se decide persistirlo en el futuro, requeriría cifrado en reposo — fuera de alcance de esta iteración.

## 7. Borrado de Suites/Casos con dependencias

**Decisión:** ver reglas de integridad en [[02-modelo-datos]] §4 — no se permite `DELETE` de una Suite con casos `activo`, ni de un Caso con ejecuciones históricas; se usa el flujo de `deprecar`/`obsoleto` en su lugar.

**Motivo:** preserva la trazabilidad histórica de ejecuciones y resultados, que es el valor central de una herramienta de gestión de pruebas (un gestor debe poder auditar qué se probó, aunque el caso ya no esté vigente).

**Alternativa descartada:** borrado físico con cascada — se descarta porque rompe la trazabilidad de ejecuciones pasadas y el historial mostrado en el detalle de caso ([[04-ui-ux]] §5).

## 8. Riesgos generales

| Riesgo | Impacto | Mitigación propuesta |
|---|---|---|
| SQLite con múltiples QA escribiendo a la vez sobre el mismo ciclo | Posibles bloqueos de escritura (`SQLITE_BUSY`) | Reintentos con backoff en la capa `services`; migrar a PostgreSQL si el equipo crece |
| Límites reales de la API de Notion desconocidos (`[verificar]` en [[06-exportacion]]) | Exportaciones grandes podrían fallar por rate limit | Envío secuencial con backoff; validar límites reales antes de implementar |
| Sin autenticación real | Cualquier proceso local puede suplantar usuarios | Aceptado para uso local; documentado como no apto para exposición externa |
| Un único índice de Elasticsearch mezclando tipos de evento | Consultas de Kibana algo más complejas (filtrar por `tipo`) | Aceptado por simplicidad; revisar si el volumen de logs crece mucho |
| Ausencia de modo oscuro definido | Podría no cumplir expectativas visuales si se asume soporte | Marcado `[verificar]`/pendiente en [[05-responsive-y-design-system]] §5.2, no implementado por defecto |

## 9. Acceso a datos: driver directo vs. ORM/query builder

### Opciones consideradas

| Opción | Ventajas | Desventajas |
|---|---|---|
| **`better-sqlite3` directo + SQL escrito a mano** | Sin capa de abstracción adicional, control total sobre las consultas, rendimiento predecible, API síncrona sencilla de razonar en `services` | Más código repetitivo para CRUD; migraciones de esquema manuales |
| Knex.js (query builder) | Migraciones incluidas, sintaxis fluida, portable si se migra a PostgreSQL (ver §1) | Una dependencia y capa de indirección adicional para un esquema que no es muy grande |
| Prisma | Migraciones y tipado de esquema muy cómodos | Pensado principalmente para TypeScript; en un proyecto `.js` puro añade complejidad de generación de cliente que no aporta tanto valor |

### Decisión recomendada: **`better-sqlite3` con una capa fina de migraciones SQL versionadas manualmente**

**Motivo:** el número de entidades es acotado (9, ver [[02-modelo-datos]]) y las consultas no son especialmente complejas; una capa de ORM completa añade dependencias y curva de aprendizaje sin beneficio claro para el volumen de datos previsto (§9 de supuestos). Si el proyecto migra a PostgreSQL en el futuro (§1), se puede reevaluar Knex en ese momento.

## 10. Generación de identificadores

**Decisión:** todos los `id` de entidad son UUID v4 generados en el servidor (`server/services`), no autoincrementales de base de datos.

**Motivo:** evita colisiones si en el futuro se sincronizan datos entre instalaciones locales distintas (p. ej. exportar/importar un proyecto entre dos equipos), algo que un ID autoincremental de SQLite no garantiza. También evita filtrar el volumen de filas de una tabla a través del propio ID en las respuestas de API.

**Riesgo aceptado:** los IDs son menos legibles en depuración manual que un entero secuencial; se acepta porque las pantallas de UI ([[04-ui-ux]]) siempre muestran el campo humano relevante (`titulo`, `nombre`), no el `id`.

## 11. Zonas horarias y formato de fecha/hora

**Decisión:** el servidor almacena y devuelve todas las fechas en UTC, formato ISO 8601 (`2026-08-21T09:15:00Z`). La conversión a hora local del usuario ocurre exclusivamente en el cliente React, en el momento de renderizar.

**Motivo:** evita ambigüedad al comparar `fechaEjecucion` entre usuarios en zonas horarias distintas y mantiene los logs de [[07-infraestructura]] consistentes con el `@timestamp` de Elasticsearch, que también usa UTC por convención.

**Excepción:** los campos puramente de fecha sin hora (`Ciclo.fechaInicio`, `Ciclo.fechaFinPrevista`) se tratan como `date` (`YYYY-MM-DD`) sin componente horario ni de zona, ya que representan un día de calendario, no un instante.

## 12. Librería de logging en el servidor

### Opciones consideradas

| Opción | Ventajas | Desventajas |
|---|---|---|
| **Pino** | Salida NDJSON nativa (encaja directo con el formato de [[07-infraestructura]] §2 sin transformación adicional), muy bajo overhead | Formato de log por defecto menos legible para humanos en consola sin un transport adicional de desarrollo |
| Winston | Muy configurable, múltiples transports | Salida JSON requiere configuración explícita; más pesado que Pino |
| `console.log` con formateo manual | Cero dependencias | Reinventa lo que ya resuelven Pino/Winston; riesgo de líneas mal formadas que rompan el `filter { json }` de Logstash |

### Decisión recomendada: **Pino**

**Motivo:** su formato NDJSON por defecto es exactamente el que consume el pipeline de Logstash descrito en [[07-infraestructura]] §2–§3, sin necesidad de transformar la salida antes de escribirla al archivo.

## 13. Comunicación entre contenedores `client` y `server`

**Decisión:** en `docker-compose`, `client` (nginx) actúa como proxy inverso de `/api/*` hacia el contenedor `server`, de modo que el navegador solo habla con el origen de `client` y no necesita conocer el nombre de host interno de `server`.

**Motivo:** evita problemas de CORS entre el origen servido al navegador y la API, y evita exponer el puerto de `server` directamente al host salvo para depuración.

**Alternativa descartada:** exponer `server` en un puerto propio y configurar CORS explícito en Express — se descarta como opción por defecto porque añade una superficie de configuración (orígenes permitidos) innecesaria en un entorno de un solo origen local, aunque sigue siendo válida para depuración puntual.

## 14. Preguntas abiertas pendientes de validar con el equipo

Estas preguntas no bloquean el diseño actual pero conviene resolverlas antes de implementar:

| Pregunta | Por qué importa | Dónde impacta |
|---|---|---|
| ¿Se necesita importar casos de prueba desde un CSV/Excel existente? | Cambiaría si se necesita un endpoint de importación masiva | [[03-api-contract]] |
| ¿Cuántos proyectos concurrentes gestionará un mismo equipo? | Afecta si la decisión de SQLite (§1) sigue siendo válida a medio plazo | [[08-decisiones]] §1 |
| ¿El campo `Ejecutor` en Notion (§3 de [[06-exportacion]]) debería intentar mapear a un usuario real de Notion (`people`) si el equipo usa Notion internamente? | Cambiaría el tipo de propiedad de `rich_text` a `people`, con validaciones adicionales | [[06-exportacion]] §3 |
| ¿Es necesario un modo oscuro desde el primer lanzamiento? | Afecta el alcance de tokens de color en [[05-responsive-y-design-system]] §5.2 | [[05-responsive-y-design-system]] |

## 15. Estrategia de backup del archivo SQLite

**Decisión:** el volumen `sqlite-data` ([[07-infraestructura]] §1.1) debe respaldarse copiando el archivo `.sqlite` completo mientras no haya escrituras en curso, o usando el comando de backup en caliente de SQLite (`VACUUM INTO` / `.backup`) para evitar copiar un archivo a medio escribir.

**Motivo:** al no haber un servicio `db` gestionado con sus propias herramientas de backup, la responsabilidad de respaldo recae en un proceso externo simple (script periódico o acción manual del equipo), que debe documentarse en la fase de implementación, no en este documento de diseño.

**Riesgo aceptado:** sin backup automático configurado desde el primer despliegue, una pérdida del volumen Docker (`docker volume rm` accidental, disco corrupto) implica pérdida total del histórico de casos y ejecuciones. Se recomienda que la fase de implementación incluya un job de backup desde el primer `docker-compose.yml`, aunque su definición exacta queda fuera de esta iteración.

## 16. Priorización de las decisiones abiertas

Para orientar la fase de implementación, estas son las decisiones de este documento que conviene cerrar primero por su impacto en el resto del diseño:

| Prioridad | Decisión | Motivo de la prioridad |
|---|---|---|
| Alta | §1 Motor de base de datos | Condiciona el esquema físico y la capa de acceso a datos (§9) |
| Alta | §2 Alcance de autenticación | Condiciona el middleware de autorización y las pantallas por rol de [[04-ui-ux]] |
| Media | §9 Acceso a datos (driver vs. ORM) | Depende de §1, pero no bloquea el resto del diseño ya documentado |
| Media | §5 y §6 Alcance de Notion y persistencia del token | Depende de confirmar los puntos `[verificar]` de [[06-exportacion]] §3 con la API real de Notion |
| Baja | §12 Librería de logging | Intercambiable sin afectar el formato NDJSON acordado en [[07-infraestructura]] §2, siempre que se mantenga el mismo formato de salida |

## 17. Supuestos

- El equipo de QA y los gestores acceden a la misma red local o misma máquina donde corre `docker-compose`.
- El volumen de datos (casos, ejecuciones, logs) es el de un equipo pequeño-mediano (cientos de casos, miles de ejecuciones/año), no una organización grande multi-equipo.
- La integración con Notion usa una única base de datos de destino por proyecto, configurada manualmente por el usuario (no se descubren bases de datos de Notion automáticamente).
- El stack fijado (React/Express/Docker/ELK) se mantiene sin sustitución; cualquier alternativa tecnológica mencionada en este documento es solo para los componentes explícitamente abiertos (motor de BD, acceso a datos, logging), nunca para el stack fijado.
- No hay requisito de trabajo offline avanzado ni sincronización multi-dispositivo más allá de acceder a la misma API desde distintos navegadores en la red local.

## 18. Trazabilidad de decisiones frente a los documentos previos

Esta tabla resume qué documento consumirá cada decisión una vez se pase a implementación, para facilitar la revisión cruzada de coherencia pedida en los criterios de aceptación de esta iteración:

| Decisión | Documento(s) que la asumen como cierta |
|---|---|
| §1 SQLite | [[01-arquitectura]] §2, §4; [[07-infraestructura]] §1 |
| §2 Sin autenticación real | [[01-arquitectura]] §9; [[03-api-contract]] (código `401`); [[04-ui-ux]] §1 |
| §3 `client` sirve build de producción | [[01-arquitectura]] §4, §6 |
| §4 Sin Filebeat | [[07-infraestructura]] §3, §7 |
| §5 y §6 Notion sin relaciones, token no persistido | [[03-api-contract]] §9; [[06-exportacion]] §3 |
| §7 Borrado con trazabilidad | [[02-modelo-datos]] §4; [[03-api-contract]] §4, §5 |
| §9 Acceso a datos sin ORM completo | [[01-arquitectura]] §6 (estructura de `models/`) |
| §10 UUID v4 | [[02-modelo-datos]] §1 (todas las entidades); [[03-api-contract]] (todos los payloads) |
| §11 UTC en fechas | [[02-modelo-datos]] §1; [[06-exportacion]] §1–§2; [[07-infraestructura]] §2 |
| §12 Pino | [[07-infraestructura]] §2 (formato NDJSON) |
| §13 Proxy `client → server` | [[01-arquitectura]] §4; [[07-infraestructura]] §1 |

## 19. Criterios para revisar estas decisiones en el futuro

Ninguna decisión de este documento se considera definitiva de forma permanente. Señales concretas que deberían disparar una revisión:

| Señal observada | Decisión a revisar |
|---|---|
| Errores frecuentes `SQLITE_BUSY` en producción local | §1 (evaluar migración a PostgreSQL) |
| Necesidad real de compartir la herramienta entre varios equipos/oficinas, no solo un equipo local | §1 y §2 (BD y autenticación) |
| El equipo pide activamente reenviar resultados a Notion sin duplicar páginas | §9 de [[06-exportacion]] (deduplicación) |
| Se confirma con la documentación oficial de Notion algún límite de los marcados `[verificar]` | [[06-exportacion]] §3, actualizar de "verificar" a afirmación cerrada |
| El volumen de logs crece lo suficiente como para que un único índice `qa-tool-logs-*` sea difícil de consultar | [[07-infraestructura]] §4 (separar índices por `tipo`) |

## 20. Fuera de alcance explícito de esta iteración

Para dejar constancia expresa de qué no se ha decidido ni diseñado, alineado con las restricciones del encargo original:

- Autenticación SSO o multi-tenant.
- Funcionalidades de inteligencia artificial dentro de la herramienta.
- Integraciones adicionales a Notion (Jira, Slack, correo, etc.).
- Sincronización o modo offline entre instalaciones distintas de la app.
- Cifrado en reposo de la base de datos SQLite.
- Definición del propio `docker-compose.yml`, `Dockerfile`, `package.json` o cualquier archivo de código o configuración de infraestructura ejecutable — esta iteración entrega únicamente los 8 documentos de `docs/design/`.
