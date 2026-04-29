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
- §6 Industry research ✓
- §7 Redesign principles ✓
- §8 Decisions log ✓
- §9 Phase plan (N0–N6) ✓
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

### 6.5 Stripe / GitHub / AWS — digest emails

Three different products converged on the same pattern: realtime
push only for critical, everything else rolled up. Stripe's daily
"Activity for [account]" email summarises the previous day's
charges, refunds, disputes in one digestible block. GitHub's
"Daily digest" rolls up all subscribed-thread activity into one
email per day (configurable to weekly). AWS's "Health Dashboard"
goes further — it generates a per-region weekly digest with AI-
summarised bullet points.

The pattern works because:
- Realtime is reserved for events the user genuinely cannot wait on
  (failed charge, security alert, system outage).
- Bundling reduces the cognitive cost of "what happened today?"
  from 50 emails to 1.
- Digest emails carry the same `link` to the relevant in-app view,
  so users can click through if a roll-up entry needs attention.

**What we adopt:**

- **Digest mode** as a per-user preference: `realtime`, `hourly`,
  `daily`, `weekly`. Default to `realtime` for critical+, `daily`
  for medium+, drop low entirely (per-user opt-in).
- Digest delivery is its own type (`notification_digest`), not a
  rollup of the underlying type rows. The digest email body
  enumerates the items but the items are still separately
  navigable in the in-app inbox.
- AI-summarised digests are deferred to Phase Q5b
  (`notification_narrator` sync agent). The digest layout works
  without AI — bulleted entries with severity, brand, and link.

### 6.6 iOS — notification interruption levels

iOS 15+ introduced `UNNotificationInterruptionLevel` as a 4-tier
spectrum that determines how aggressively a notification can
interrupt the user. The OS treats them differently:

| Level | Bypasses Focus? | Sound | Locked screen | Use for |
|---|---|---|---|---|
| `passive` | no | none | shows in history only | low-importance roll-ups |
| `active` (default) | no | yes (user-configurable) | yes | most notifications |
| `time-sensitive` | partial — bypasses Focus *if user opts in per-app* | yes | yes | events tied to a deadline (delivery, ride, OTP) |
| `critical` | **always**; bypasses Focus + Do Not Disturb | yes (forced) | yes | safety alerts (medical, security, weather emergencies) |

`critical` requires Apple-granted entitlement; not available to most
apps. `time-sensitive` is broadly available and is the right level
for "this matters within the next hour".

**What we adopt:**

- Map our severity to iOS levels in the PWA notification helper:
  - `info` → `passive`
  - `low` → `active`
  - `medium` → `active`
  - `high` → `time-sensitive`
  - `critical` → `time-sensitive` (we cannot reliably get
    `critical` entitlement; users who want bypass can configure
    Focus exemption per-app).
- Honour the user's quiet hours in our preferences as a hard rule
  except when the user has explicitly enabled "critical bypasses
  quiet hours" (Q3 in §8) — match iOS's "Allow Time-Sensitive"
  per-app toggle.

### 6.7 Android — notification channels

Android 8+ requires every notification to belong to a
**notification channel**. The user (not the developer) controls
each channel's sound, vibration, lock-screen visibility, and
importance. Apps cannot bypass the user's channel settings.

The mental model: each channel is a category the user can
configure independently. WhatsApp creates `Messages` (high
importance), `Group Notifications` (medium), `Other` (low). Slack
creates one channel per workspace. Gmail creates one per IMAP
label.

**What we adopt:**

- Define notification channels matching our type registry in the
  PWA service worker:
  - `Brand Threats` (high importance)
  - `Campaign Escalations` (high)
  - `Intelligence Digests` (medium)
  - `Agent Milestones` (low)
  - `Email Security Changes` (low)
  - `Platform Health` (high — super_admin only)
  - `Operational Alerts` (max — feed health, FC alerts; super_admin)
- The user's channel settings on Android override our default
  importance. We declare the **starting importance** per channel
  and respect what the user configures.
- One-time channel creation in the SW install handler. Adding new
  channels later requires a service-worker update.

### 6.8 PWA + native — notification action buttons

Both iOS PWA notifications and Android `Notification.Action` allow
inline action buttons that the user can tap without opening the
app. The W3C Web Push API's `actions` array supports up to 2
buttons on iOS, 3 on Android, each with an `action` ID + label +
icon.

Common patterns:

- "Acknowledge" + "Snooze 1h"
- "Open" + "Dismiss"
- "Approve" + "Reject" (for approval queues — see Phase 5.4)

