import { describe, it, expect } from "vitest";
import {
  applyEscalation,
  runPageAnalysisForDomain,
  type PageAnalysisRow,
} from "../src/scanners/lookalike-page-analysis";
import type { PagePhishingResult } from "../src/lib/page-phishing-scorer";
import type { Env } from "../src/types";

// ─── Minimal in-memory D1 mock ────────────────────────────────────
// Interprets exactly the UPDATE shapes issued by lookalike-page-analysis
// so we can assert real write behavior (not just captured SQL strings).

const SEVERITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const OPEN_STATUSES = new Set(["new", "acknowledged", "investigating"]);
const NOW_MARKER = "MOCK_NOW";

interface LookalikeRow {
  id: string;
  page_fetched_at: string | null;
  page_http_status: number | null;
  page_phishing_score: number | null;
  page_signals: string | null;
  page_content_hash: string | null;
  threat_level: string | null;
}
interface AlertRow {
  id: string;
  severity: string;
  status: string;
}

function makeMockEnv(lookalikes: LookalikeRow[], alerts: AlertRow[]): {
  env: Env;
  lookalikes: Map<string, LookalikeRow>;
  alerts: Map<string, AlertRow>;
} {
  const lMap = new Map(lookalikes.map((r) => [r.id, r]));
  const aMap = new Map(alerts.map((r) => [r.id, r]));

  const DB = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.includes("UPDATE alerts")) {
                // args: [severityLower, alertId, boundRank]
                const [sev, id, boundRank] = args as [string, string, number];
                const row = aMap.get(id);
                if (row && OPEN_STATUSES.has(row.status)) {
                  const cur = SEVERITY_RANK[row.severity] ?? 0;
                  if (cur < boundRank) row.severity = sev;
                }
              } else if (sql.includes("SET threat_level = ?")) {
                const [level, id] = args as [string, string];
                const row = lMap.get(id);
                if (row) row.threat_level = level;
              } else if (sql.includes("page_phishing_score = ?")) {
                // Full-verdict (success) update.
                const [status, score, signals, hash, id] = args as
                  [number | null, number, string, string | null, string];
                const row = lMap.get(id);
                if (row) {
                  row.page_fetched_at = NOW_MARKER;
                  row.page_http_status = status;
                  row.page_phishing_score = score;
                  row.page_signals = signals;
                  row.page_content_hash = hash;
                }
              } else if (sql.includes("lookalike_domains") && sql.includes("page_http_status = ?")) {
                // Failure update — cooldown + status only, verdict preserved.
                const [status, id] = args as [number | null, string];
                const row = lMap.get(id);
                if (row) {
                  row.page_fetched_at = NOW_MARKER;
                  row.page_http_status = status;
                }
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };

  return { env: { DB } as unknown as Env, lookalikes: lMap, alerts: aMap };
}

// ─── Finding 1 — monotonic alert-severity escalation ──────────────

describe("applyEscalation — alert severity is raised monotonically only", () => {
  const phishingHigh: PagePhishingResult = { score: 60, signals: [], credentialHarvest: false };

  it("does NOT downgrade an analyst-escalated critical alert when the page verdict is HIGH", async () => {
    const { env, alerts, lookalikes } = makeMockEnv(
      [{ id: "l1", page_fetched_at: null, page_http_status: null, page_phishing_score: null, page_signals: null, page_content_hash: null, threat_level: "MEDIUM" }],
      [{ id: "a1", severity: "critical", status: "new" }],
    );
    const row: PageAnalysisRow = {
      id: "l1", brand_id: "b1", domain: "phish.example", threat_level: "MEDIUM",
      alert_id: "a1", brand_name: "Acme", brand_domain: "acme.com",
    };
    const escalated = await applyEscalation(env, row, phishingHigh);
    expect(escalated).toBe(true); // lookalike level rose MEDIUM → HIGH
    expect(lookalikes.get("l1")!.threat_level).toBe("HIGH");
    // ...but the alert's higher manual severity is preserved.
    expect(alerts.get("a1")!.severity).toBe("critical");
  });

  it("raises a lower alert severity up to the new level", async () => {
    const { env, alerts } = makeMockEnv(
      [{ id: "l2", page_fetched_at: null, page_http_status: null, page_phishing_score: null, page_signals: null, page_content_hash: null, threat_level: "MEDIUM" }],
      [{ id: "a2", severity: "low", status: "new" }],
    );
    const row: PageAnalysisRow = {
      id: "l2", brand_id: "b1", domain: "phish.example", threat_level: "MEDIUM",
      alert_id: "a2", brand_name: "Acme", brand_domain: "acme.com",
    };
    await applyEscalation(env, row, phishingHigh);
    expect(alerts.get("a2")!.severity).toBe("high");
  });

  it("returns false and touches nothing when the page verdict does not exceed the current level", async () => {
    const { env, alerts, lookalikes } = makeMockEnv(
      [{ id: "l3", page_fetched_at: null, page_http_status: null, page_phishing_score: null, page_signals: null, page_content_hash: null, threat_level: "HIGH" }],
      [{ id: "a3", severity: "high", status: "new" }],
    );
    const row: PageAnalysisRow = {
      id: "l3", brand_id: "b1", domain: "phish.example", threat_level: "HIGH",
      alert_id: "a3", brand_name: "Acme", brand_domain: "acme.com",
    };
    // score 60 → HIGH, not > HIGH.
    const escalated = await applyEscalation(env, row, phishingHigh);
    expect(escalated).toBe(false);
    expect(lookalikes.get("l3")!.threat_level).toBe("HIGH");
    expect(alerts.get("a3")!.severity).toBe("high");
  });
});

// ─── Finding 3 — failed fetch preserves the prior verdict ─────────

describe("runPageAnalysisForDomain — failed fetch keeps the last good verdict", () => {
  it("advances the cooldown but does NOT wipe score/signals/hash on a blocked fetch", async () => {
    const { env, lookalikes } = makeMockEnv(
      [{
        id: "l4",
        page_fetched_at: "2020-01-01T00:00:00Z",
        page_http_status: 200,
        page_phishing_score: 75,
        page_signals: JSON.stringify(["credential_form", "offdomain_form_exfil"]),
        page_content_hash: "deadbeef",
        threat_level: "CRITICAL",
      }],
      [],
    );

    // A host that fails the SSRF static gate blocks instantly (no network),
    // so fetchSuspectPage returns ok:false and phishing is null.
    const { result, phishing } = await runPageAnalysisForDomain(
      env,
      { id: "l4", domain: "127.0.0.1", brand_name: "Acme", brand_domain: "acme.com" },
      Date.now() + 5000,
    );

    expect(result.ok).toBe(false);
    expect(phishing).toBeNull();

    const row = lookalikes.get("l4")!;
    // Cooldown advanced...
    expect(row.page_fetched_at).toBe(NOW_MARKER);
    // ...but the prior verdict + change-detection baseline are intact.
    expect(row.page_phishing_score).toBe(75);
    expect(row.page_signals).toBe(JSON.stringify(["credential_form", "offdomain_form_exfil"]));
    expect(row.page_content_hash).toBe("deadbeef");
  });
});
