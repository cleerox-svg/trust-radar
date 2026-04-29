# Notifications Audit & Redesign — Phase N0

**Status:** draft
**Date:** 2026-04-29
**Standard:** none yet — this audit produces the first one.
**Pattern:** mirrors [`AGENT_AUDIT.md`](./AGENT_AUDIT.md).

The first concrete read of the platform's notifications system against
the operator's lived complaints. For each issue: where in the code,
what's broken, what to do about it. For each redesign principle:
which industry pattern it derives from + what we're adopting.

This document is the sign-off artifact. Phases N1-N6 act on the
verdicts here.

## Headline findings

1. **`email_security_change` has no dedup** — `cartographer.ts:626` calls `createNotification` without `metadata`, so the dedup gate's `getRateKey()` returns `null` and skips. Every cartographer tick that re-evaluates a brand can fire a fresh row. This is the "Voximplant ×3, MI314 ×3, Pitt ×3" the operator screenshotted.
2. **No tenant scoping anywhere** — the `notifications` table has no `brand_id` / `org_id` columns. The LIST endpoint filters by `user_id` only. When `createNotification()` is called without an explicit `userId`, it broadcasts to every active user across every tenant via `SELECT id FROM users WHERE status = 'active'` (`lib/notifications.ts:98`). 5 of the 8 declared types fan out this way today.
3. **Click is a dead end** — `NotificationBell.tsx:54-90` and `Notifications.tsx:319-370` fetch the `link` field but never use it. Click only fires `markRead`. The `link` is plumbed through the API and ignored at the leaf.
4. **Settings are shallow** — `NotificationPreferences.tsx` has 5 type toggles + push toggle + quiet hours. No per-brand mute, no severity floor, no digest mode, no per-channel routing.
5. **State model is binary `read / unread`** — no snooze, no done, no triage workflow. Operators end up with a 1229-alert badge they can never zero out.
6. **AI intel doesn't reach notifications** — Narrator, Observer, Strategist, NEXUS all produce useful intel that sits in `agent_outputs` and never reaches the bell. No predictive alerts, no cross-brand patterns, no recommended-action framing.
7. **Platform health signals don't reach notifications either** — D1 budget approaching the 95% skip threshold, feeds entering at-risk, agents stalled, FC failing to recover, briefing cron not firing — operators discover these only by running diagnostics manually.
8. **Email briefing has been silently broken** — the daily 13:00 UTC cron-driven briefing email hasn't been delivering. Most likely cause: `RESEND_API_KEY` rotation, or a stuck `emailed=1` row dedup-skipping subsequent days. Current code logs the failure as a warning and the cron tick still reports success — silent.

---

## Sections (TBD as commits land)

- §1 Methodology ✓
- §2 Per-type findings (current state) ✓
- §3 Tenant scoping audit ✓
- §4 Click destination audit ✓
- §5 Settings audit ✓
- §6 Industry research (part 1: inbox / subscription / escalation patterns) ✓
- §7 Redesign principles
- §8 Decisions log
- §9 Phase plan (N0–N6)
- §10 Schema changes
- §11 AI intel notification opportunities
- §12 Email briefing investigation
- §13 Platform-health signals worth notifying
- §14 Backlog (post-N6)
- §15 Compliance against AGENT_STANDARD §17 / §12
- §16 Changelog

This file grows section-by-section over the next few commits. Once
all sections land, Phase N1 ships.

---

## 1. Methodology

Read every `createNotification()` call site in the worker, the LIST
endpoint that powers the bell, the React components that render
notifications, and the migration that defines the schema. Cross-
referenced against the operator's screenshot showing 1229 alerts +
377 unread + 99+ on the bell, with the same brand's "email security
improved" appearing 3× in a row.

Sources walked:

- `packages/trust-radar/src/lib/notifications.ts` (creation + dedup)
- `packages/trust-radar/src/handlers/notifications.ts` (LIST / read endpoints)
- `packages/trust-radar/migrations/0018_notifications.sql` (schema)
- `packages/trust-radar/migrations/0107_notifications_schema_check.sql` (type CHECK constraint)
- `packages/shared/src/notification-events.ts` (declared type registry; deleted in earlier rebase, now in averrow-ui)
- `packages/averrow-ui/src/lib/notification-events.ts` (current registry)
- `packages/averrow-ui/src/components/NotificationBell.tsx` (bell + dropdown)
- `packages/averrow-ui/src/features/settings/Notifications.tsx` (all-notifications page)
- `packages/averrow-ui/src/features/settings/NotificationPreferences.tsx` (settings)
- `packages/averrow-ui/src/hooks/useNotifications.ts` (TanStack hooks)
- All call sites of `createNotification()` across the worker — 18 in total.

