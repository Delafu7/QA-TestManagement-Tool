# Development Guide

## Prerequisites

- Node.js 20+ and npm
- Docker + Docker Compose (only needed if you want the full ELK stack or a production-like run)

## Running the backend

```bash
cd server
npm install
npm run dev      # node --watch src/server.js — restarts on file change
# or
npm start        # plain node src/server.js
```

Listens on `http://localhost:4000` by default (`PORT`). By default it stores its SQLite file at `server/data/qa-tool.sqlite` and its logs at `server/logs/server.ndjson` (both git-ignored, created on demand).

### Environment variables

| Variable | Default (local) | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `SQLITE_DB_PATH` | `server/data/qa-tool.sqlite` | SQLite file location |
| `LOG_FILE_PATH` | `server/logs/server.ndjson` | NDJSON log file location |
| `NOTION_API_BASE_URL` | `https://api.notion.com/v1` | Override for testing against a Notion API mock |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limiting window, in ms, for `/api/*` |
| `RATE_LIMIT_MAX` | `300` | Max requests per client IP per window before a `429` |

No `.env` file is read automatically — export these in your shell or prefix the command, e.g. `PORT=4100 npm run dev`.

### Seeding sample data

```bash
cd server
npm run seed
```

Populates: 3 users (2 `qa`, 1 `gestor`), 1 project, suites, tags, tagged test cases, two testing cycles (one with closed executions in a realistic pass/fail mix, one still pending), and defects across several states. **Only runs against an empty database** — if `usuarios` already has rows, it exits with an error rather than duplicating data. To reseed, delete the SQLite file (or point `SQLITE_DB_PATH` at a fresh one) first.

### Backend tests

```bash
cd server
npm test    # runs the test/ suite (node:test) via node --test test/*.test.js
```

Each `test/*.test.js` file boots the Express app in-process against its own in-memory SQLite database (`node --test` isolates each file in its own process, so this is safe) and exercises it over real HTTP with the built-in `fetch`. Coverage includes: state-machine transitions and integrity rules for casos/suites/ciclos/ejecuciones/defectos, the `X-User-Id` auth and `requireRole` gating, the Notion export client's retry/backoff and systemic-vs-per-item error handling (against a local fake HTTP server, not the real Notion API), and JSON/Markdown export shape. See `server/test/helpers/` for the shared test server and fixture builders.

## Running the frontend

```bash
cd client
npm install
npm run dev       # Vite dev server, http://localhost:5173
```

The dev server proxies `/api/*` to `http://localhost:4000` (`client/vite.config.js`) — start the backend first, or requests will fail.

```bash
npm run build      # production build to client/dist
npm run preview     # serve that build locally
npm run lint         # oxlint
```

## Linting & CI

- Client: `oxlint` (`client/.oxlintrc.json`).
- Server: no linter configured; CI runs `node --check src/app.js` (syntax check) plus the `test/` suite.
- `.github/workflows/ci.yml` runs three jobs on every push/PR to `master`/`main`: backend (`npm ci` → syntax check → `npm test`), frontend (`npm ci` → `npm run lint` → `npm run build`), and a Docker build check (`docker compose config`, then builds both images).

Run the same checks locally before pushing:

```bash
(cd server && npm ci && node --check src/app.js && npm test)
(cd client && npm ci && npm run lint && npm run build)
docker compose config
```

## Conventions worth knowing

- **Domain language is Spanish.** Entities, fields, routes, and error messages use Spanish names throughout the codebase (`caso`, `ciclo`, `ejecucion`, `defecto`...). This documentation describes that API in English, but code contributions should keep using the existing Spanish vocabulary for consistency — don't partially translate identifiers.
- **CommonJS on the server**, ES modules on the client — don't mix `require`/`import` within a package.
- **No ORM.** `server/src/models/*.model.js` files contain hand-written SQL via `better-sqlite3`'s synchronous API. New queries follow that pattern rather than introducing a query builder.
- **Layering is enforced by convention, not by tooling**: routes stay thin, business rules and state-transition checks belong in `services`, HTTP-shaping stays in `controllers`. See [docs/ARCHITECTURE.md](ARCHITECTURE.md#6-responsibilities-by-layer).
- **IDs are UUID v4**, generated server-side (`server/src/utils/ids.js`) — never rely on SQLite's row id.
- **Dates**: store and return UTC ISO 8601 for datetimes; plain `YYYY-MM-DD` for calendar-only fields (cycle start/end). Convert to the viewer's local time only in the client, at render time.
- **Every new mutating endpoint** should go through a `services` function so it participates in the same validation/logging path as the rest — don't put business logic directly in a controller.

## Where to look next

- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — how the pieces fit together
- [docs/DATA_MODEL.md](DATA_MODEL.md) — entities, state machines, integrity rules
- [docs/API.md](API.md) — endpoint-by-endpoint reference
- [docs/design/](design/) — original design rationale (Spanish)
