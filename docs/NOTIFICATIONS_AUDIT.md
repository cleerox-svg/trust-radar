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
- §3 Tenant scoping audit
- §4 Click destination audit
- §5 Settings audit
- §6 Industry research
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


