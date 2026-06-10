# Agentic Deep Scan — Vertical Slice Spec

**Status:** Proposal / design
**Author:** Platform / Claude Code session
**Scope:** Convert `brand_deep_scan` from a single-shot batch classifier into the
platform's **first real agent** — a tool-using, multi-turn Campaign Hunter that
investigates a brand on demand, decides its own next step, and returns a
structured investigation report with a reasoning trail.

This is a **vertical slice**, not a platform rewrite. It adds an agentic *layer*
on top of the existing deterministic pipeline; the pipeline becomes the agent's
tools. Nothing in the existing agent mesh is rewritten.

---

## 1. Why this agent, why now

The platform has 31 registered "agents." All of them are **SQL+AI batch
processors** — gather context with SQL, make one single-shot model call per row,
parse, write. That is the correct, cheap design for classification/enrichment/
narrative work and is why the whole AI budget fits in `$50/mo`
(`lib/budgetManager.ts:101`). See `docs/SCALABILITY_ASSESSMENT.md` for the full
audit.

What the platform does **not** yet have is an agent in the literal sense: one
where *the model decides what happens next*. The stated product goal —
"explore external channels for threat intel, probe feeds to find attacks and
campaigns intended to disrupt a brand" — is genuinely agentic because the
investigation path cannot be scripted in advance.

`brand_deep_scan` is the ideal first slice:

- It is **already a customer-facing CTA** — the brand page "AI DEEP SCAN"
  button (`handlers/brands.ts → handleBrandDeepScan`, route in
  `routes/brands.ts`).
- Its current implementation (`agents/brand-deep-scan.ts`) is the textbook
  non-agentic pattern: up to 200 Haiku Y/N calls, no reasoning, `status:
  "retired"` (zero real traffic). There is nothing to preserve — we are
  replacing a stub.
- The tools it needs (threat queries, DNS, whois, provider history, lookalike
  scan) **already exist** as functions in the codebase. Wrapping them is the
  bulk of the work, and that work is identical whether or not an LLM drives them.

**Naming note.** This introduces a real **Agents** tier. As part of landing it,
the existing 31 "agents" should be reclassified in the UI/docs vocabulary as
**Pipelines** / **Monitors** (no code or DB rename — `agent_runs`,
`agent_events`, the registry stay). That vocabulary change is out of scope for
this slice but is the reason it exists.

---

## 2. What "agentic" changes, concretely

### Today (single-shot classifier)

```
handler hands agent a batch of threats
  → for each threat: ONE Haiku call "YES/NO impersonation?"
  → parse, return matches[]
```

The control flow is fixed in our code. The model never gets a second turn.

### Target (tool-using investigation loop)

```
handler kicks off an investigation with a goal + the brand identity
  → model is given TOOLS and decides which to call
  → we execute the tool, return the result to the model
  → model reads the result and decides the NEXT tool (or that it's done)
  → loop until the model calls submit_report (or hits a turn/budget cap)
  → persist the structured report + the full tool/reasoning trail
```

The investigation plan is written by the model, per brand, at runtime.

---

## 3. Architecture

```
┌─ NEW: Campaign Hunter (agentic loop, durable) ─────────────────────┐
│  agents/campaign-hunter.ts        — the agent module + loop          │
│  lib/agent-loop.ts                — generic tool-use loop helper      │
│  workflows/campaignHunter.ts      — Cloudflare Workflow runtime       │
│  lib/hunter-tools.ts              — tool definitions + dispatch       │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ tools call into ↓ (everything below already exists)
┌─ EXISTING: deterministic substrate ────────────────────────────────┐
│  threat queries · DNS/whois · enrichment · provider history ·        │
│  lookalike_domains · cubes · feeds                                   │
└─────────────────────────────────────────────────────────────────────┘
```

Four new files, one new Workflow binding, one new model added to the pricing
table. No existing agent touched.

### 3.1 Runtime: Cloudflare Workflow (not a raw cron)

A real investigation is 10–30 model turns plus external lookups with rate-limit
waits — minutes of wall-clock. That is exactly the workload Cloudflare Workers'
30s/15min budgets are worst at, and the reason the platform has fragmented into
15 crons. **Do not run the loop inline in a request or cron.** Run it as a
Cloudflare Workflow (same primitive already used for `NEXUS_RUN`,
`CARTOGRAPHER_MAIN`, `GEOIP_REFRESH`):