The action handler runs in the service worker `notificationclick`
event, so it can hit a backend API endpoint without launching the
PWA. This is the difference between "I have to open the app to act
on this" and "I can dismiss it from the lockscreen".

**What we adopt:**

- Every push notification carries 1-2 inline actions:
  - severity ≥ high: `Open` + `Snooze 1h`
  - severity ≤ medium: `Open` + `Done`
  - intel digest: `View digest` + `Snooze 24h`
- The `notificationclick` handler in the SW posts to
  `/api/notifications/:id/action` with the chosen action ID,
  authenticating via the same JWT the PWA uses for fetch calls.
- Action handlers update the `state` column directly (snooze
  sets `snoozed_until`, done sets `done_at`).

### 6.9 Summary — patterns → redesign principles

Maps each adopted pattern to the redesign principle in §7 it drives,
and the phase in §9 where it lands.

| Pattern | Source | Adopted as | Phase |
|---|---|---|---|
| 4-state machine | Linear | `state` column (`unread` / `read` / `snoozed` / `done`) | N2 (schema) + N4 (UI) |
| Reason badges | Linear, GitHub | `reason_text` column on every row | N2 + N4 |
| Inbox-as-primary-nav | Linear | `/v2/notifications/inbox` page | N4 |
| Per-resource subscription | GitHub | `notification_subscriptions` table (per-user × per-brand) | N5 |
| Subscription levels | GitHub | `watching` / `default` / `ignored` enum | N5 |
| Severity-driven routing | PagerDuty | `notification_preferences_v2.{push,email,inapp}_severity_floor` | N2 + N5 |
| Group key | PagerDuty | `group_key` column → entity collapsing in inbox | N2 + N4 |
| Digest mode | Stripe / GitHub | `notification_preferences_v2.digest_mode` enum | N5 |
| iOS interruption levels | Apple HIG | severity → interruption level map in PWA helper | N4 (push) |
| Android notification channels | Android docs | Channel-per-type definition in SW install | N4 (push) |
| Action buttons on push | W3C Web Push | 1-2 actions per push, handler in SW | N4 (push) |
| Per-channel routing | Slack | `notification_preferences_v2` channel × type × severity | N5 |
| Per-thread unsubscribe | GitHub | "Mute this brand" / "Mute this type" inline action | N4 + N5 |
| AI-summarised digest | AWS | `notification_narrator` sync agent (Q5b parked) | post-N6 backlog |
| Keyword routing | Slack | parked | §14 backlog |
| Escalation policies | PagerDuty | parked (needs on-call concept) | §14 backlog |

---

## 7. Redesign principles

Eight principles. Every PR in N1-N6 either implements one of these
or is out of scope. Disagreements debated here, not later.

### 7.1 Notifications are a triage queue, not a feed.

Read state alone gives operators no way to zero out their inbox.
The 4-state machine (`unread → read → snoozed → done`) gives every
row an obvious lifecycle: see it, decide what to do, act or punt.
Done-count is the meaningful metric, not unread-count.

### 7.2 Every notification answers "why am I seeing this?".

A `reason_text` field is mandatory on every row. Examples:

- Tenant: "You monitor Acme."
- Tenant: "Your team subscribes to the finance sector."
- Super_admin: "Platform alert — operational only."
- Super_admin: "Cross-brand pattern affecting 3 of your tenants."

Without the reason, operators routinely ask "did I configure
this?" and the answer is unclear. With it, every notification is
self-explanatory and the user can mute its source if the reason is
not relevant.

### 7.3 Severity drives routing.

Channel routing (in-app / push / email) is a function of severity,
not of type. The defaults:

- `critical` → in-app + push (time-sensitive) + email; bypasses
  quiet hours when the user opts in.
- `high` → in-app + push.
- `medium` → in-app + email digest.
- `low` → in-app + email digest (opt-in).
- `info` → in-app only; rolled into the daily digest if there is one.

Users override per type in §10's `notification_preferences_v2`.

### 7.4 Subscription model, not broadcast.

Every notification has a target audience expressed as
`audience` + `(brand_id | org_id | user_id)`. The LIST endpoint
joins through `notification_subscriptions` to filter what each
user sees. Tenants only see brands they monitor; super_admins
default to operational-only with an opt-in for the firehose.

### 7.5 Group by entity.

3 changes to Acme within 1h = one expandable inbox row, not 3.
The `group_key` column drives this. Default key: `${type}:${brand_id}`.
Operators chose the time-window (1h, 4h, 24h) per type in §10.

### 7.6 AI intel surfaces only with a "so what".

