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

## Terminal runner (optional)

The in-app terminal runner (see [docs/DEVELOPMENT.md](DEVELOPMENT.md#terminal-runner)) is disabled by default and **not** wired into `docker-compose.yml`. To enable it in a Docker deployment, add to `server` in a `docker-compose.override.yml` (or edit `docker-compose.yml` directly, after reading the trust trade-off below):

```yaml
services:
  server:
    environment:
      RUNNER_ENABLED: 'true'
      RUNNER_WORKSPACE_ROOT: /workspace
    volumes:
      - /path/on/the/host/to/your/projects:/workspace:ro
```

A read-only (`:ro`) bind mount is enough for anything that only reads source and runs tests; drop `:ro` only if a suite needs to write into the workspace (e.g. writing coverage output back to disk). Mounting the host's project directories into the `server` container is what makes "navigate registered project directories and run their test suites" possible — it also means the container gains read (or read/write) access to whatever is mounted there, on top of the existing accepted risk that `X-User-Id` can be spoofed by anything with network access to the API. Don't mount anything wider than the QA workspaces themselves.

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

`./scripts/backup.sh` takes a hot backup of the running `server` container's SQLite database (safe with writes in flight — it uses `better-sqlite3`'s online backup API via `server/scripts/backup.js`, not a raw file copy, see [docs/design/08-decisiones.md §15](design/08-decisiones.md#15-estrategia-de-backup-del-archivo-sqlite)) and writes the result to `./backups/` on the host — **outside** the `sqlite-data` Docker volume, so an accidental `docker volume rm sqlite-data` doesn't destroy the backups too.

```bash
./scripts/backup.sh
# → Backup guardado en ./backups/qa-tool-<UTC timestamp>.sqlite
```

**Retention:** the script keeps the **7 most recent** backups in `./backups/` and deletes older ones on every run. Override with `BACKUP_RETENTION=<n>` and the destination with `BACKUP_DIR=<path>` if needed.

**Scheduling:** not run automatically by `docker-compose.yml` — schedule it with a daily entry in the host's crontab:

```cron
0 3 * * * cd /path/to/app && ./scripts/backup.sh >> /var/log/qa-tool-backup.log 2>&1
```

**Failures** (e.g. no disk space, database unreachable) are logged as an `app_error` NDJSON line (`errorCode: "BACKUP_FAILED"`) in the same log stream as the rest of the application (see "Logging & the ELK pipeline" above), so they show up in Kibana like any other error.

**Restore:**

```bash
# server must be stopped first — better-sqlite3 doesn't support hot-swapping the open file
docker compose stop server
docker compose cp ./backups/qa-tool-<timestamp>.sqlite server:/data/qa-tool.sqlite
docker compose start server
```

There is no offsite copy — `./backups/` is local to the Docker host. If the host itself is lost, so are the backups; treat this as covering "accidental volume/container loss," not "hardware loss." Offsite replication and one-click restore are tracked as open follow-ups in [docs/ROADMAP.md](ROADMAP.md) if ever needed.

## Production readiness checklist

Before running this anywhere beyond a trusted local network, review:

- [ ] No real authentication — see [docs/ARCHITECTURE.md#authentication-model](ARCHITECTURE.md#authentication-model)
- [ ] No TLS anywhere in the stack (client↔server, or within ELK)
- [ ] Backups are local-only (see "Backups" above) — no offsite copy
- [ ] SQLite has no encryption at rest

Rate limiting is in place (`RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX` env vars, default 300 req/min per client IP). The remaining items are tracked in [docs/ROADMAP.md](ROADMAP.md).