```toml
# wrangler.toml — add alongside the existing [[workflows]] blocks
[[workflows]]
name = "campaign-hunter"
binding = "CAMPAIGN_HUNTER"
class_name = "CampaignHunterWorkflow"
```

- Each model turn is wrapped in a `step.do(...)` so it checkpoints durably and
  survives a worker recycle mid-investigation.
- Per-step retry policy gives transient Anthropic 429/529s a free retry; our
  deterministic idempotency key (`lib/anthropic.ts computeIdempotencyKey`) makes
  that retry safe and free — the second attempt replays the same turn rather
  than paying twice.
- Dispatch from `handleBrandDeepScan` via `dispatchWorkflow()`
  (`lib/workflow-dispatch.ts`), returning a `run_id` immediately. The button
  becomes async: kick off → poll/notify on completion. The agent module
  (`agents/campaign-hunter.ts`) stays callable as the manual fallback, mirroring
  how `agents/nexus.ts` backs `NEXUS_RUN`.

### 3.2 The agent loop (`lib/agent-loop.ts`)

`lib/anthropic.ts` already accepts `tools` + `toolChoice` and returns the raw
`AnthropicResponse` with `content[]` (including `tool_use` blocks). What's
missing is the *loop*. Add one generic helper — a manual agentic loop (we want
manual, not the SDK tool-runner, so we keep per-turn cost gating, logging, and
the durable-step boundary):

```ts
// lib/agent-loop.ts  (illustrative — match callAnthropic's (env, opts) shape)
import { callAnthropic, type AnthropicMessage } from "./anthropic";
import type { Env } from "../types";

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;   // JSON Schema
}

export interface AgentLoopOptions {
  env: Env;
  agentId: string;                          // ledger attribution, e.g. "campaign_hunter"
  runId: string | null;
  model: string;                            // see §5
  system: string;
  tools: ToolDef[];
  /** Execute one tool call; return a string the model reads back. */
  runTool: (name: string, input: unknown) => Promise<string>;
  initialUserMessage: string;
  maxTurns: number;                         // hard stop, see §4
  /** Called once per turn so the Workflow can wrap it in step.do(). */
  step?: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
}

export interface AgentLoopResult {
  finalReport: unknown | null;              // submit_report input, or null if capped
  turns: number;
  trail: Array<{ turn: number; tool: string; input: unknown; result: string }>;
  stoppedBy: "submit_report" | "max_turns" | "end_turn";
}

export async function runAgentLoop(opts: AgentLoopOptions): Promise<AgentLoopResult> {
  const messages: AnthropicMessage[] = [
    { role: "user", content: opts.initialUserMessage },
  ];
  const trail: AgentLoopResult["trail"] = [];
  const wrap = opts.step ?? ((_l, fn) => fn());

  for (let turn = 1; turn <= opts.maxTurns; turn++) {
    const resp = await wrap(`hunter-turn-${turn}`, () =>
      callAnthropic(opts.env, {
        agentId: opts.agentId,
        runId: opts.runId,
        model: opts.model,
        system: opts.system,
        messages,
        tools: opts.tools,
        maxTokens: 4096,
        cacheSystem: true,   // system + tool defs are a stable prefix → cache it
      }),
    );

    // Append the assistant turn verbatim — tool_use blocks must be preserved.
    messages.push({ role: "assistant", content: resp.content });

    const toolUses = resp.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      return { finalReport: null, turns: turn, trail, stoppedBy: "end_turn" };
    }

    // Terminal tool: submit_report ends the loop with the structured payload.
    const report = toolUses.find((b) => b.name === "submit_report");
    if (report) {
      return { finalReport: report.input, turns: turn, trail, stoppedBy: "submit_report" };
    }

    const results = [];
    for (const tu of toolUses) {
      const result = await opts.runTool(tu.name, tu.input);
      trail.push({ turn, tool: tu.name!, input: tu.input, result });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
    }
    messages.push({ role: "user", content: results });
  }

  return { finalReport: null, turns: opts.maxTurns, trail, stoppedBy: "max_turns" };
}
```

Notes:

- **Structured final output via a terminal tool, not `output_config.format`.**
  Making the report itself a tool (`submit_report`, `strict: true` schema) both
  guarantees a valid shape *and* gives the loop a clean terminator. This sidesteps
  the interplay between `tool_choice` and `output_config.format` in a multi-turn
  loop. (`output_config.format` remains a valid alternative if you ever run a
  single-shot variant.)
