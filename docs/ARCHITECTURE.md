# Architecture

This is a reference for the system **as implemented**. For the reasoning behind each choice (alternatives considered, trade-offs accepted), see the original design notes in [docs/design/](design/), particularly [`08-decisiones.md`](design/08-decisiones.md).

## 1. Overview

Monorepo, two applications (`/client`, `/server`) orchestrated by Docker Compose, plus an ELK observability stack. It's a locally-run application for one QA team, not a SaaS product.

Fixed stack:

- Frontend: React (`.jsx`), built with Vite
- Backend: Node.js + Express (CommonJS `.js`)
- Data: SQLite (`better-sqlite3`), one file, no separate database server
- Containerization: Docker + Docker Compose
- Observability: Elasticsearch, Logstash, Kibana

## 2. Component diagram

```
┌───────────────────────────────┐
│ Browser (desktop/tablet/mobile)│
│         React SPA (client)     │
└───────────────┬────────────────┘
                 │ HTTP/JSON (proxied by nginx)
                 ▼
┌────────────────────────────────┐        ┌────────────────────┐
│ server (Express REST API)      │──────▶ │ SQLite file          │
│  - validates payloads/transitions│       │ (Docker volume)      │
│  - writes structured logs       │        └────────────────────┘
└───────────────┬────────────────┘
                 │ NDJSON log lines (shared volume)
                 ▼
┌────────────┐   ┌────────────────┐   ┌──────────┐
│ Logstash    │──▶│ Elasticsearch   │──▶│ Kibana    │
└────────────┘   └────────────────┘   └──────────┘

server ──(server-side fetch, export only)──▶ Notion API (external)
```

## 3. Request/data flow

Typical write path (e.g. recording an execution result):

1. User interacts with the React SPA (e.g. marks an execution `failed`).
2. SPA sends `PATCH /api/ejecuciones/:id/resultado` with `X-User-Id` and a JSON body.
3. Express validates the payload shape and the state transition (`server/services`).
4. The service reads/writes SQLite through `server/models`.
5. The request middleware writes one structured NDJSON log line (route, status, duration, user, project).
6. The API responds `200 OK` with the updated resource (or a structured error).
7. The SPA updates its UI from the response.

**Principles:**

- The frontend never touches the database or the ELK stack directly — everything goes through the REST API.
- Business validation (state transitions from [docs/DATA_MODEL.md](DATA_MODEL.md)) lives on the server, never only in the client.
- Every HTTP request to the API produces a structured log entry (see [docs/DEPLOYMENT.md](DEPLOYMENT.md#logging--the-elk-pipeline)).

## 4. Containers and orchestration

| Service | Role | Exposed to host |
|---|---|---|
| `client` | nginx serving the production React build; reverse-proxies `/api/*` to `server` | Yes — `8080:80` |
| `server` | Express REST API, business logic, reads/writes the SQLite file, emits logs | No (reached only via `client`'s proxy) |
| `elasticsearch` | Stores and indexes logs | No (debugging only) |
| `logstash` | Reads the NDJSON log file, parses and forwards to Elasticsearch | No |
| `kibana` | Visualizes the Elasticsearch indices | Yes — `5601:5601` |

There is no dedicated `db` container: SQLite is a file in the `sqlite-data` volume, mounted only by `server`. `client` proxying `/api/*` means the browser only ever talks to one origin, avoiding CORS configuration and not exposing `server`'s port directly.

## 5. Folder structure

### `/client`

```
client/src/
├── api/          # one fetch module per resource (casosApi.js, ciclosApi.js, ...)
├── components/    # reusable UI: modals, EstadoBadge, Sidebar, BottomNav, TagPicker...
├── context/       # UsuarioContext (active user), ProyectoContext (active project)
├── hooks/         # data hooks (useFetch)
├── screens/       # one folder per screen — Dashboard, CasosPrueba, FasesTesting,
│                  # EjecucionCiclo, Resultados
├── styles/        # design tokens (tokens.css) + global app.css
├── App.jsx        # routes
└── main.jsx
```

### `/server`

```
server/src/
├── routes/         # one router per resource, thin — just wires HTTP verbs to controllers
├── controllers/    # request/response shaping, input presence checks
├── services/        # business rules: state machines, derived metrics, orchestration
├── models/          # data access — hand-written SQL over better-sqlite3
├── middleware/       # auth.middleware (X-User-Id), logger, error handler, 404
├── integrations/     # notion.client.js — outbound Notion API client
├── db/                # schema.sql, connection.js
├── app.js             # Express app wiring (no listen())
└── server.js           # entry point — app.listen()
server/scripts/
└── seed.js            # populates an empty DB with realistic sample data
server/test/
├── helpers/            # shared test server (ephemeral port, in-memory SQLite) + fixtures
└── *.test.js           # node:test suite: state machines, integrity rules, auth/roles, export (used by CI)
```

## 6. Responsibilities by layer

| Layer | Responsible for | Not responsible for |
|---|---|---|
| `client` | Rendering, navigation, forms, per-role visual feedback | Definitive business validation, DB access |
| `server/routes` + `controllers` | Receiving the HTTP request, delegating to `services`, shaping the response | Complex business rules |
| `server/services` | Validating state transitions, computing derived fields, orchestrating export | HTTP details |
| `server/models` | Data access | Business logic |
| ELK | App observability (logs, API usage) | Storing business data |

## 7. Error handling

```
services throws a typed error (e.g. invalid transition)
        │
        ▼
errorHandler.middleware.js
        │
        ├─▶ JSON response: { error: { code, message, details } }
        └─▶ structured "error" log entry (tipo: app_error)
                │
                ▼
        Logstash → Elasticsearch → Kibana
```

No business error (`409`, `422`) should ever surface to the user as a blank screen or a generic "something went wrong" — the standard error body always carries a `code` and a human `message` that the client maps to a contextual message per screen (see [docs/API.md](API.md#errors)).

## Authentication model

There is **no real authentication** (no password login, no SSO) in this iteration — deliberately out of scope, not an oversight. Instead:

1. On first load, the user picks (or creates) their identity from an active-user selector; the SPA stores the chosen user in `localStorage`.
2. Every subsequent API request carries an `X-User-Id` header.
3. `server/src/middleware/auth.middleware.js` resolves that header to a user row (`SELECT ... WHERE id = ? AND activo = 1`) and attaches `req.usuarioId` / `req.usuarioRol`.
4. `requireRole(...)` gates specific actions to the `qa` or `gestor` role.

**Accepted risk:** any process with network access to the API can impersonate any user simply by sending their `id`. This is acceptable for a trusted local/internal deployment and **not acceptable** if the app is exposed beyond `localhost`/an internal network — see [docs/ROADMAP.md](ROADMAP.md) for what real authentication would require.

## Configuration reference

| Service | Variable | Purpose | Default |
|---|---|---|---|
| `server` | `PORT` | HTTP port | `4000` |
| `server` | `SQLITE_DB_PATH` | Path to the SQLite file | `server/data/qa-tool.sqlite` (local) / `/data/qa-tool.sqlite` (Docker) |
| `server` | `LOG_FILE_PATH` | Path to the NDJSON log file | `server/logs/server.ndjson` (local) / `/var/log/qa-tool/server.ndjson` (Docker) |
| `server` | `NOTION_API_BASE_URL` | Base URL for the Notion API client | `https://api.notion.com/v1` |
| `client` (dev) | — | Vite dev server proxies `/api` to `http://localhost:4000` (see `client/vite.config.js`) | — |
| `client` (Docker) | — | nginx proxies `/api/` to `http://server:4000/api/` (see `client/nginx.conf`) | — |
