# ARCHITECT — Meta-agent for Averrow

ARCHITECT is Averrow's self-awareness layer: a meta-agent that periodically
scans the platform, builds a structured snapshot of how it's wired together,
and (in later phases) uses Claude to produce a weekly architectural review
that an engineer can action.

The agent is built in phases. **This document describes Phase 1 only** —
context collection. No AI calls, no report generation, no UI.

---

## Phases

| Phase | Name                     | Status    | Scope                                                                 |
| ----- | ------------------------ | --------- | --------------------------------------------------------------------- |
| 1     | Context collectors       | **Done**  | Three pure collectors + CLI + R2 bundle storage                       |
| 1.5   | Admin trigger + runs view| **Done**  | Super-admin HTTP routes + `/admin/architect` page to start runs & inspect bundles |
| 2     | Haiku inventory pass     | Planned   | Per-file classification, deprecation flags, unused-code hints         |
| 3     | Sonnet synthesis         | Planned   | Cross-cutting narrative — what's drifting, what's expensive, what's risky |
| 4     | Flight Control wiring    | Planned   | ARCHITECT becomes a scheduled agent with `agent_runs` + `agent_events` integration |
| 5     | UI surface (full)        | Planned   | Operator dashboard with historical diffs, proposal review, approve/reject flow |
| 6     | Docs rollup              | Planned   | Auto-generated reference docs derived from the weekly bundle          |

Each phase is additive; Phase 1 must continue to run cleanly after later
phases land.

---

## What Phase 1 collects

Every run produces a **ContextBundle** — a single JSON document that is the
source of truth for everything downstream phases will analyse. The bundle is
written to `/tmp/architect-bundle-<run_id>.json` and uploaded to R2 at
`architect/bundles/<run_id>.json`.

### Bundle schema (v1)

```ts
interface ContextBundle {
  bundle_version: 1;
  run_id: string;          // uuid
  generated_at: string;    // ISO
  repo: RepoInventory;     // repo collector output
  data_layer: DataLayerInventory;
  ops: OpsTelemetry;
}
```

The full TypeScript types live in
[`packages/trust-radar/src/agents/architect/types.ts`](../../packages/trust-radar/src/agents/architect/types.ts).

### Collector contracts

Each collector is a single async function with a narrow responsibility:

| Collector                       | Signature                                                         | Reads from                                           |
| ------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| `collectRepoInventory(rootDir)` | `(string) => Promise<RepoInventory>`                              | Filesystem (`fs/promises`) only — no network         |
| `collectDataLayerInventory(env)`| `(Env) => Promise<DataLayerInventory>`                            | D1 `sqlite_master`, per-table `COUNT(*)`, `dbstat`   |
| `collectOpsTelemetry(env)`      | `(Env) => Promise<OpsTelemetry>`                                  | D1 `agent_runs`, `budget_ledger`                     |

**repo** walks every `packages/*/src/agents/` and `packages/*/src/feeds/`
tree, parses each `wrangler.toml` it finds, and returns a per-file inventory
(LOC, last-modified, triggers, referenced D1 tables, referenced Claude
models). It uses a deliberately conservative regex pass — good enough for a
downstream AI to reason about, not an AST-level source of truth.

**data-layer** lists every user table in D1, counts rows, counts indexes,
estimates byte size (via `dbstat` when compiled in, otherwise a page-size
fallback), and computes 7-day row growth by comparing against the
`architect_table_snapshots` ledger. It inserts a fresh snapshot row per
table at the end of each run so the next run has a delta baseline.

Table names coming out of `sqlite_master` are whitelisted against an
identifier regex before being interpolated into `COUNT(*)` queries because
D1 cannot bind identifiers. All other values use prepared statements.

**ops** aggregates 7 days of `agent_runs` (runs, successes, failures,
average duration, last error) and joins in AI spend from `budget_ledger`
(per agent and per model). Sources that aren't wired yet — Cloudflare
Queues depth, AI Gateway cache hit rate, Cron Trigger analytics — return
zeros or `null` with a `TODO` comment. **Never fabricate values.**

---

## Running the collector

### One-shot against dev D1

```bash
cd packages/trust-radar
pnpm architect:collect
```

Default behaviour:
- `run_type` = `weekly`
- Target env = the `dev` wrangler environment
- R2 bucket = `averrow-architect-bundles`
- D1 binding = `DB`

### Environment variables

| Var                      | Default                       | Purpose                                              |
| ------------------------ | ----------------------------- | ---------------------------------------------------- |
| `ARCHITECT_RUN_TYPE`     | `weekly`                      | One of `weekly`, `ondemand`, `deep`                  |
| `ARCHITECT_WRANGLER_ENV` | `dev`                         | `wrangler --env` target                              |
| `ARCHITECT_R2_BUCKET`    | `averrow-architect-bundles`   | Destination R2 bucket                                |
| `ARCHITECT_D1_BINDING`   | `DB`                          | D1 binding name for the main database                |

### Prerequisites