Industry research (§6) draws on Linear, GitHub, Slack, PagerDuty,
Stripe, plus Apple HIG and Android Notification Channels. Sources
cited inline.

The audit is read-only. Phases N1–N6 act on the verdicts.

---

## 2. Per-type findings (current state)

Eight notification types are declared in the type CHECK constraint
(migration 0107) + the registry. Status column reflects whether the
type works as intended end-to-end, including dedup and tenant scope:

| Type | Where created (file:line) | Dedup window + key | Status |
|---|---|---|---|
| `brand_threat` | `feeds/certstream.ts:185`, `dmarc-receiver.ts:509` | 1h + `brand_id` | ⚠ partial — dedup works; broadcast (no `userId`) sends to every active user across every tenant |
| `campaign_escalation` | `agents/strategist.ts:152, 216` | 6h + `campaign_id` | ⚠ partial — dedup works; broadcast |
| `feed_health` | `lib/feedRunner.ts:234, 382` | 1h + `feed_name` | ✅ works — system-wide visibility is intentional |
| `intelligence_digest` | `agents/observer.ts:821` | 24h + **NONE** | ⚠ partial — no `metadata` key; dedup falls back to type-only (silent no-op) + broadcast |
| `agent_milestone` | `agents/strategist.ts:216` | 1h + `campaign_id` | ⚠ partial — dedup works; broadcast |
| `email_security_change` | `agents/cartographer.ts:626` | 6h declared + **NONE** passed | ❌ broken — no `metadata` argument means the dedup gate's `getRateKey()` returns `null` and no rate row is inserted; every cartographer tick can re-fire |
| `circuit_breaker_tripped` | `agents/flightControl.ts:1229`, `lib/agentRunner.ts:586` | 1h + `agent_id` | ⚠ partial — dedup works; broadcast |
| `feed_auto_paused` (declared in registry, never INSERTed) | — | — | ❌ broken — declared as a system event but no `createNotification()` call site fires it; also fails the type CHECK constraint as written |

### Specific defects

**1. `cartographer.ts:626` — the broken `email_security_change` call**

```typescript
await createNotification(env, {
  type: 'email_security_change',
  title: `${brandName?.name ?? brand.domain} email security ${dropped ? 'degraded' : 'improved'}`,
  message: `Grade changed from ${brand.existing_grade} to ${result.grade}`,
  severity: dropped ? 'high' : 'info',
});
```

No `userId` (broadcasts) + no `metadata` (dedup gate skipped) + no
`link` (dead-end click). Also no policy on what counts as a
notification-worthy grade change — F→D and F→A both fire identical
spam-density rows.

**2. `dmarc-receiver.ts:509` — half-fixed**

```typescript
await createNotification(env, {
  type: "brand_threat",
  severity: failRate > 0.5 ? "critical" : "high",
  title: `DMARC failures detected for ${report.domain}`,
  message: `${failPct}% of ${emailCount.toLocaleString()} emails failed DMARC — reported by ${report.reporter_org}`,
  metadata: { brand_id: String(brandId), domain: report.domain },
});
```

Has `metadata.brand_id` (so dedup works) but no `userId` (broadcasts
to every active user) + no `link` (dead-end click).

**3. Broadcast call sites — all 5 types that fan out to every tenant**

- `agents/cartographer.ts:626` — `email_security_change`
- `agents/observer.ts:821` — `intelligence_digest`
- `agents/strategist.ts:152, 216` — `campaign_escalation` / `agent_milestone`
- `agents/flightControl.ts:1229` — `circuit_breaker_tripped`
- `lib/agentRunner.ts:586` — `circuit_breaker_tripped`
- `dmarc-receiver.ts:509` — `brand_threat`

**4. `feeds/certstream.ts:185` — the only one with `userId` + `link`**

```typescript
await createNotification(ctx.env, {
  type: 'brand_threat',
  severity: 'high',
  title,
  message,
  link: `/brands/${brandId}`,
  metadata: { brand_id: brandId, count: info.count },
});
```

