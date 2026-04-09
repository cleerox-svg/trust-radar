/**
 * ARCHITECT Phase 2 orchestrator (producer) tests.
 *
 * The orchestrator is now a thin queue producer. It validates the
 * architect_reports row, inserts three architect_analyses rows as
 * pending, and enqueues three messages on ARCHITECT_ANALYSIS_QUEUE.
 *
 * These tests pin the producer's happy path + the enqueue-failed
 * recovery path:
 *
 * 1. Happy: the report row exists and is complete, three pending
 *    rows land in D1, sendBatch is called once with exactly three
 *    messages (one per section).
 * 2. Enqueue failure: the pending rows exist but sendBatch rejects —
 *    the producer must flip all three rows to failed with
 *    'enqueue_failed: <error>' before re-throwing so nothing is
 *    left pending with no consumer coming for it.
 */

import { describe, it, expect, vi } from "vitest";

import { runAnalysis } from "../orchestrator";
import type { AnalysisJobMessage } from "../queue-types";

// ─── Mock D1 ───────────────────────────────────────────────────────
//
// Mirrors the shape the producer needs: fetchReport (first() on
// architect_reports), insertPendingRow (INSERT), and markRunFailed
// (UPDATE … WHERE run_id = ? AND status IN ('pending','analyzing')).

interface MockRow {
  id: string;
  run_id: string;
  section: string;
  status: "pending" | "analyzing" | "complete" | "failed";
  error_message: string | null;
}

interface MockDbHandle {
  db: D1Database;
  rows: Map<string, MockRow>;
  statements: Array<{ sql: string; params: unknown[] }>;
}

function makeMockDb(report: {
  run_id: string;
  status: string;
  context_bundle_r2_key: string;
}): MockDbHandle {
  const rows = new Map<string, MockRow>();
  const statements: MockDbHandle["statements"] = [];

  function prepare(sql: string) {
    return {
      bind(...params: unknown[]) {
        statements.push({ sql, params });
        return {
          async first<T>(): Promise<T | null> {
            if (sql.includes("FROM architect_reports")) {
              return report as unknown as T;
            }
            return null;
          },
          async run() {
            if (sql.includes("INSERT INTO architect_analyses")) {
              const [id, runId, , section] = params as [
                string,
                string,
                number,
                string,
              ];
              rows.set(id, {
                id,
                run_id: runId,
                section,
                status: "pending",
                error_message: null,
              });
              return { success: true, meta: {} };
            }
            if (
              sql.includes("UPDATE architect_analyses") &&
              sql.includes("status = 'failed'") &&
              sql.includes("WHERE run_id = ?")
            ) {
              // producer's markRunFailed: binds (errorMessage, runId)
              const [errorMessage, runId] = params as [string, string];
              for (const row of rows.values()) {
                if (
                  row.run_id === runId &&
                  (row.status === "pending" || row.status === "analyzing")
                ) {
                  row.status = "failed";
                  row.error_message = errorMessage;
                }
              }
              return { success: true, meta: {} };
            }
            return { success: true, meta: {} };
          },
        };
      },
    };
  }

  return {
    db: { prepare } as unknown as D1Database,
    rows,
    statements,
  };
}

function makeMockR2() {
  return {
    // The producer calls fetchReport → checks ARCHITECT_BUNDLES is
    // present, but never dereferences it (consumer owns bundle load).
    // A stub object is enough.
    async get() {
      return null;
    },
  } as unknown as R2Bucket;
}

function makeMockQueue(
  sendBatchImpl: (
    messages: { body: AnalysisJobMessage }[],
  ) => Promise<void>,
): {
  queue: Queue<AnalysisJobMessage>;
  sendBatch: ReturnType<typeof vi.fn>;
} {
  const sendBatch = vi.fn(sendBatchImpl);
  const queue = {
    send: vi.fn(),
    sendBatch,
  } as unknown as Queue<AnalysisJobMessage>;
  return { queue, sendBatch };
}

