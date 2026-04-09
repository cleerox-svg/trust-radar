/**
 * ARCHITECT — data-layer inventory collector.
 *
 * Queries D1 for every user table (sqlite_master), captures row counts +
 * estimated byte sizes + index counts, computes 7-day growth by comparing
 * to architect_table_snapshots, then writes a fresh snapshot row so the
 * next run has a delta baseline.
 *
 * Pure read-plus-append — never alters existing schema, never deletes rows.
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

interface PragmaRow {
  page_size?: number;
  page_count?: number;
}

interface DbstatRow {
  bytes: number | null;
}

interface SnapshotRow {
  row_count: number;
}

// Valid SQLite identifier — used to whitelist table names pulled from
// sqlite_master before interpolating them into COUNT(*) queries. D1
// prepared statements can't bind table names, so we validate instead.
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Tables we skip entirely — internal SQLite bookkeeping.
const SKIP_TABLES = new Set(["sqlite_sequence", "_cf_KV", "d1_migrations"]);

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

  // dbstat is a virtual table that may or may not be compiled in. Probe once.
  const dbstatAvailable = await probeDbstat(env);

  // Page-based fallback needs the page size once.
  const pageInfo = await readPageInfo(env);

  const tables: TableInventory[] = [];
  let totalRows = 0;
  let totalBytes = 0;

  for (const name of tableNames) {
    const rows = await countRows(env, name);
    totalRows += rows;

    const indexCount = await countIndexes(env, name);
    const estBytes = await estimateBytes(env, name, rows, dbstatAvailable, pageInfo);
    totalBytes += estBytes;

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

    // Append snapshot row for future delta computation.
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

async function probeDbstat(env: Env): Promise<boolean> {
  try {
    await env.DB.prepare(
      `SELECT SUM(pgsize) AS bytes FROM dbstat WHERE name = 'sqlite_master'`,
    ).first<DbstatRow>();
    return true;
  } catch {
    return false;
  }
}

async function readPageInfo(env: Env): Promise<PragmaRow> {
  try {
    const pageSize = await env.DB.prepare("PRAGMA page_size").first<PragmaRow>();
    const pageCount = await env.DB.prepare(
      "PRAGMA page_count",
    ).first<PragmaRow>();
    return {
      page_size: pageSize?.page_size,
      page_count: pageCount?.page_count,
    };
  } catch {
    return {};
  }
}

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

async function estimateBytes(
  env: Env,
  table: string,
  rows: number,
  dbstatAvailable: boolean,
  pageInfo: PragmaRow,
): Promise<number> {
  if (dbstatAvailable) {
    try {
      const row = await env.DB.prepare(
        `SELECT SUM(pgsize) AS bytes FROM dbstat WHERE name = ?`,
      )
        .bind(table)
        .first<DbstatRow>();
      if (row?.bytes !== null && row?.bytes !== undefined) return row.bytes;
    } catch {
      // fall through to proportional fallback
    }
  }
  // Proportional page fallback — distribute total DB bytes by row share.
  const pageSize = pageInfo.page_size ?? 0;
  const pageCount = pageInfo.page_count ?? 0;
  const totalBytes = pageSize * pageCount;
  if (totalBytes === 0 || rows === 0) return 0;
  // We don't know total rows here yet; use a rough 256 bytes/row baseline
  // clamped to the db size. Honest lower bound; the Haiku pass is free to
  // re-estimate with better signal later.
  const estimate = rows * 256;
  return Math.min(estimate, totalBytes);
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
