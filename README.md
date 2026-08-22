# QA Test Management Tool

A self-hosted test case management application for small QA teams: organize test suites and test cases, plan testing cycles, execute them, log defects, and export results (JSON, Markdown, or straight into Notion) — with an ELK stack for operational observability.

It is designed to run **locally or on a trusted internal network**, not as a multi-tenant SaaS product. See [Not built for](#not-built-for-yet) below before deploying it anywhere else.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture at a glance](#architecture-at-a-glance)
- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Not built for (yet)](#not-built-for-yet)

## Features

- **Projects** — create, rename, and archive projects; each project owns its own suites, tags, cycles, and defects.
- **Test suites** — hierarchical (nestable) folders of test cases, with rename/move/delete management.
- **Test cases** — title, description, preconditions, priority, type, tags, and an ordered list of steps with expected results. Cases move through a `draft → active → deprecated` lifecycle, and historical executions are preserved instead of being deleted.
- **Testing cycles (phases)** — plan a cycle, assign test cases to it (this generates one pending execution per case), and drive it through `planned → in progress → blocked → completed`.
- **Execution runner** — a dedicated per-cycle screen where a QA engineer takes a case, runs each step, and closes it as `passed` / `failed` / `blocked` / `skipped`, with a retry action to reopen `failed`/`blocked` runs.
- **Defect tracking** — file a defect straight from a failed execution and move it through `open → in progress → resolved → closed`, with a `reopen` path if verification fails.
- **Dashboard** — project-level rollups: totals, active cycles, pass rate, and progress.
- **Export** — download a cycle's results as JSON or a Markdown table, or push them directly into a Notion database (token supplied per request, never stored).
- **Lightweight identity model** — no password login; QA/manager (`qa`/`gestor`) roles are attributed via an active-user selector (`X-User-Id` header), enough to gate who can edit vs. only observe. See [Security & auth model](docs/ARCHITECTURE.md#authentication-model) for the accepted trade-off.
- **Observability** — every API request and business event is logged as structured NDJSON and shipped through Logstash into Elasticsearch/Kibana.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (JSX), React Router, Vite, plain CSS design tokens |
| Backend | Node.js + Express, CommonJS |
| Data | SQLite via `better-sqlite3` (single file, no separate DB server) |
| Logging | Pino → NDJSON |
| Observability | Elasticsearch, Logstash, Kibana (ELK) |
| Integrations | Notion API (export only) |
| Packaging | Docker + Docker Compose, nginx (serves the client build and proxies `/api`) |
| CI | GitHub Actions (lint, build, backend smoke test, Docker build check) |

## Architecture at a glance

```
Browser ──HTTP/JSON──▶ client (nginx, static React build)
                          │  proxies /api/*
                          ▼
                        server (Express) ──▶ SQLite file (volume)
                          │
                          └─▶ NDJSON log file ──▶ Logstash ──▶ Elasticsearch ──▶ Kibana
```

The frontend never talks to the database or to Elasticsearch directly — everything goes through the REST API, and all business-rule validation (state transitions, integrity rules) lives server-side. Full details, diagrams, and the rationale behind each choice are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the original design notes under [docs/design/](docs/design/).

## Quick start

### Option A — Docker Compose (full stack, closest to production)

Requires Docker and Docker Compose.

```bash
docker compose up --build
```

| Service | URL | Notes |
|---|---|---|
| App (client, proxies `/api`) | http://localhost:8080 | Main entry point |
| Kibana | http://localhost:5601 | Observability dashboards |

`server`, `elasticsearch`, and `logstash` are not published to the host by default — only `client` and `kibana` are. The SQLite database starts empty; create your first user and project from the UI, or seed it (see below).

### Option B — Local development (frontend + backend only, no ELK)

Requires Node.js 20+.

```bash
# Terminal 1 — backend
cd server
npm install
npm run dev            # http://localhost:4000, auto-restarts on change

# Terminal 2 — frontend
cd client
npm install
npm run dev             # http://localhost:5173, proxies /api to :4000
```

Optionally seed the database with realistic sample data (users, a project, suites, tagged cases, two cycles with a mix of closed and pending executions, and defects in various states) — only works against an **empty** database:

```bash
cd server
npm run seed
```

Full environment variables, linting, and testing commands are documented in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Project structure

```
QA-TestManagement-Tool/
├── client/                 # React SPA (Vite)
│   └── src/
│       ├── api/             # one fetch module per resource
│       ├── components/      # shared UI (modals, badges, nav, tag picker...)
│       ├── context/         # active user & active project context
│       ├── screens/         # one folder per screen (Dashboard, CasosPrueba, ...)
│       └── styles/          # design tokens + global CSS
├── server/                 # Express REST API
│   └── src/
│       ├── routes/          # one router per resource
│       ├── controllers/     # HTTP request/response shaping
│       ├── services/        # business rules, state machines, derived metrics
│       ├── models/          # data access (better-sqlite3, hand-written SQL)
│       ├── middleware/      # auth, logging, error handling
│       ├── integrations/    # Notion API client
│       └── db/               # schema.sql + connection
│   └── scripts/             # seed.js, smoke-test.js
├── logstash/                # Logstash pipeline + config for the ELK stack
├── docs/                    # documentation (this set, in English)
│   └── design/               # original Spanish-language design specs (pre-implementation)
└── docker-compose.yml
```

## Documentation

| Document | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Component diagram, request/data flow, layering rules, auth model, error handling |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Entities, relationships, state machines, integrity rules, derived fields |
| [docs/API.md](docs/API.md) | Full REST API reference, as actually implemented |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup, environment variables, scripts, linting, testing, conventions |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker Compose services, volumes, ports, the ELK log pipeline, backups |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Execution plan for future iterations — every known gap and idea, enumerated and prioritized |
| [docs/design/](docs/design/) | Original pre-implementation design documents (Spanish). Historical reference for the *why* behind early decisions; treat `docs/` above as the current source of truth where the two disagree. |

## Not built for (yet)

Explicitly out of scope for the current implementation — see [docs/ROADMAP.md](docs/ROADMAP.md) for the full, prioritized list:

- Real authentication (password login, SSO) or multi-tenant access control.
- Deployment outside a trusted local/internal network (the active-user header can be spoofed by anything with network access to the API).
- Integrations beyond Notion (Jira, Slack, email, etc.).
- Offline mode or sync between separate installations.
- Encryption at rest for the SQLite database.
