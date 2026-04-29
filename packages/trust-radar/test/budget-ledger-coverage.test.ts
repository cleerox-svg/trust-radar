/**
 * Phase 4 Step 2D — Ledger coverage regression test.
 *
 * The Phase 4 Step 2 wrapper refactor's whole point is that every
 * Anthropic call site in the worker now writes a budget_ledger row
 * automatically. This test proves it end-to-end: it mocks fetch with
 * canned Anthropic responses, drives one representative call from
 * each migrated surface (haiku.ts helpers, lib helpers, handlers,
 * direct-fetch agents that were rewritten), and asserts that
 * budget_ledger received exactly the expected rows with the right
 * agent_id, model, and non-zero cost.
 *
 * If anyone in the future adds an AI code path that bypasses the
 * canonical wrapper, the surface they touch loses its ledger row
 * here and the corresponding assertion fails.
 *
 * Surfaces covered:
 *   1. haiku.ts.classifyThreat       → agentId from caller
 *   2. haiku.ts.callHaikuRaw          → agentId from caller
 *   3. agents/social-ai-assessor      → agentId="social_ai_assessor"
 *   4. agents/evidence-assembler      → agentId="evidence_assembler"
 *   5. lib/brand-enricher.classifySector → agentId="brand-enricher"
 *   6. honeypot-generator             → agentId="honeypot-generator"
 *   7. canonical wrapper directly     → arbitrary agentId
 *
 * The Architect analyzer + synthesizer have their own happy-path
 * tests that already exercise the wrapper (they log the "env.DB
 * missing — ledger row skipped" warning when run with a stub env;
 * here we run with a real DB stub so the row lands).
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

import { classifyThreat, callHaikuRaw } from "../src/lib/haiku";
import { socialAiAssessorAgent, type SocialAiAssessorInput } from "../src/agents/social-ai-assessor";
import { evidenceAssemblerAgent, type EvidenceAssemblerInput } from "../src/agents/evidence-assembler";
import { classifySector } from "../src/lib/brand-enricher";
import { generateHoneypotSite } from "../src/honeypot-generator";
import { callAnthropic } from "../src/lib/anthropic";

// ─── Fake D1 ─────────────────────────────────────────────────────

interface LedgerRow {
  agent_id: string;
  run_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

function makeFakeDb() {
  const rows: LedgerRow[] = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        run: async () => {
          if (/INSERT INTO budget_ledger/i.test(sql)) {
            rows.push({
              agent_id: String(_args[1]),
              run_id: _args[2] == null ? null : String(_args[2]),
              model: String(_args[3]),
              input_tokens: Number(_args[4]),
              output_tokens: Number(_args[5]),
              cost_usd: Number(_args[6]),
            });
          }
          return { meta: {} };
        },
        first: async () => null,
        all: async () => ({ results: [] }),
      }),
    }),
  } as unknown as D1Database;
  return { db, rows };
}

function makeFakeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    put: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    delete: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  } as unknown as KVNamespace;
}

function makeEnv(db: D1Database) {
  return {
    ANTHROPIC_API_KEY: "sk-ant-test",
    LRX_API_KEY: undefined,
    CF_ACCOUNT_ID: undefined,
    DB: db,
    CACHE: makeFakeKv(),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function buildJsonReply(jsonString: string, model = "claude-haiku-4-5-20251001", inputTokens = 100, outputTokens = 50) {
  return {
    id: "msg_test",
    model,
    stop_reason: "end_turn",
    content: [{ type: "text", text: jsonString }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

function buildTextReply(text: string, model = "claude-haiku-4-5-20251001", inputTokens = 100, outputTokens = 50) {
  return {
    id: "msg_test",
    model,
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe("budget_ledger coverage — every migrated surface lands a row", () => {
  let fetchSpy: Mock;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("haiku.ts classifyThreat writes a ledger row attributed to the caller's agentId", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(
        buildJsonReply(
          '{"threat_type":"phishing","confidence":92,"severity":"high","reasoning":"x","ioc_indicators":[]}',
          "claude-haiku-4-5-20251001",
          400,
          120,
        ),
      ),
    );

    const { db, rows } = makeFakeDb();
    const result = await classifyThreat(
      makeEnv(db) as never,
      { agentId: "sentinel", runId: "run-1" },
      { malicious_domain: "evil.example", source_feed: "phishtank" },
    );

    expect(result.success).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.agent_id).toBe("sentinel");
    expect(rows[0]!.run_id).toBe("run-1");
    expect(rows[0]!.model).toBe("claude-haiku-4-5-20251001");
    expect(rows[0]!.cost_usd).toBeGreaterThan(0);
  });

  it("haiku.ts callHaikuRaw writes a ledger row with caller-provided agentId/runId", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(buildTextReply("YES")),
    );

    const { db, rows } = makeFakeDb();
    const result = await callHaikuRaw(
      makeEnv(db) as never,
      { agentId: "brand-deep-scan", runId: null },
      "Reply YES or NO.",
      "Is this brand impersonation?",
    );

    expect(result.success).toBe(true);
    expect(result.text).toBe("YES");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.agent_id).toBe("brand-deep-scan");
    expect(rows[0]!.run_id).toBeNull();
    expect(rows[0]!.cost_usd).toBeGreaterThan(0);
  });

  it("agents/social-ai-assessor writes a ledger row with agentId='social_ai_assessor'", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(
        buildJsonReply(
          '{"classification":"impersonation","confidence":0.9,"action":"takedown","reasoning":"clearly fake — handle squats the official acme namespace and bio claims partnership","evidence_draft":"draft","signals":[],"cross_correlations":[]}',
        ),
      ),
    );

    const input: SocialAiAssessorInput = {
      brandName: "Acme",
      brandDomain: "acme.com",
      brandAliases: [],
      brandKeywords: [],
      officialHandles: {},
      platform: "twitter",
      handle: "acme_official_real",
      profileUrl: "https://twitter.com/acme_official_real",
      displayName: "Acme",
      bio: "we are acme",
      followersCount: 12,
      verified: false,
      accountCreated: null,
      existingThreats: [],
      emailSecurityGrade: null,
      activeCampaigns: [],
      lookalikeDomainsFound: 0,
      otherImpersonationProfiles: 0,
    };

    const { db, rows } = makeFakeDb();
    const result = await socialAiAssessorAgent.execute({
      env: makeEnv(db) as never,
      runId: "run-social-1",
      agentName: "social_ai_assessor",
      input: input as unknown as Record<string, unknown>,
      triggeredBy: null,
    });

    const output = result.output as { classification: string };
    expect(output.classification).toBe("impersonation");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.agent_id).toBe("social_ai_assessor");
    expect(rows[0]!.run_id).toBe("run-social-1");
    expect(rows[0]!.cost_usd).toBeGreaterThan(0);
  });

  it("lib/brand-enricher.classifySector writes a ledger row with agentId='brand-enricher'", async () => {
    // First fetch is the website title fetch (best-effort, can fail).
    // Second fetch is the Anthropic call. Make the first throw so we
    // skip the title fetch path entirely, then return a clean sector.
    fetchSpy.mockRejectedValueOnce(new Error("title fetch unavailable"));
    fetchSpy.mockResolvedValueOnce(jsonResponse(buildTextReply("finance", "claude-haiku-4-5-20251001", 80, 5)));

    const { db, rows } = makeFakeDb();
    const sector = await classifySector(makeEnv(db) as never, "examplebank.com", "Example Bank");

    expect(sector).toBe("finance");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.agent_id).toBe("brand-enricher");
    expect(rows[0]!.run_id).toBeNull();
    expect(rows[0]!.cost_usd).toBeGreaterThan(0);
  });

  it("honeypot-generator writes THREE ledger rows (index + contact + team) with agentId='honeypot-generator'", async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(buildTextReply("<!DOCTYPE html><html>index</html>")))
      .mockResolvedValueOnce(jsonResponse(buildTextReply("<!DOCTYPE html><html>contact</html>")))
      .mockResolvedValueOnce(jsonResponse(buildTextReply("<!DOCTYPE html><html>team</html>")));

    const { db, rows } = makeFakeDb();
    const out = await generateHoneypotSite(makeEnv(db) as never, {
      hostname: "novaridge.example",
      businessName: "Novaridge",
      businessType: "consulting",
      city: "Vancouver, BC",
      trapAddresses: [{ address: "info@novaridge.example", role: "Info" }],
      teamMembers: [{ name: "Sarah Chen", title: "MD", email: "info@novaridge.example" }],
    });

    expect(out.index).toContain("index");
    expect(out.contact).toContain("contact");
    expect(out.team).toContain("team");

    // One row per generated page — three pages, three rows.
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.agent_id).toBe("honeypot-generator");
      expect(row.cost_usd).toBeGreaterThan(0);
    }
  });

  it("canonical wrapper accepts arbitrary agentId and writes one row per call (regression for the wrapper contract)", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(buildTextReply("ok", "claude-sonnet-4-5-20250929", 1000, 200)));

    const { db, rows } = makeFakeDb();
    const response = await callAnthropic(makeEnv(db), {
      agentId: "ai-attribution",
      runId: null,
      model: "claude-sonnet-4-5-20250929",
      messages: [{ role: "user", content: "x" }],
      maxTokens: 64,
    });

    expect(response.usage.input_tokens).toBe(1000);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.agent_id).toBe("ai-attribution");
    expect(rows[0]!.model).toBe("claude-sonnet-4-5-20250929");
    // Sonnet 4.5: $3 in / $15 out per M tokens.
    // 1000 in → $0.003, 200 out → $0.003, total → $0.006
    expect(rows[0]!.cost_usd).toBeCloseTo(0.006, 6);
  });

  it("agents/evidence-assembler writes a ledger row with agentId='evidence_assembler'", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(
        buildJsonReply(
          JSON.stringify({
            target_summary:
              "The reported account is impersonating Acme on Twitter using a near-identical handle and copied profile photo to harvest customer credentials.",
            brand_impact:
              "End-users redirected to phishing pages believing they're contacting Acme support; trust loss + credential harvest hits the bank's customers directly.",
            technical_evidence:
              "Profile created 2026-04-12, hosted IPs trace to AS39501 (known phishing infrastructure), threat-feed signals: 14 active phishing URLs cross-referencing the lookalike domain.",
            recommended_action:
              "File abuse report with Twitter under impersonation policy; request immediate suspension and preservation of activity logs.",
            provider_submission_draft:
              "Subject: Brand-impersonation takedown — @acme_official_real on Twitter. Hello, Averrow has confirmed the account in question is impersonating our customer Acme. Evidence is available on request. Please remove the account under your impersonation policy.",
          }),
        ),
      ),
    );

    const input: EvidenceAssemblerInput = {
      takedownId: "td-test-1",
      targetType: "social_account",
      targetValue: "@acme_official_real",
      targetPlatform: "twitter",
      targetUrl: "https://twitter.com/acme_official_real",
      brandJson: JSON.stringify({ name: "Acme", canonical_domain: "acme.com" }),
      relatedThreatsJson: JSON.stringify([{ type: "phishing", count: 14 }]),
      urlScanJson: JSON.stringify("None"),
      socialProfileJson: JSON.stringify({ platform: "twitter", handle: "acme_official_real" }),
      whoisJson: JSON.stringify({ asn: "AS39501" }),
      existingEvidenceJson: JSON.stringify([]),
      providerJson: JSON.stringify({ provider_name: "twitter" }),
    };

    const { db, rows } = makeFakeDb();
    const result = await evidenceAssemblerAgent.execute({
      env: makeEnv(db) as never,
      runId: "run-evidence-1",
      agentName: "evidence_assembler",
      input: input as unknown as Record<string, unknown>,
      triggeredBy: null,
    });

    const output = result.output as { aiSucceeded: boolean; targetSummary: string };
    expect(output.aiSucceeded).toBe(true);
    expect(output.targetSummary.length).toBeGreaterThan(20);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.agent_id).toBe("evidence_assembler");
    expect(rows[0]!.run_id).toBe("run-evidence-1");
    expect(rows[0]!.cost_usd).toBeGreaterThan(0);
  });
});