Reference shape: tenant-scoped (per-brand notification routed by
brand_id → monitored_brands → user lookup) + carries a useful link.
This is the shape every type should converge on.

---

## 3. Tenant scoping audit

### 3.1 LIST endpoint SQL (`handlers/notifications.ts:68-94`)

```sql
SELECT id, type, severity, title, message, link, read_at, created_at, metadata
  FROM notifications
  WHERE user_id = ?
    [AND read_at IS NULL]
    [AND type = ?]
    [AND severity = ?]
    [AND (LOWER(title) LIKE ? OR LOWER(message) LIKE ?)]
    [AND created_at < ?]
  ORDER BY created_at DESC
  LIMIT ?
```

The query is correct **for what's there** — but the schema gives
nothing else to scope by. No `brand_id`. No `org_id`. No
`audience` field. Tenant scoping is entirely a function of which
`user_id` rows the broadcast loop wrote.

### 3.2 The broadcast fan-out (`lib/notifications.ts:93-101`)

```typescript
let userIds: string[];
if (opts.userId) {
  userIds = [opts.userId];
} else {
  const users = await db.prepare(
    "SELECT id FROM users WHERE status = 'active'"
  ).all<{ id: string }>();
  userIds = users.results.map(u => u.id);
}
// ... loop INSERTs one row per userId
```

When called without `userId`, this writes one row per active user
in the entire platform. With ~N tenants × ~M users per tenant ×
~K active brands per tenant, every cartographer email-grade tick
writes N×M rows — even though only the brand's owners care.

### 3.3 The schema (`migrations/0018_notifications.sql`, replaced by `0107`)

```sql
CREATE TABLE notifications (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ( ... )),
  severity     TEXT NOT NULL DEFAULT 'info',
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  link         TEXT,
  read_at      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  metadata     TEXT
);
```

Missing for tenant scoping:
- `brand_id` (queryable; today brand_id is buried in `metadata` JSON)
- `org_id` (zero presence in the schema)
- `audience` enum (`tenant` / `super_admin` / `all` / `team`) so the LIST endpoint can route correctly
- `state` enum (`unread` / `read` / `snoozed` / `done`) — see §4 + §7
- `reason_text` ("you monitor Acme") + `recommended_action` ("rotate DKIM")
- `group_key` for entity collapsing (one expandable row instead of three)

§10 lists every column the redesigned schema will carry.

### 3.4 Super_admin behaviour today

Super_admins are not special-cased anywhere in the LIST endpoint.
A super_admin sees only the rows tagged with their own `user_id`.
Operationally significant signals (cron skipping pre-warms, feeds
auto-pausing, agent circuit breakers tripping) reach the bell only
because the call site happens to broadcast to all active users —
super_admins are caught in the broadcast incidentally, not because
the design routes operational notifications to them.

That coincidence breaks under tenant scoping (§3.2 fix removes the
broadcast). Without explicit super_admin routing, the operational
alerts stop reaching the operator. This is what §13 (platform-
health signals) addresses.

---

## 4. Click destination audit

### 4.1 The `link` field exists end-to-end

- Schema: `migrations/0018_notifications.sql:14` declares `link TEXT`
- `lib/notifications.ts` accepts it on the create call
- `handlers/notifications.ts:71` returns it on every LIST row
- `hooks/useNotifications.ts` plumbs it through TanStack Query
- React components destructure it in their `Notification` type

…and then **never use it**. Click is a dead end at the leaf.

### 4.2 `NotificationBell.tsx:54-90`

```tsx
<button
  onClick={() => onRead(notification.id)}
  // ...
>
  {/* renders title, message, type, severity, created_at —
      never touches notification.link */}
</button>
```

Single click handler: `markRead`. No navigation. No expanded view.
No context menu. The user dismisses by reading; if they want to act
on a notification they have to navigate to the relevant page
themselves and find the right entity.

### 4.3 `Notifications.tsx:319-370` (All Notifications page)

Same anti-pattern — the row is a `<button>` whose onClick fires
`markRead`. No link navigation, no expand, no action menu.

### 4.4 Population of `link` per type