Raw signals never become notifications; signals with explicit
`recommended_action` framing do. Predictive alerts ("Acme likely
targeted this weekend"), cross-brand patterns ("4 finance tenants
hit critical today"), sector trends, and recommended actions are
all candidates. They land as new types in the `intel_*` family
(§11).

### 7.7 Action buttons on every row.

Every notification surface — bell dropdown, inbox page, push
notification — exposes 1-2 action buttons. Default actions per
severity:

- `critical` / `high`: `Open` + `Snooze 1h`
- `medium` / `low` / `info`: `Open` + `Done`

The `Open` action navigates to `link` + marks the row read in one
operation. Snooze sets `snoozed_until`; Done sets `done_at`. The
row's contextual menu (kebab) adds: Mute this brand / Mute this
type / Snooze longer / Move to digest.

### 7.8 Digest mode for low-severity, realtime for critical.

The default user gets `realtime` for critical+, `daily` digest for
medium+, drops `low` and `info` (opt-in). Power users override per
channel in §10. The digest is a single notification of type
`notification_digest` with bullet entries linking to each
underlying row in the inbox — clicking a digest entry deep-links to
the inbox-filtered view, not just to the source entity.

---

## 8. Decisions log

The operator's answers to the Q1-Q9 sign-off questions, with
rationale and the phase each answer drives.

### Q1. State model — `unread → read → snoozed → done` (4 states). ✅ approved

**Rationale:** matches Linear's triage workflow. Snooze and done as
first-class states are the only way operators can confidently zero
out the inbox; binary read/unread leaves notifications stuck in
"I read it but haven't acted on it" limbo.

**Drives:** N2 schema (`state` column, `snoozed_until`, `done_at`).
N4 UI (4-action button row, snooze picker, done check).

### Q2. Subscription default — Critical+High only by default; configurable. ✅ approved

**Rationale:** new users get a curated stream, not a firehose. They
can opt up to medium/low per brand or globally. Combines
GitHub's "Watching" granularity with PagerDuty's severity-driven
defaults.

**Drives:** N5 default seed for `notification_subscriptions` rows
(level=`default`, severity_floor=`high`). N5 settings UI for
adjustment. N3 backend routing reads the floor.

### Q3. Super_admin firehose — `audience='super_admin'` + `audience='all'` by default with a "show tenant notifications too" opt-in toggle. ✅ approved

**Rationale:** super_admins drown in tenant signal today. Default
should be operational-only (platform health, cross-brand patterns,
critical platform alerts). The opt-in toggle preserves debugging
access without making it the default cognitive load.

**Drives:** N3 LIST endpoint reads
`notification_preferences_v2.show_tenant_notifications`. N5
settings UI exposes the toggle.

### Q4. Email security boundary — boundary-crossing only (D/F→A/B or A/B→D/F). ✅ approved with note: "ready to pivot to per-brand configurable later"

**Rationale:** the screenshot showed "improved" notifications
firing for trivial F→D moves. The boundary policy ensures only
operationally meaningful transitions notify. The "ready to pivot"
note marks per-brand configurability as a Phase N5 follow-up.

**Drives:** N1 cartographer.ts:626 logic change (boundary
detection + dedup metadata + 24h cap). N5 settings — per-brand
"which transitions matter" override (parked under §14 backlog
until N5 lands).

### Q5. AI intel source — static templates for v1; `notification_narrator` sync agent as planned follow-up. ✅ approved

**Rationale:** static templates are predictable, cheap, easy to
tune. AI-generated copy carries hallucination risk on the surface
that operators trust most. The narrator agent is the right tool
for the weekly digest where copy variance is appropriate.

**Drives:** N6 implements static templates per type with variable
slots (what / why_it_matters / recommended_action). Backlog item
**Q5b** scheduled post-N6: build `notification_narrator` sync
agent for the weekly digest.

### Q6. Snooze granularity — per-notification + per-type + per-brand. ✅ approved

**Rationale:** "snooze all Acme notifications for 24h" is the
real-world need during a planned outage or scheduled maintenance
window. Per-type snooze handles "I know about this category, stop
telling me." Per-row is the default action button.

**Drives:** N4 UI (snooze picker on every row + on the kebab menu
+ in the per-brand subscription page). N5 schema —
`notification_subscriptions` already has the structure; just need
`snoozed_until` on subscription rows alongside notification rows.

### Q7. Mobile / push — use existing PWA push (VAPID); add iOS/Android channels. ✅ approved

**Rationale:** the PWA already has VAPID + push wired (see
`packages/trust-radar/src/lib/push.ts`). Channel definitions in
the SW give users OS-native control without us writing native
apps. iOS interruption levels via the W3C
`UNNotificationInterruptionLevel` mapping in §6.6.

**Drives:** N4 (push) — SW channel install, severity-to-level
map, action buttons in `notificationclick`. N5 settings — per-
channel toggles read OS state where possible (Android exposes
channel state via the Notification API).

### Q8. Email channel — realtime for critical+high, daily digest for medium+low; configurable per user. ✅ approved as default

**Rationale:** email is the channel users least want flooded.
Critical+high realtime preserves urgency; everything else rolled
up into a per-day summary that's actionable in one read.

**Drives:** N5
`notification_preferences_v2.email_severity_floor` (default
`high`) and `digest_mode` (default `daily`). N6 implements the
digest renderer.

### Q9. Document first — yes, write `docs/NOTIFICATIONS_AUDIT.md` first. ✅ approved (this document)

**Rationale:** matches `AGENT_AUDIT.md` pattern. Sign-off
artifact reduces churn over the multi-PR sequence. Mid-flight
disagreements are debated against the doc, not against
half-shipped code.

**Drives:** N0 sequence — this doc, built up across small commits
(restart from earlier API-error session because the assembled
single-shot writeup kept timing out).

### Operator-added scope (Q10, post-Q9 input)

> "Also I would consider the Dashboard in Admin as a notification
> component as it emails out a briefing. The email briefing
> hasn't been happening but some of what's in that dashboard
> report might be notification worthy. Like hitting D1 issues,
> Worker issues that can't be fixed by FC, things like that."

**Rationale:** the admin Dashboard surfaces operational signals
that today only reach the operator if they manually visit the
page. Many are notification-worthy (D1 budget approaching skip
threshold, feeds entering at-risk, agents stalled, FC failing to
recover, briefing cron not firing). The broken email briefing is
itself a candidate for a self-monitoring notification ("we
haven't sent a briefing in 36 hours").

**Drives:** New §13 platform-health signals. N6 includes the
email-briefing investigation as a fix, plus the platform-health
notification family.

---

## 9. Phase plan (N0–N6)

Each phase is a coherent unit of work; PRs within a phase chunk
small enough to ship independently. Phase scope can shift — phases
do not.

### N0 — Audit doc (this document)

**Goal:** capture findings, research, principles, decisions, and
implementation plan in one signed-off artifact.

**PRs:** N0a (skeleton + TL;DR) ✓ → N0b (methodology + per-type) ✓
→ N0c (tenant scoping + click + settings) ✓ → N0d-1
(Linear/GitHub/Slack/PagerDuty research) ✓ → N0d-2
(Stripe/iOS/Android/summary) ✓ → N0e (principles + decisions) ✓
→ **N0f (this) (phase plan + schema)** → N0g (AI intel + email
briefing + platform-health) → N0h (backlog + compliance +
changelog).

**Exit criteria:** all 16 sections drafted; operator signs off on
the schema + phase plan before N1 begins.

### N1 — Stop the spam (1 PR)

**Goal:** fix the immediate operator complaint (the screenshot
"Voximplant ×3, MI314 ×3, Pitt ×3"). Quick win that doesn't
require schema changes.

**Deliverables:**
- `cartographer.ts:626` — pass `metadata: { brand_id }` so dedup
  fires; tighten the boundary policy (only D/F→A/B improvements
  and A/B→D/F degradations); cap at 1/brand/24h on top of dedup.
- Add `link: '/brands/${brand.id}'` to email_security_change and
  DMARC notifications.
- Wire click handler in `NotificationBell.tsx` and
  `Notifications.tsx` to `navigate(notification.link)` then
  `markRead`. Skip navigation when `link` is null (graceful).

**Exit criteria:** operator visits live UI; clicks an
email_security_change notification; lands on the brand page.
The same brand doesn't fire the same notification twice within
24h.

### N2 — Schema migration (1 PR)

**Goal:** add the schema fields that every other phase depends on.
Backfill existing rows so the rollout is non-breaking.

**Deliverables:**
- Migration `0127_notifications_v2.sql`: adds `brand_id`,
  `org_id`, `audience`, `state`, `snoozed_until`, `done_at`,
  `reason_text`, `recommended_action`, `group_key` columns to
  `notifications`. Adds `notification_subscriptions` table.
  Adds `notification_preferences_v2` columns or new table (TBD
  in §10). Adds indexes for the new query patterns.
- Backfill: existing rows get `brand_id` populated from
  `metadata.brand_id` JSON when present; `state='read'` for
  rows with `read_at`, `state='unread'` otherwise; `audience`
  defaulted by inspecting `user_id` join to roles.

**Exit criteria:** migration applies cleanly to production; all
existing rows have non-null `state`; LIST endpoint still returns
the same notifications it did before (no regression).

### N3 — Backend routing rewrite (1-2 PRs)

**Goal:** every notification creation routes correctly per its
`audience` + dedup + per-user subscription join. Replaces the
broadcast-to-all-active-users fan-out.

**Deliverables:**
- N3a: `lib/notifications.ts` rewritten. Each type declares
  audience policy + dedup rule + recommended-action template +
  default link generator (registry pattern, like the agent
  registry). `createNotification()` reads the registry and
  routes accordingly. Backward-compatible signature so call
  sites don't all change at once.
- N3b: LIST endpoint joins through `notification_subscriptions`
  for tenant scoping; super_admins respect the
  `show_tenant_notifications` toggle. State-aware filters
  (`?state=unread,snoozed`).
- All 18 existing call sites migrated to pass `metadata` and
  `audience`. Inline TODOs for templates that still need work.

**Exit criteria:** tenant user A sees only brands they monitor;
tenant user B sees only theirs; super_admin sees operational
+ opt-in firehose. No regressions on the 7 currently-working
types.

### N4 — Triage inbox UI redesign (2-3 PRs)

**Goal:** rebuild the notification surfaces around the 4-state
machine, action buttons, and entity grouping.

**Deliverables:**
- N4a: `useNotifications` hook rewrite. Fetch state-grouped
  rows (`unread`, `snoozed`, `done` separated). Mutation hooks
  for each state transition.
- N4b: `<NotificationBell>` rebuild. Inbox-icon style. Action
  buttons on hover. Click navigates `link` + marks read.
  Group-by-entity collapsing.
- N4c: new `/v2/notifications/inbox` page. Linear-style
  primary nav item. Bulk operations. Filter by state, severity,
  type, brand. Empty state for "Inbox zero".
- N4d (push): SW notification channels (iOS/Android), severity
  → interruption level map, action buttons in
  `notificationclick`, `/api/notifications/:id/action` handler.

**Exit criteria:** operator can zero out the inbox; clicking a
notification lands on a useful page; snooze sends a row away
for N hours and brings it back; done is sticky; push
notifications carry inline actions.

### N5 — Subscriptions + preferences (2 PRs)

**Goal:** give users meaningful control. Per-brand watch /
default / ignore. Severity floors. Digest mode.

**Deliverables:**
- N5a: `notification_subscriptions` populated on tenant-brand
  monitoring (auto-create `default` row when a brand is
  monitored). "Watch" button on the brand detail page upgrades
  to `watching`. "Mute" demotes to `ignored`.
  `notification_preferences_v2` populated with sensible
  defaults from §7 / §8.
- N5b: `NotificationPreferences.tsx` rebuilt. Per-channel
  routing matrix (in-app / push / email × type × severity
  floor). Digest mode selector (realtime / hourly / daily /
  weekly). Quiet hours stays. New section: per-brand watch list
  with subscription level controls. Super_admin toggle: "show
  tenant notifications too" (Q3).

**Exit criteria:** a tenant operator can flip a brand to
`watching` and start getting medium+low for it without
touching anything else. A super_admin can flip
`show_tenant_notifications` and start seeing all rows.

### N6 — AI intel + platform-health + email briefing (2-3 PRs)

**Goal:** the new value layer. AI intel surfaces as
notifications; platform-health signals reach the operator;
email briefing fixed + self-monitored.

**Deliverables:**
- N6a (AI intel): new `intel_*` types — `intel_predictive`,
  `intel_cross_brand_pattern`, `intel_sector_trend`,
  `intel_recommended_action`, `intel_threat_actor_surface`.
  Static template per type with variable slots
  (`what` / `why_it_matters` / `recommended_action`). Sources:
  Narrator (briefing), Strategist (campaigns), NEXUS (clusters),
  Curator (hygiene). Each agent emits via the new
  `createNotification()` registry path.
- N6b (platform-health): new `platform_*` types — see §13 for
  the full list (D1 budget warn/skip, feed at-risk, feed
  auto-paused, agent stalled, agent circuit breaker, cron
  orchestrator missed, etc.). All `audience='super_admin'`.
- N6c (email briefing): root-cause fix per §12 investigation.
  Add a self-monitoring `platform_briefing_silent` notification
  that fires if a cron briefing hasn't sent in 36h.

**Exit criteria:** super_admin sees a `platform_d1_budget_warn`
notification when D1 reads cross 85% of daily budget. Tenant
sees an `intel_predictive` notification when NEXUS clusters a
new likely-targeted campaign for one of their brands. The
13:00 UTC briefing email arrives daily.

### Total scope

7 phases, ~12-15 PRs, ~3-4 sessions of work assuming the
chunking pattern from this document continues.


