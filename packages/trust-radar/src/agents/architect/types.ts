/**
 * ARCHITECT meta-agent — shared types for context collectors.
 *
 * These types describe the ContextBundle that Phase 1 collectors build.
 * Later phases (Haiku inventory pass, Sonnet synthesis, report rollup)
 * consume the same bundle shape, so keep it stable.
 */

export type RunType = "weekly" | "ondemand" | "deep";
export type RunStatus = "collecting" | "analyzing" | "complete" | "failed";

export interface AgentFile {
  name: string;
  path: string;
  entrypoint: string | null;
  triggers: string[]; // e.g. ['cron','queue','http']
  reads: string[]; // table/binding names referenced
  writes: string[];
  ai_models_referenced: string[];
  loc: number;
  last_modified: string; // ISO
}

export interface FeedFile {
  name: string;
  path: string;
  source_type: string; // 'http','rss','api','stream'
  schedule: string | null;
  loc: number;
  last_modified: string;
}

export interface CronHandler {
  pattern: string;
  handler_path: string;
  agents_invoked: string[];
}

export interface WorkerEntry {
  name: string;
  path: string;
  bindings: string[];
}

export interface RepoInventory {
  collected_at: string;
  agents: AgentFile[];
  feeds: FeedFile[];
  crons: CronHandler[];
  workers: WorkerEntry[];
  totals: {
    agents: number;
    feeds: number;
    crons: number;
    workers: number;
  };
}

export interface TableInventory {
  name: string;
  rows: number;
  /**
   * Estimated bytes-on-disk for the table, derived by sampling row size
   * and extrapolating by row count. `null` means sampling was attempted
   * and failed (timeout, permission error, empty schema) — consumers
   * should treat this as "unknown" and distinguish it from `0`, which
   * means the table really is empty.
   */
  est_bytes: number | null;
  has_indexes: boolean;
  index_count: number;
  growth_7d_rows: number | null;
  growth_7d_pct: number | null;
}

export interface DataLayerInventory {
  collected_at: string;
  tables: TableInventory[];
  totals: {
    table_count: number;
    total_rows: number;
    /** Sum of known `est_bytes` values. Tables with `null` are excluded. */
    total_est_bytes: number;
  };
}

export interface AgentTelemetry {
  agent_name: string;
  runs_7d: number;
  successes_7d: number;
  failures_7d: number;
  avg_duration_ms: number | null;
  ai_cost_usd_7d: number;
  last_run_at: string | null;
  last_error: string | null;
}

export interface CronTelemetry {
  pattern: string;
  runs_7d: number;
  failures_7d: number;
  last_status: "success" | "failure" | "unknown";
}

export interface OpsTelemetry {
  collected_at: string;
  window_days: number;
  agents: AgentTelemetry[];
  crons: CronTelemetry[];
  queues_depth: Record<string, number>;
  ai_gateway: {
    total_cost_usd_7d: number;
    cache_hit_rate: number | null;
    model_mix: Record<string, number>;
  };
}

export interface ContextBundle {
  bundle_version: 1;
  run_id: string;
  generated_at: string;
  repo: RepoInventory;
  data_layer: DataLayerInventory;
  ops: OpsTelemetry;
}