| Type | `link` populated? |
|---|---|
| `brand_threat` (certstream) | ✅ `/brands/${brandId}` |
| `brand_threat` (dmarc) | ❌ null |
| `campaign_escalation` | ✅ `/campaigns/${campaignId}` |
| `feed_health` | ✅ `/admin/feeds` |
| `intelligence_digest` | ❌ null |
| `agent_milestone` | ✅ `/agents` |
| `email_security_change` | ❌ null |
| `circuit_breaker_tripped` | ✅ `/admin/agents` (FC) / `/admin/budget` (sub-call) |

Even where `link` is populated correctly, the UI ignores it. Even
where the UI ignored a valid link, half of the types don't bother
to populate it. Both ends are broken.

### 4.5 What "click" should do (research-derived; see §6)

1. Click → navigate to `link`. Mark read in the same operation.
2. If notification has an explicit `recommended_action` (§7), the
   action button label changes from "Open" to e.g. "Rotate DKIM".
3. Right-click / kebab menu offers: Snooze (1h / 24h / 7d), Mark
   done, Mute this type, Mute this brand.
4. Bulk-select for batch dismiss / batch mark done.

---

## 5. Settings audit

### 5.1 `NotificationPreferences.tsx` — current toggles

| Preference | Granularity | Default |
|---|---|---|
| Brand Threats | global per user | on |
| Campaign Escalations | global per user | on |
| Feed Health Alerts | global per user | on |
| Intelligence Digests | global per user | on |
| Agent Milestones | global per user | on |
| Push notifications | binary on/off + device list | off (until prompted) |
| Quiet hours start | wall clock | 22:00 |
| Quiet hours end | wall clock | 07:00 |
| Quiet hours timezone | IANA tz | user's browser tz |
| Critical bypasses quiet hours | binary | on |

That's 5 type toggles + 1 push toggle + 4 quiet-hours fields.
Total dimensions: 7 of the 8 declared types are togglable
(`circuit_breaker_tripped` isn't; it's a system event), and that's
the only axis exposed to the user.

### 5.2 What's missing

