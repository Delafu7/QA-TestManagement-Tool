# QA Test Management Tool — server

Express REST API for the QA Test Management Tool, backed by SQLite (`better-sqlite3`). See the [project root README](../README.md) for what this app does and how to run the full stack.

## Local development

```bash
npm install
npm run dev      # node --watch src/server.js, http://localhost:4000
```

```bash
npm run seed      # populate an empty DB with realistic sample data
npm test           # runs scripts/smoke-test.js
```

Environment variables (`PORT`, `SQLITE_DB_PATH`, `LOG_FILE_PATH`, `NOTION_API_BASE_URL`) are documented in [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md#environment-variables).

## Structure

| Folder | Contents |
|---|---|
| `src/routes/` | One router per resource — wires HTTP verbs to controllers |
| `src/controllers/` | Request/response shaping |
| `src/services/` | Business rules: state machines, derived metrics, orchestration |
| `src/models/` | Data access — hand-written SQL over `better-sqlite3` |
| `src/middleware/` | Auth (`X-User-Id`), request logging, error handling |
| `src/integrations/` | Outbound Notion API client |
| `src/db/` | `schema.sql` + connection setup |
| `scripts/` | `seed.js`, `smoke-test.js` |

Full architecture, API reference, and data model docs live in [`/docs`](../docs) at the repo root.