function makeEnv(
  db: D1Database,
  queue: Queue<AnalysisJobMessage>,
) {
  return {
    DB: db,
    ARCHITECT_BUNDLES: makeMockR2(),
    ARCHITECT_ANALYSIS_QUEUE: queue,
  } as unknown as Parameters<typeof runAnalysis>[1];
}

// ─── Test 1: happy path ────────────────────────────────────────────

describe("orchestrator — producer happy path", () => {
  it("inserts three pending rows and enqueues three messages in one sendBatch call", async () => {
    const handle = makeMockDb({
      run_id: "run-happy",
      status: "complete",
      context_bundle_r2_key: "bundles/run-happy.json",
    });

    const { queue, sendBatch } = makeMockQueue(async () => {});
    const env = makeEnv(handle.db, queue);

    const result = await runAnalysis("run-happy", env);

    // Three pending rows landed in D1, one per section.
    const sections = [...handle.rows.values()]
      .map((r) => r.section)
      .sort();
    expect(sections).toEqual(["agents", "data_layer", "feeds"]);
    for (const row of handle.rows.values()) {
      expect(row.status).toBe("pending");
      expect(row.run_id).toBe("run-happy");
    }

    // sendBatch called exactly once with exactly three messages.
    expect(sendBatch).toHaveBeenCalledTimes(1);
    const batchArg = sendBatch.mock.calls[0]![0] as {
      body: AnalysisJobMessage;
    }[];
    expect(batchArg).toHaveLength(3);
    const enqueuedSections = batchArg
      .map((m) => m.body.section)
      .sort();
    expect(enqueuedSections).toEqual(["agents", "data_layer", "feeds"]);

    // Every message carries the same run_id + bundle key + attempt=1.
    for (const m of batchArg) {
      expect(m.body.run_id).toBe("run-happy");
      expect(m.body.bundle_r2_key).toBe("bundles/run-happy.json");
      expect(m.body.attempt).toBe(1);
      expect(typeof m.body.enqueued_at).toBe("number");
    }

    expect(result.enqueued).toBe(3);
    expect(result.run_id).toBe("run-happy");
    expect(Object.keys(result.row_ids).sort()).toEqual([
      "agents",
      "data_layer",
      "feeds",
    ]);
  });
});

// ─── Test 2: enqueue failure → all rows flipped to failed ─────────

describe("orchestrator — enqueue failure recovery", () => {
  it("flips all pending rows to failed with 'enqueue_failed: ...' and re-throws when sendBatch rejects", async () => {
    const handle = makeMockDb({
      run_id: "run-enqueue-fail",
      status: "complete",
      context_bundle_r2_key: "bundles/run-enqueue-fail.json",
    });

    const { queue, sendBatch } = makeMockQueue(async () => {
      throw new Error("queue unreachable");
    });
    const env = makeEnv(handle.db, queue);

    await expect(runAnalysis("run-enqueue-fail", env)).rejects.toThrow(
      /queue unreachable/,
    );
    expect(sendBatch).toHaveBeenCalledTimes(1);

    // All three rows flipped to failed with the enqueue_failed prefix.
    const rows = [...handle.rows.values()];
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.status).toBe("failed");
      expect(row.error_message).toMatch(/^enqueue_failed: queue unreachable/);
    }
  });
});

// ─── Test 3: report validation rejects non-complete runs ──────────

describe("orchestrator — report validation", () => {
  it("throws and inserts no rows when the report is not in status='complete'", async () => {
    const handle = makeMockDb({
      run_id: "run-collecting",
      status: "collecting",
      context_bundle_r2_key: "bundles/run-collecting.json",
    });

    const { queue, sendBatch } = makeMockQueue(async () => {});
    const env = makeEnv(handle.db, queue);

    await expect(runAnalysis("run-collecting", env)).rejects.toThrow(
      /status 'collecting'/,
    );
    expect(sendBatch).not.toHaveBeenCalled();
    expect(handle.rows.size).toBe(0);
  });
});