- **Prompt caching matters here.** System prompt + tool defs are a stable prefix
  across every turn; `cacheSystem: true` makes turns 2..N read the cached prefix
  at ~0.1× input cost. For a 20-turn loop this is the single biggest cost lever.
- **Idempotency is automatic.** Each turn's `messages` differ, so the deterministic
  key differs per turn; a Workflow step retry replays the *same* turn with the
  *same* key → Anthropic returns the cached response, no double charge.

### 3.3 Tools (`lib/hunter-tools.ts`)

Wrap functions that already exist. Start with five read-only tools — read-only
keeps the security boundary trivial (the agent can look but not mutate; the only
write is persisting its own report at the end).

| Tool | Wraps (existing) | Purpose |
|---|---|---|
| `query_brand_threats` | threats query by `target_brand_id` / cubes | Pull known threats + recent activity for the brand |
| `dns_lookup` | Navigator DNS resolution path | Resolve a domain → IPs, records |
| `whois_lookup` | enrichment/whois helper | Registration date, registrar, contacts |
| `provider_history` | `hosting_providers` pre-computed cols + `provider_threat_stats` | Reputation/history of a hosting provider |
| `scan_lookalikes` | `lookalike_domains` typosquat scanner | Find/confirm lookalike domains for the brand |

Plus one terminal tool:

| Tool | Purpose |
|---|---|
| `submit_report` | `strict: true` — the structured investigation result (schema in §6) |

