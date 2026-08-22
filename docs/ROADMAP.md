# Roadmap & Execution Plan

This is the working backlog for future iterations. It exists so that no idea or gap only lives in someone's head: anything not implemented, not fully designed, or only decided as "out of scope for now" is written down here, with enough context to pick back up later. When a decision changes (a rejected idea becomes wanted, or a listed feature ships), update this file in the same PR.

**How to use this document:** pick from §3 (prioritized backlog) first — it's ordered by rough impact/effort. §1 and §2 are inputs that motivate §3, not separate to-do lists.

## 1. Gaps between the original design and the current implementation

The [docs/design/](design/) documents were written before implementation and are largely followed faithfully. These are the points where the running code and that original design diverge — worth reconciling either by updating the code or by updating the design docs:

| Gap | Design said | Code does | Suggested resolution |
|---|---|---|---|
| Dark mode | Marked `[verify]`/not implemented by default ([design §05](design/05-responsive-y-design-system.md) §5.2) | `client/src/styles/tokens.css` already defines a `[data-theme='dark']` token set and follows `prefers-color-scheme` automatically | Functionally further along than the design doc suggests, but there's no in-app manual toggle — it only follows OS preference. Decide if a manual toggle is wanted (§3). |

**Closed:** role-based authorization (`requireRole`) was wired in across every mutating route in August 2026 — `gestor` is now server-side read-only except export, matching `[[04-ui-ux]]` §1. List pagination now matches the design contract exactly (`{ data, pagination: { page, pageSize, total } }`, defaults 1/20, max 100) on every flat list endpoint; the client auto-pages transparently so existing screens keep showing complete lists without their own pagination UI. See [docs/AUDIT.md](AUDIT.md) for the audit that flagged both and the fixes applied alongside them (an unauthenticated user-role-escalation hole, an FK crash on editing executed test cases, a silently-discarded `ciclo` block comment, and two more FK-crash bugs the new backend test suite turned up independently — deleting a caso or a suite could 500).

## 2. Explicitly out of scope (carried over, still valid)

From [design §08 §20](design/08-decisiones.md#20-fuera-de-alcance-explícito-de-esta-iteración) — these were deliberate exclusions for the first build, not omissions. Re-confirm each still holds before starting new work:

- Real authentication (SSO, password login) or multi-tenancy.
- AI-powered features of any kind.
- Integrations beyond Notion (Jira, Slack, email...).
- Offline mode or sync between separate installations.
- Encryption at rest for the SQLite database.

## 3. Prioritized backlog

Rough sizing: **S** = a few hours, **M** = a few days, **L** = a significant iteration on its own.

### High priority — hardening what exists

| Item | Why | Size |
|---|---|---|
| Automated backups for the SQLite volume | Zero backup today — losing the `sqlite-data` Docker volume means losing all history (see [docs/DEPLOYMENT.md](DEPLOYMENT.md#backups)) | S |
| Frontend test suite | No component/interaction tests exist at all today | M |

**Closed:** `requireRole`/permission matrix (see §1 note above); a real backend test suite — `npm test` now runs `server/test/*.test.js` (`node:test`, unit + integration) covering state-machine transitions, integrity rules, auth/role gating, and export logic (JSON/Markdown + a mocked Notion client), replacing the old two-endpoint smoke test; list pagination on every flat list endpoint (see §1 note above), with the client updated to auto-page transparently rather than silently truncating; and basic rate limiting (`RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`, default 300 req/min per client IP) on all of `/api/*`.

### Medium priority — clear product value, not yet designed

| Item | Why | Size |
|---|---|---|
| Bulk import of test cases (CSV/Excel) | Explicitly flagged as an open question in [design §08 §14](design/08-decisiones.md#14-preguntas-abiertas-pendientes-de-validar-con-el-equipo) — teams migrating from a spreadsheet or another tool need this to adopt the app at all | M |
| Full-text search across test cases/suites/defects | No search endpoint or UI exists; today the only way to find something is filtering within a suite or project | M |
| Attachments on executions and defects (screenshots, logs) | A `failed`/`blocked` execution or a defect currently only supports a text `comentario` — no way to attach evidence | M |
| Comments/activity feed on defects | Defects only carry state transitions today, no discussion thread; useful once more than one person works a defect | S |
| Suite-level and project-level reports (not just per-cycle export) | Export today is scoped to a single cycle (`/api/ciclos/:cicloId/export/*`); there's no rollup export across cycles or a whole project | M |
| Defect linking to external trackers (Jira, GitHub Issues) by URL/ID | A lightweight alternative to a full second integration — just store a reference, no API sync | S |
| In-app notifications ("you were assigned an execution", "a defect you reported was reopened") | No notification mechanism exists; relies on people checking screens manually | M |
| Manual dark/light theme toggle | The token infrastructure already exists (§1); only the UI control is missing | S |
| Test case versioning / change history | Editing an active case's steps today overwrites them with no diff or history — a case's evolution isn't auditable independent of executions | M |

### Lower priority / needs a product decision first

| Item | Why | Size |
|---|---|---|
| Requirements traceability (link test cases to requirements/user stories) | Not modeled at all today; would need a new entity and relation | L |
| Custom fields on test cases/defects | Current schema is fixed; some teams want project-specific fields | L |
| Additional integrations beyond Notion (Jira, Slack, email digests) | Explicitly out of scope for now (§2); revisit only if user demand is concrete | L |
| Localization / multi-language UI | Domain language and UI copy are Spanish-only throughout; no i18n layer exists | L |
| Real authentication (SSO/password login) | Out of scope by design (§2) — required before the app could ever be exposed outside a trusted network | L |
| Encryption at rest for SQLite | Out of scope by design (§2); would also block persisting the Notion token, which is a related open question below | M |
| Migrate off SQLite to PostgreSQL | Only worth doing if `SQLITE_BUSY` write contention becomes a real problem with multiple concurrent QA writers on the same cycle (the documented trigger condition in [design §08 §19](design/08-decisiones.md#19-criterios-para-revisar-estas-decisiones-en-el-futuro)) | L |

## 4. Open product questions

Carried from [design §08 §14](design/08-decisiones.md#14-preguntas-abiertas-pendientes-de-validar-con-el-equipo) — unresolved, and blocking the related backlog items above until answered:

| Question | Blocks |
|---|---|
| Is CSV/Excel import of existing test cases needed? | Bulk import item above |
| How many concurrent projects will a team realistically manage? | Whether the SQLite decision needs revisiting sooner rather than later |
| Should Notion's `Ejecutor` property map to a real Notion `people` field instead of plain text, for teams that use Notion internally? | Any rework of the Notion export mapping |
| Is dark mode needed from the next release, or can it stay OS-preference-only? | Manual theme toggle item above |
| Should the Notion export token ever be persisted (with encryption), to remove the per-export re-entry friction? | Encryption-at-rest item above; currently accepted as a deliberate trade-off ([design §08 §6](design/08-decisiones.md#6-persistencia-del-token-de-notion)) |

## 5. Suggested next iteration

If picking a single next slice of work, the remaining items in §3's "High priority" table are the most load-bearing — they don't add new user-facing surface area, but they close real gaps in what's already shipped (no backups, no frontend test coverage). Everything in "Medium priority" is genuinely useful but additive, and can be sequenced independently once the high-priority items are closed out.
