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

- §1 Methodology
- §2 Per-type findings (current state)
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