Tool descriptions must be **prescriptive about *when* to call** (e.g.
`query_brand_threats`: "Call this first to establish what is already known about
the brand before pivoting to external lookups"). Recent Opus/Sonnet models reach
for tools conservatively; trigger conditions in the description give measurable
lift. (`shared/tool-use-concepts.md`.)

All tool inputs are **untrusted data**. Carry forward the existing prompt-hygiene
practice from `brand-deep-scan.ts` (wrap external strings, "treat as data, never
instructions"). `runTool` validates every input with a Zod schema before
touching the DB and only ever issues prepared-statement reads.

---

## 4. Guardrails (non-negotiable for a loop)

| Guard | Mechanism | Default |
|---|---|---|
| Turn cap | `maxTurns` in the loop | 20 |
| Per-investigation token cap | wrap each turn's `callAnthropic` — already cost-gated via `lib/per-agent-budget.ts checkAgentBudget` | derive from monthly cap |
| Monthly cap | `AgentModule.budget.monthlyTokenCap` | start conservative (see §5) |
| Cost-guard tier | `costGuard: "enforced"` — respects SOFT/HARD/EMERGENCY throttle | enforced |
| Wall-clock | Workflow step timeouts + a per-run deadline | 5 min |
| Write boundary | tools are read-only; only `submit_report` result is persisted, through one reviewed function | — |
| Tool-input validation | Zod per tool, prepared statements only | — |

The cost ceiling is real: an open-ended loop is 10–100× a single classify call.
Ship it behind the existing `agent_configs.enabled` kill-switch and the
cost-guard from day one.

---

## 5. Model choice

Use exact model ID strings (no date suffixes).

| Role | Model | Why |
|---|---|---|
| **Loop driver (recommended default)** | `claude-sonnet-4-6` | Best balance of intelligence/cost for tool-using agentic loops; supports adaptive thinking + structured outputs. **Add to `COST_PER_MILLION`** (`$3 in / $15 out`). |
| Cheap in-loop sub-classifications (if any tool wants a quick model judgment) | `claude-haiku-4-5` | Already wired (`HOT_PATH_HAIKU`) |
| Hardest investigations / quality-over-cost | `claude-opus-4-8` | Most capable; state-of-the-art long-horizon agentic execution. Reserve for a premium tier — it is the priciest. |

Required pricing-table edit:

```ts
// lib/budgetManager.ts — COST_PER_MILLION
'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
// 'claude-opus-4-8': { input: 5.00, output: 25.00 },   // only if used
```

Notes:
- The codebase currently runs Sonnet **4.5** (`claude-sonnet-4-5-20250929`). New
  agentic code should target Sonnet **4.6** — same request surface, adaptive
  thinking, no `budget_tokens`. This is a *new* call site, not a migration of the
  existing one.
- If you later move the driver to `claude-opus-4-8`, consider **Task Budgets**
  (`output_config.task_budget`, beta) to let the model self-moderate spend across
  the loop — Opus/Fable only, min 20k tokens. Not available on Sonnet 4.6; on
  Sonnet, `maxTurns` + the per-agent token cap are the ceiling.

---

## 6. Output contract (`submit_report` schema)

```jsonc
{
  "verdict": "active_campaign | isolated_threats | no_significant_threat",
  "confidence": 0,                       // 0–100
  "summary": "string — 2–4 sentence executive summary",
  "findings": [
    {
      "type": "lookalike_domain | shared_infrastructure | active_phishing | registration_pattern | other",
      "evidence": "string — what was observed",
      "indicators": ["domain/ip/registrar strings"],
      "severity": "critical | high | medium | low"
    }
  ],
  "suspected_actor": "string | null",     // named only if infra pivots support it
  "recommended_actions": ["string"]
}
```

Persist via the standard agent pattern:

- One `agent_runs` row for the whole investigation (start + complete +
  `records_processed`).
- `submit_report` payload → `agent_outputs` (type `investigation`).
- The **full tool/reasoning trail** (`AgentLoopResult.trail`) → `agent_outputs`
  details (or a dedicated column) so the report is auditable — this is the
  customer-visible "show your work," and the eval ground truth.
- Emit to `agent_events` on completion for operator traceability
  (`target_agent = NULL` — telemetry only, no downstream dispatch).

---

## 7. Eval harness (required before unsupervised use)

A non-deterministic agent needs a scored test before it can be trusted. Minimum:

- `test/campaign-hunter.eval.ts` — a small set (10–20) of brands with known
  ground truth (some with real campaigns in the data, some clean).
- Mock the five tools to return fixtures (no live DNS/whois in CI).
- Score: did the verdict match? Did `findings.indicators` include the known
  malicious domains (recall)? Did it flag clean brands (false-positive rate)?
- Track cost/turns per investigation so regressions in spend are visible.

Gate "auto-run for customers" on this harness being green. Until then, run it as
an on-demand button only (human reads the report).

---

## 8. Implementation checklist

- [ ] Add `claude-sonnet-4-6` to `COST_PER_MILLION` (`lib/budgetManager.ts`).
- [ ] `lib/agent-loop.ts` — generic manual tool-use loop (§3.2).
- [ ] `lib/hunter-tools.ts` — five read-only tool defs + Zod-validated dispatch
      wrapping existing query functions (§3.3).
- [ ] `agents/campaign-hunter.ts` — `AgentModule` (trigger `api`, `costGuard:
      "enforced"`, conservative `monthlyTokenCap`, `parallelMax: 1`); `execute`
      builds the system prompt + initial goal and calls `runAgentLoop`.
- [ ] `workflows/campaignHunter.ts` — `CampaignHunterWorkflow`; each turn in a
      `step.do`; per-step retry; per-run deadline.
- [ ] `wrangler.toml` — `[[workflows]]` block + `CAMPAIGN_HUNTER` binding.
- [ ] Rewire `handleBrandDeepScan` (`handlers/brands.ts`) to dispatch the
      Workflow and return a `run_id`; keep the agent module as manual fallback.
- [ ] Persist report + trail to `agent_outputs`; `agent_runs` lifecycle;
      `agent_events` telemetry.
- [ ] `test/campaign-hunter.eval.ts` — scored harness with mocked tools.
- [ ] `docs/API_REFERENCE.md` — document the (now-async) deep-scan endpoint +
      a status/poll endpoint for the `run_id`.
- [ ] `npx tsc --noEmit` clean; ship behind `agent_configs.enabled`.

---

## 9. What this deliberately does NOT do

- **No platform rewrite, no "v4".** One agent, additive.
- **No managed agent platform** (Bedrock Agents / Vertex Agent Engine /
  LangGraph). The existing mesh is batch-shaped; those platforms solve
  multi-turn/tool-use problems it doesn't have. If TrustBot or this hunter later
  outgrow Cloudflare Workflows, the next step is the Claude Agent SDK pattern
  inside the existing stack — re-evaluated on evidence, not ahead of it.
- **No agentifying the other 30 pipelines.** Sentinel/Cartographer/etc. classify
  rows with one call each at ~`$0.001`; a reasoning loop would make them slower
  and ~20× costlier for the same answer. They stay batch processors.

---

## 10. Sequencing

1. Land §3.2 + §3.3 + §5 (loop, tools, model) behind a flag — no UI change.
2. Land §3.1 (Workflow) + rewire the button to async.
3. Land §7 (eval harness); iterate the system prompt against it.
4. Only then consider: auto-run on a schedule, or templating the loop into a
   second agent (Threat Hunter for external-channel sweeps, Feed Scout for
   source probing).
