/**
 * ARCHITECT — data-layer inventory collector.
 *
 * Queries D1 for every user table (sqlite_master), captures row counts +
 * sampled byte-size estimates + index counts, computes 7-day growth by
 * comparing to architect_table_snapshots, then writes a fresh snapshot
 * row so the next run has a delta baseline.
 *
 * Pure read-plus-append — never alters existing schema, never deletes
 * rows.
 *
 * Byte-size estimation: D1 does not compile in the `dbstat` virtual
 * table, so a direct "how big is this table" query is impossible.
 * Instead we sample at most 1000 rows per table, compute the average
 * serialized length, and extrapolate to the row count. The sample is
 * wrapped in a 100ms soft budget — if it doesn't return in time we set
 * `est_bytes` to `null` so ARCHITECT can tell "unknown" apart from
 * "empty" downstream.
 */

import type { Env } from "../../../types";
import type { DataLayerInventory, TableInventory } from "../types";

// ─── Query row shapes ─────────────────────────────────────────────

interface MasterTableRow {
  name: string;
}

interface CountRow {
  n: number;
}

interface IndexCountRow {
  c: number;
}

interface ColumnInfoRow {
  name: string | null;
}

interface SampleRow {
  total_bytes: number | null;
  n: number;
}

interface SnapshotRow {
  row_count: number;
}

// Valid SQLite identifier — used to whitelist table and column names
// pulled from sqlite_master / PRAGMA output before interpolating them
// into size-sampling queries. D1 prepared statements can't bind
// identifiers, so we validate instead.
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Tables we skip entirely — internal SQLite bookkeeping.
const SKIP_TABLES = new Set(["sqlite_sequence", "_cf_KV", "d1_migrations"]);

// Soft wall-clock budget per sample query. D1 does not let us cancel a
// running query, so this is really "how long we will wait before giving
// up and returning null"; the query may still finish in the background.
const SAMPLE_TIMEOUT_MS = 100;

// Cap on sampled rows. Higher = more accurate average, but also more
// I/O per ARCHITECT run. 1000 is a reasonable trade-off for tables up
// to the 100K-row range.
const SAMPLE_LIMIT = 1000;

// ─── Public API ───────────────────────────────────────────────────

export async function collectDataLayerInventory(
  env: Env,
): Promise<DataLayerInventory> {
  const collectedAt = new Date().toISOString();
  const nowMs = Date.now();
  const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;

  const tableRows = await env.DB.prepare(
    `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
  ).all<MasterTableRow>();

  const tableNames = (tableRows.results ?? [])
    .map((r) => r.name)
    .filter((name) => IDENT_RE.test(name) && !SKIP_TABLES.has(name));

  const tables: TableInventory[] = [];
  let totalRows = 0;
  let totalBytes = 0;

  for (const name of tableNames) {
    const rows = await countRows(env, name);
    totalRows += rows;

    const indexCount = await countIndexes(env, name);
    const estBytes = await estimateBytes(env, name, rows);
    if (estBytes !== null) {
      totalBytes += estBytes;
    }

    const growth = await computeGrowth(env, name, rows, sevenDaysAgoMs);

    tables.push({
      name,
      rows,
      est_bytes: estBytes,
      has_indexes: indexCount > 0,
      index_count: indexCount,
      growth_7d_rows: growth.rows,
      growth_7d_pct: growth.pct,
    });

    // Append snapshot row for future delta computation. est_bytes is
    // nullable in the schema so we can faithfully persist "unknown".
    await env.DB.prepare(
      `INSERT INTO architect_table_snapshots
         (captured_at, table_name, row_count, est_bytes)
         VALUES (?, ?, ?, ?)`,
    )
      .bind(nowMs, name, rows, estBytes)
      .run();
  }

  return {
    collected_at: collectedAt,
    tables,
    totals: {
      table_count: tables.length,
      total_rows: totalRows,
      total_est_bytes: totalBytes,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

async function countRows(env: Env, table: string): Promise<number> {
  // Table name is whitelisted via IDENT_RE against sqlite_master output
  // above, so interpolation is safe here. D1 cannot bind identifiers.
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM "${table}"`,
  ).first<CountRow>();
  return row?.n ?? 0;
}

async function countIndexes(env: Env, table: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM sqlite_master
       WHERE type = 'index' AND tbl_name = ?`,
  )
    .bind(table)
    .first<IndexCountRow>();
  return row?.c ?? 0;
}

/**
 * Sampled size estimate. Returns:
 *   - `0`    when the table is empty (truly zero bytes of row data)
 *   - a positive number when sampling succeeded
 *   - `null` when sampling failed (timeout, permission error, bad
 *     schema response) — callers should treat this as "unknown"
 */
async function estimateBytes(
  env: Env,
  table: string,
  rows: number,
): Promise<number | null> {
  if (rows === 0) return 0;

  const columns = await listSampleableColumns(env, table);
  if (columns.length === 0) return null;

  // Build SUM(COALESCE(LENGTH("col1"),0) + COALESCE(LENGTH("col2"),0) + …)
  // over the sample. LENGTH returns bytes for BLOB and characters for
  // TEXT — not perfect for multi-byte text, but the order of magnitude
  // is what ARCHITECT cares about. Row-size outside column data (page
  // overhead, indexes, slack) is ignored — the Haiku pass is free to
  // scale this later.
  const lengthExpr = columns
    .map((c) => `COALESCE(LENGTH("${c}"), 0)`)
    .join(" + ");

  const query =
    `SELECT SUM(${lengthExpr}) AS total_bytes, COUNT(*) AS n ` +
    `FROM (SELECT * FROM "${table}" LIMIT ${SAMPLE_LIMIT})`;

  try {
    const sample = await raceWithTimeout(
      env.DB.prepare(query).first<SampleRow>(),
      SAMPLE_TIMEOUT_MS,
    );
    if (!sample || !sample.n || sample.n === 0) return null;
    const avgRowBytes = (sample.total_bytes ?? 0) / sample.n;
    return Math.round(avgRowBytes * rows);
  } catch {
    // Timeout or SQL error — leave the caller with "unknown" so ARCHITECT
    // can distinguish an estimation gap from an empty table.
    return null;
  }
}

async function listSampleableColumns(
  env: Env,
  table: string,
): Promise<string[]> {
  // PRAGMA statements don't accept bound parameters in D1. Table name
  // is already whitelisted via IDENT_RE, and we re-validate column
  // names below before interpolating them into the sample query.
  try {
    const result = await env.DB.prepare(
      `PRAGMA table_info("${table}")`,
    ).all<ColumnInfoRow>();
    const out: string[] = [];
    for (const row of result.results ?? []) {
      const name = row.name;
      if (name && IDENT_RE.test(name)) out.push(name);
    }
    return out;
  } catch {
    return [];
  }
}

async function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`sample timeout after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface GrowthResult {
  rows: number | null;
  pct: number | null;
}

async function computeGrowth(
  env: Env,
  table: string,
  currentRows: number,
  sinceMs: number,
): Promise<GrowthResult> {
  const prior = await env.DB.prepare(
    `SELECT row_count FROM architect_table_snapshots
       WHERE table_name = ?
         AND captured_at <= ?
       ORDER BY captured_at DESC
       LIMIT 1`,
  )
    .bind(table, sinceMs)
    .first<SnapshotRow>();

  if (!prior) return { rows: null, pct: null };
  const deltaRows = currentRows - prior.row_count;
  const pct =
    prior.row_count > 0 ? (deltaRows / prior.row_count) * 100 : null;
  return { rows: deltaRows, pct };
}
