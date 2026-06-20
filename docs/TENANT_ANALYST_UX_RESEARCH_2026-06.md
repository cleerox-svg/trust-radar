# Tenant Analyst UX — Research, Gap Analysis & Refactor Proposal (2026-06)

> Status: DRAFT in progress. Current-state section is from a live walkthrough of
> prod (`org_id=1`, Acme Corp) via the `auditor`/tenant preview tokens. Competitor
> research, human-in-the-loop patterns, code inventory, deltas, and the refactor
> proposal are appended as the research/inventory agents complete.

## 0. Framing

Averrow's thesis: **mostly autonomous remediation**, with the analyst as a
**supervisor / exception-handler**, not the primary worker. The tenant surface
must therefore do three jobs at once:

1. **Full-auto by default** — the agent mesh discovers, triages, drafts takedowns.
2. **Analyst visibility** — a real analyst can see what they want/need, drill in,
   and trust (or challenge) what the automation did.
3. **Human-in-the-loop when needed** — when an org wants a human to approve, work,
   or override, the UI must let them actually *do the work*.

The question this doc answers: what does a threat analyst expect to see/do in a
brand-protection / DRP platform, what does Averrow's tenant view give them today,
and how should the UI be refactored to serve all three jobs.

---

## 1. Current state — live walkthrough of the tenant view (prod, Acme Corp)

Tenant IA today (left nav): **Workspace** = Overview, Threats, Signals,
Notifications, Takedowns · **Modules** = Domain, Social, App Store, Dark Web,
Abuse Mailbox, Trademark, Threat-Actor · **Account** = Settings.

### 1.1 Overview (`/tenant`)
Executive dashboard. KPI tiles (Active Threats 21,095 · Open Signals 212 ·
Impersonations 40 · Exposure Score 62/100), takedown-authorization status, a
per-brand table (3 brands with threats/social/impersonations/exposure), a 7-day
threat trend, "Recent signals" preview, and the 7 module cards. **Read-only.**
Good situational awareness; no work happens here.

### 1.2 Threats (`/tenant/threats`)
Full threat table (21,095 rows). Columns: BRAND, TYPE, DOMAIN/URL, SEVERITY,
STATUS (Active/Down/Remediated), SOURCE (feed), EVIDENCE (VT/GSB badges), LAST
SEEN. Filters: brand, severity, type, status; free-text search; sortable columns;
pagination 50/page. Rows are expandable for "the evidence behind the verdict."
**Read-only.** No row selection, no bulk action, no "request takedown," no
triage/dismiss, no assignment, no notes, no export. STATUS is system-set; the
analyst cannot change it.

### 1.3 Signals (`/tenant/alerts`) — the closest thing to a triage queue
212 signals, stat tiles (Total/Critical/High/"Resolved-able" 20). Filters:
SEVERITY (All/Critical/High/Medium/Low) and **STATUS (All/New/Acknowledged/
Investigating/Resolved)**. Each signal card: severity, status badge, type, date,
brand, AI title + narrative, and **AI "Recommended Actions"** (expandable). Every
signal is "NEW."
**Critical gap:** the status lifecycle exists in the data model and as filter
chips, but there are **no controls to drive it** — no acknowledge, no
investigate, no resolve, no dismiss, no assign, no "do this recommended action"
button. Recommended actions are advisory prose, not executable. Pagination is
"coming soon" (shows 50 of 212). It looks like a queue but you cannot work it.

### 1.4 Takedowns (`/tenant/takedowns`)
Real lifecycle: stat tiles (Total 7 · In Flight 7 · Taken Down 0 · Failed/Expired
0), STATUS filter (DRAFT/SUBMITTED/PENDING RESPONSE/TAKEN DOWN/FAILED), MODULE
filter. 7 requests, each a link to a detail page (`/tenant/takedowns/:id`). Each
row: severity, status, module, type, identifier, target brand, provider, AI
description + **confidence %**, created date. Subtitle says "auto-submitted under
your signed authorization … response audit trail per request."
**Critical gap:** all 7 are stuck in **DRAFT** and there is **no queue-level
approve / submit / reject** control — the human-in-the-loop gate is implied but
not actionable from the list. (Detail page may have controls — pending inventory.)

### 1.5 Cross-cutting observations (current state)
- The tenant surface is a **sophisticated read-only intelligence dashboard** with
  the *skeleton* of analyst workflows (status lifecycles exist in the data for
  Signals and Takedowns) but almost **no actionability**.
- **Absent today:** triage actions (ack/investigate/resolve/dismiss), case /
  investigation objects, ownership/assignment, analyst notes & collaboration, an
  audit trail of *human* actions, approve/reject gates for automation, bulk
  actions, saved views, SLA/aging, export/reporting, and any "what did the
  automation do and why" transparency panel.
- **Automation transparency is one-directional:** the platform shows AI verdicts,
  narratives, recommended actions, and takedown confidence — but never *why* it
  auto-acted (or didn't), and gives the human no lever to confirm/override.
- Modules (Domain/Social/App-Store/Dark-Web/Abuse-Mailbox/Trademark/Threat-Actor)
  exist as nav items; per the Overview each reads "0 across 3 metrics this month"
  for Acme — depth pending inventory.

<!-- COMPETITOR RESEARCH, HITL PATTERNS, CODE INVENTORY, DELTAS, REFACTOR PROPOSAL APPENDED BELOW -->