- **Per-brand** mute / watch / ignore (the GitHub model — pick
  which brands you care about; default behaviour for brands you
  don't watch falls back to a severity floor).
- **Per-severity floor** ("only notify me ≥ high" or "only
  notify me ≥ critical for brands I don't actively watch").
- **Digest mode** (realtime / hourly / daily / weekly). Most non-
  critical types are perfect candidates for daily summary instead
  of per-event firehose.
- **Per-channel routing** (in-app / push / email / SMS). Today
  it's "push on/off"; granular routing per type per severity is
  table stakes for an alerting system.
- **Snooze defaults** ("when I snooze, default 24h not 1h").
- **Super_admin firehose toggle** (Q3 in the operator's
  decisions log) — a super_admin should see operational
  notifications by default and choose to opt into tenant traffic.
- **Notification rules / filters** (Slack/Linear pattern):
  user-defined "if type=X and severity≥Y and brand=Z, route to
  channel C with priority P". Power-user feature for ops teams.

### 5.3 Schema gap

The current `notification_preferences` table (defined in the same
0018 migration block; see `handlers/notifications.ts:184-282` for
the read/write paths) is one row per user with a flat set of
columns matching the toggles above. It cannot express any of the
missing dimensions in §5.2 without schema changes — not just per-
brand, but per-channel and digest mode.

§10 introduces `notification_subscriptions` (one row per
user × brand) and a richer `notification_preferences_v2` (digest
mode, channel routing, severity floors).

---

## 6. Industry research

What "excellent" looks like, with specific patterns and the concrete
adoption call. Sources cited inline.

### 6.1 Linear — inbox + state machine

Linear treats notifications as a triage queue, not a feed. The
inbox view sits as a primary navigation item next to "My Issues"
and is the surface engineers visit first thing in the morning.

Pattern: every notification has an explicit state — `unread`,
`read`, `snoozed`, `done`. `done` is **not** the same as `read`.
You read a notification to clear the badge; you mark it `done` to
say "I've acted on this". Snoozed notifications disappear until a
chosen time, then reappear in `unread`. Linear also offers **mute**
at the source level (the issue, the project) so you stop receiving
events without losing the existing pile.

Each row carries a **reason badge** ("you were assigned", "you
subscribed to this issue", "you're a project member") so you never
ask "why am I seeing this?".

**What we adopt:**

- 4-state machine on the row (`unread → read → snoozed → done`).
  The operator picked Q1=a; this matches.
- Required `reason_text` field on every notification row.
- Bulk operations on the inbox (mark-all-done, bulk-snooze).
- Inbox is a primary nav item, not a hidden bell — see §9 (Phase
  N4).

### 6.2 GitHub — Watching / Participating / Ignored

GitHub's per-repo subscription model is the standard for "scope
your firehose to what you care about":

- **Watching**: you receive every event in this repo.
- **Participating**: you receive events for issues / PRs you're
  actively involved in (commented, mentioned, assigned, authored).
- **Ignored**: you receive nothing, including @-mentions.
- **Custom**: subscribe only to specific event types (releases,
  security alerts, etc.).

Each notification carries a **reason badge** like Linear's:
`Mention`, `Author`, `Review request`, `Assigned`, `Subscribed`,
`Manual`, `Security alert`. The reason makes it possible to filter
the inbox ("show only mentions").

GitHub also offers per-thread unsubscribe — the notification itself
has an "Unsubscribe from this thread" link in the footer, so you can
cull noise without leaving the email / inbox view.

**What we adopt:**

- Per-brand subscription with three levels (`watching` / `default`
  / `ignored`). The operator picked Q2=b ("Critical+High by
  default") which we map to: brands the user monitors → `default`
  level (sees critical+high) until they change it; brands they
  don't monitor → no subscription row → no notifications at all.
- "Watching" gets all severities for that brand.
- "Ignored" mutes everything for that brand including critical
  (with a sticky warning banner so the user knows what they've
  silenced).
- Per-thread unsubscribe — every notification row gets a "mute
  this brand" / "mute this type" affordance.
- Reason badges (`Brand Threat`, `Campaign`, `Health`, `Intel`,
  `Action Required`).

### 6.3 Slack — per-channel granularity + keyword routing

Slack's notification model is the most granular in widespread use.
Three independent dimensions:

1. **Per-channel notification level**: `All new messages`,
   `Mentions only`, `Nothing`, `Default` (inherits workspace).
2. **Keyword highlighting**: arbitrary user-defined strings that
   trigger a notification regardless of channel level.
3. **Workspace-level overrides**: mobile vs desktop independently;
   "Notify me on mobile only when I'm not active on desktop".

The killer feature is **keyword routing** — power users define
"page me on PROD-OUTAGE" or "alert on $brand-name" and the same
substrate covers both casual chat and operational on-call.

**What we adopt:**

- Per-type granularity (we already have this; just need to
  preserve it).
- **Keyword routing for power users** — schedule for §14
  backlog rather than v1, but call it out so the schema doesn't
  paint us into a corner.
- **Channel routing** — every preference row should specify which
  delivery channels (in-app / push / email / SMS) get which types
  at which severity floors. Not all users want everything in their
  inbox AND on their phone AND in email.

### 6.4 PagerDuty / Opsgenie — operational alerts

The operational alerting world (PagerDuty, Opsgenie, VictorOps)
established the standard pattern for "this matters NOW vs this can
wait":

- **Severity tiers** drive routing: P1 (critical) → page on-call
  via SMS + phone call + push. P2 (high) → push + email. P3-P5 →
  email or in-app only.
- **State machine**: `triggered` → `acknowledged` → `resolved`.
  Acknowledgement is **mandatory** for high-severity. If not
  ACKed within N minutes the system **escalates** to the next
  on-call.
- **Alert grouping**: the same monitor firing 50 times in 5 minutes
  becomes ONE incident with 50 events attached, not 50 incidents.
  Without grouping, paging behaviour breaks under load.
- **Maintenance windows**: planned downtime suppresses alerts for
  named services + named time ranges so deploys don't wake people.
- **Escalation policies**: "if the primary on-call doesn't ACK in 5
  minutes, page the secondary; in 15 minutes, page the manager".

**What we adopt:**

- Severity-driven channel routing (§5.2 / §10's
  `notification_preferences_v2`). Critical bypasses quiet hours
  and goes everywhere; medium goes in-app + digest only.
- **Group key** field on every notification row so 3 changes to
  Acme within 1h collapse into one expandable inbox entry.
- Escalation policies are a power-user feature — out of scope for
  v1, parked in §14. The schema's `audience` field + group_key
  mechanics don't preclude adding them later.
- **No mandatory ACK in v1**: we'd need an on-call concept first.
  But the `done` state in our 4-state machine maps cleanly to
  "operationally acknowledged" once we add ops semantics.


