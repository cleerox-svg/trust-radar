# Spam Trap Diagnosis & Recommendations (2026-06)

Investigation prompted by "spam trap seems stagnant." Verified against live
prod D1 (`trust-radar-v2`) + the diagnostics endpoint.

## Verdict: stagnant — confirmed

- **Captures:** 0 in the last 24h; latest **2026-06-21**; total **79 ever**.
  Daily trend decayed **~17/day (mid-May) → 1–5/day (early June) → ~0**.
- **Trap roster frozen:** `seed_addresses` stuck at **398 since 2026-05-24**;
  only **8 of 398** addresses have *ever* caught spam.

## Root cause (FIXED) — a signed-int bug silently zeroed all planting

`lib/auto-seeder-planter.ts`:

```js
const baseSeed = Date.now() & 0xffff_ffff;   // BUG
```

JS bitwise `&` coerces to a **signed** 32-bit int, so `baseSeed` is **negative**
whenever bit 31 is set. `synthName` then did `FIRST_NAMES[(seed*7+3) % len]`;
JS `%` keeps the dividend's sign, so a negative seed → `FIRST_NAMES[-n] ===
undefined` → `localPart` crashed on `.toLowerCase()`. Every target threw
`Cannot read properties of undefined (reading 'toLowerCase')`; the agent logged
`Recon planted 0 …` yet finished **`status='success'`** with
`records_processed=16` (that 16 is the *target count*, not plants — see below).

It's **intermittent on a ~50-day cycle**: `Date.now() mod 2^32` sits above 2^31
for ~25 days each cycle. Planting worked through 2026-05-24, then this window
flipped negative ~2026-06-01 and all planting stopped → harvesters had no fresh
bait → captures fell to zero. It would have "self-healed" mid-cycle and re-broken
forever after.

**Fix:** `Date.now() >>> 0` (unsigned 32-bit) + a non-negative `modIndex()`
guard on every name-pool index (defense in depth). Regression test added
(`test/auto-seeder-planter.test.ts`) covering previously-negative seeds.

**After deploy:** the next weekly run (or a manual
`POST /api/internal/agents/auto_seeder/run`) will resume planting ~96
addresses/week.

## Recommendations (not yet implemented — operator/product calls)

### 1. Monitoring — this failed *silently* for ~5 weeks
The agent reported `success` while planting 0, and the surfaced metric
(`records_processed=16` = `itemsProcessed`, the target count) masked it.
- Health-check `auto_seeder` on **`itemsCreated`**, not `itemsProcessed`: alert
  when it plants 0 on a run that had active targets.
- Add a spam-trap freshness signal: alert when **captures = 0 for > N days** or
  when `MAX(seed_addresses.seeded_at)` ages past a threshold. Either would have
  caught this in days, not weeks.

### 2. Yield is structurally low — exposure, not volume
Even fully working, only **2% of traps ever catch anything**. Bait lives only on
`/admin-portal`, `/internal-staff`, `/team-directory`, `/staff-contacts` across 4
owned domains — a narrow surface harvesters may rarely hit.
- Broaden **harvestable** exposure (where address-scraping bots actually crawl)
  rather than only minting more synthetic addresses on the same internal pages.
- Prune the ~390 dead addresses; study the **8 productive** ones (which
  domains/pages/patterns caught) and double down on those.
- Treat the honeypot as a low-yield, supplementary signal — set expectations
  accordingly relative to the external feeds.

### 3. Metric clarity
`auto_seeder` returns `itemsProcessed: targets.length` — rename/relabel so the
agent dashboard shows **addresses planted**, not pages visited.
