# Deployment

The reference deployment is `docker compose up` on a trusted local machine or internal network. There is no cloud/Kubernetes manifest, and none is currently planned — see [docs/ROADMAP.md](ROADMAP.md) if that's a requirement for your use case.

## Services

```bash
docker compose up --build
```

| Service | Image / build | Purpose | Host port |
|---|---|---|---|
| `client` | `./client` (multi-stage: Vite build → nginx) | Serves the React build and reverse-proxies `/api/*` to `server` | `8080 → 80` |
| `server` | `./server` (node:20-alpine) | Express API, SQLite access, log emission | *(none)* |
| `elasticsearch` | `docker.elastic.co/elasticsearch/elasticsearch:8.15.0` | Stores/indexes logs | *(none)* |
| `logstash` | `docker.elastic.co/logstash/logstash:8.15.0` | Reads the NDJSON log file, forwards to Elasticsearch | *(none)* |
| `kibana` | `docker.elastic.co/kibana/kibana:8.15.0` | Log/metric dashboards | `5601 → 5601` |

`server`, `elasticsearch`, and `logstash` are intentionally not published to the host — the browser only ever needs `client`'s port, and `elasticsearch`/`logstash` are reached over the compose-internal network. Uncomment/add a `ports:` mapping on `server` in a local override file if you need to hit the API directly (e.g. with `curl`) while debugging.

`elasticsearch` has a healthcheck (`GET /_cluster/health`); `logstash` and `kibana` wait on it via `depends_on: condition: service_healthy` before starting.

## Volumes

| Volume | Mounted on | Contents |
|---|---|---|
| `sqlite-data` | `server` (`/data`) | The single `qa-tool.sqlite` file — all business data |
| `app-logs` | `server` (write), `logstash` (read-only) | `server.ndjson` — structured application logs |
| `es-data` | `elasticsearch` | Elasticsearch indices, persisted across restarts |

## Environment variables (Docker)

Set in `docker-compose.yml` / the Dockerfiles — override via a `docker-compose.override.yml` if needed:

| Service | Variable | Value |
|---|---|---|
| `server` | `PORT` | `4000` |
| `server` | `SQLITE_DB_PATH` | `/data/qa-tool.sqlite` |
| `server` | `LOG_FILE_PATH` | `/var/log/qa-tool/server.ndjson` |
| `elasticsearch` | `discovery.type` | `single-node` |
| `elasticsearch` | `xpack.security.enabled` | `false` |
| `elasticsearch` | `ES_JAVA_OPTS` | `-Xms512m -Xmx512m` |
| `kibana` | `ELASTICSEARCH_HOSTS` | `http://elasticsearch:9200` |

X-Pack security is disabled and there's no TLS between ELK components — acceptable for a stack that never leaves `localhost`/an internal network; revisit before exposing it more broadly.

## Logging & the ELK pipeline

Every API request and select business events (e.g. `ejecucion_cerrada`) are written as one NDJSON line each by `server/src/middleware/logger.middleware.js` (Pino), to `LOG_FILE_PATH`.

**Example — HTTP request log line:**
```json
{"timestamp":"2026-08-21T09:15:32.481Z","level":"info","service":"qa-tool-server","tipo":"http_request","metodo":"PATCH","ruta":"/api/ejecuciones/ej-3392/resultado","statusCode":200,"duracionMs":48,"usuarioId":"u-123"}
```

**Example — application error log line:**
```json
{"timestamp":"2026-08-21T09:16:01.002Z","level":"error","service":"qa-tool-server","tipo":"app_error","metodo":"POST","ruta":"/api/ciclos/cic-0142/export/notion","statusCode":502,"errorCode":"NOTION_API_ERROR","mensaje":"Timeout al contactar con Notion"}
```

Pipeline (`logstash/pipeline/qa-tool.conf`):

```
input: file (/var/log/qa-tool/server.ndjson, codec: json)
  → filter: date (parses "timestamp" into @timestamp)
  → filter: mutate (adds entorno: "local")
  → output: elasticsearch (index: qa-tool-logs-%{+YYYY.MM.dd})
```

A single rolling index pattern (`qa-tool-logs-*`) is used, with `tipo` (`http_request` / `app_error` / `evento_negocio`) as the discriminator — no Filebeat, no per-event-type index. Kibana at http://localhost:5601 can build dashboards against that pattern: API error rate by `errorCode`/`ruta`, API latency (`duracionMs`) by route, and request volume over time. This is an infrastructure-observability view for whoever operates the app, separate from the in-app Dashboard screen (which reads live SQLite state, not logs).

## Backups

There is **no automated backup job**. The `sqlite-data` volume holds all business data (projects, cases, executions, defects) with nothing else backing it up. Recommended manual approach until a backup job exists (see [docs/ROADMAP.md](ROADMAP.md)):

```bash
# hot backup without stopping the server (uses SQLite's own backup API)
docker compose exec server node -e "
  const Database = require('better-sqlite3');
  const db = new Database(process.env.SQLITE_DB_PATH);
  db.backup('/data/backup-' + new Date().toISOString().slice(0,10) + '.sqlite')
    .then(() => process.exit(0));
"
```

Or simply copy the `.sqlite` file while confident no write is in flight. Losing the `sqlite-data` volume (e.g. an accidental `docker volume rm`) means losing the entire case/execution/defect history — there is no offsite copy by default.

## Production readiness checklist

Before running this anywhere beyond a trusted local network, review:

- [ ] No real authentication — see [docs/ARCHITECTURE.md#authentication-model](ARCHITECTURE.md#authentication-model)
- [ ] No TLS anywhere in the stack (client↔server, or within ELK)
- [ ] No automated backups
- [ ] No rate limiting / abuse protection on the API
- [ ] SQLite has no encryption at rest

All five are tracked in [docs/ROADMAP.md](ROADMAP.md).