1. Migration `0070_architect_reports.sql` applied:
   ```bash
   pnpm db:migrate:local   # local dev
   pnpm db:migrate:prod    # remote
   ```
2. R2 bucket exists:
   ```bash
   wrangler r2 bucket create averrow-architect-bundles
   ```
3. The machine running the CLI must have a wrangler session with access to
   the target D1 database and R2 bucket (`wrangler login` or a configured
   API token).

---

## Run lifecycle

Every invocation transitions a row in `architect_reports` through these
states:

```
  (insert)                    (finally)
  collecting  ─────▶  complete
       │
       └────────────▶  failed  (error_message, duration_ms captured)
```

`analyzing` is reserved for Phase 2+; Phase 1 never enters it. The CLI
catches **every** thrown error, marks the row failed, logs, and rethrows.
No silent failures.

---

## Triggering from the UI

Phase 1.5 adds a super-admin-gated control page at **`/admin/architect`**
and three HTTP routes on the Worker. Everything rides on the same
`runCollect()` core that the CLI uses — the route inserts the
`architect_reports` row eagerly, then runs the collector in
`ctx.waitUntil` so the HTTP response returns immediately.

### Routes

| Method | Path                                    | Purpose                                                          |
| ------ | --------------------------------------- | ---------------------------------------------------------------- |
| POST   | `/api/admin/architect/collect`          | Start a run. Body: `{ run_type?: 'ondemand' \| 'deep' }`         |
| GET    | `/api/admin/architect/runs?limit=20`    | List recent runs (ordered by `created_at DESC`)                  |
| GET    | `/api/admin/architect/runs/:run_id`     | Single run row + the R2 bundle JSON (when `status = 'complete'`) |

All three require a super-admin JWT. The POST route enforces a 30-minute
concurrency guard — if any row in `architect_reports` is still in
`collecting` or `analyzing` status within the last 30 minutes, the route
returns **409 Conflict** with:

```json
{
  "success": false,
  "error": "architect_run_in_progress",
  "run_id": "…",
  "status": "collecting"
}
```

On a fresh start the route returns **202 Accepted**:

```json
{
  "success": true,
  "run_id": "…",
  "status": "collecting",
  "started_at": "2026-04-09T12:34:56.000Z"
}
```

The collector then finishes in the background and flips the row to
`complete` (with the R2 key + duration) or `failed` (with the error
message). The UI polls every 10 seconds while any row is non-terminal
so the status pill updates automatically.

### UI

The `/admin/architect` page is the minimal surface:

- **Run Collection** — primary amber button, triggers `run_type: 'ondemand'`
- **Deep Run** — secondary button, triggers `run_type: 'deep'`
- **Recent Runs** table with Started / Type / Status / Duration / Cost / Bundle
- Clicking **view** on a complete run opens a bundle viewer modal that
  pulls the JSON through the GET `:run_id` route (the Worker proxies it
  from R2 via the binding — no presigned URLs)
- Failed runs show the truncated error message inline

The page lives at
[`packages/averrow-ui/src/features/admin/Architect.tsx`](../../packages/averrow-ui/src/features/admin/Architect.tsx)
and uses the thin typed client at
[`packages/averrow-ui/src/api/architectApi.ts`](../../packages/averrow-ui/src/api/architectApi.ts).

This surface is intentionally minimal — it lets an operator kick a run
and confirm the bundle landed. Phase 5 is where the richer dashboard
(historical diffs, proposal review, approval flow) lives.

---

## File map

```
packages/trust-radar/
├── migrations/
│   └── 0070_architect_reports.sql    # architect_reports + architect_table_snapshots
└── src/
    ├── routes/
    │   └── architect.ts              # POST /collect + GET /runs[/:id] admin routes
    └── agents/architect/
        ├── types.ts                  # ContextBundle + all collector output types
        ├── core.ts                   # runCollect() — runtime-agnostic lifecycle
        ├── wrangler-shim.ts          # Node-side D1 shim over `wrangler d1 execute`
        ├── cli.ts                    # pnpm architect:collect entry (Node-only wrapper)
        └── collectors/
            ├── repo.ts               # collectRepoInventory(rootDir)
            ├── data-layer.ts         # collectDataLayerInventory(env)
            └── ops.ts                # collectOpsTelemetry(env)

packages/averrow-ui/src/
├── api/
│   └── architectApi.ts               # Typed client — startArchitectRun, listArchitectRuns, getArchitectRun
└── features/admin/
    └── Architect.tsx                 # /admin/architect cockpit page
```

---

## Out of scope for Phase 1 / 1.5

These are intentionally **not** built yet and should not be added to the
current phases:

- AI calls of any kind (Haiku, Sonnet, embeddings)
- Report generation / markdown synthesis
- Cron wiring / scheduled execution
- Approval workflow (the UI can trigger runs but cannot approve proposals)
- Notifications / email / Slack

Phase 2 is where the Haiku inventory pass lives. Start there when you're
ready to make ARCHITECT more than a collector.
