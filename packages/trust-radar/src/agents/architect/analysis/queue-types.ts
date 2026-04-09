/**
 * ARCHITECT Phase 2 — queue message contract.
 *
 * One message == one analyzer section. The orchestrator (producer)
 * enqueues three of these per run, the consumer pulls one at a
 * time with `max_batch_size = 1` so each section gets its own full
 * Worker execution budget and the Cloudflare Queues runtime handles
 * retries + dead letter for us.
 *
 * Keep this file tiny and dependency-free — it is imported by both
 * producer (orchestrator) and consumer (index.ts) code paths and
 * should not pull analyzer or bundle types with it.
 */

import type { SectionName } from "./types";

export interface AnalysisJobMessage {
  /** architect_reports.run_id — same UUID used for architect_analyses rows. */
  run_id: string;
  /** Which section this message is responsible for. */
  section: SectionName;
  /** R2 key of the bundle blob — consumer loads the bundle itself. */
  bundle_r2_key: string;
  /** ms since epoch — producer-side enqueue timestamp, for latency tracing. */
  enqueued_at: number;
  /**
   * 1-based attempt counter. The consumer increments it on retry so logs
   * always show which attempt we're on; Cloudflare Queues also tracks
   * its own retry count via `msg.attempts`, this is just for our traces.
   */
  attempt: number;
}
