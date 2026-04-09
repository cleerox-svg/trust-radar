// ARCHITECT admin API client — typed thin wrapper over the shared `api`
// fetch client. Used by the /admin/architect page to trigger runs and
// poll the runs table.

import { api } from '@/lib/api';

export type ArchitectRunType = 'ondemand' | 'deep';

export type ArchitectRunStatus =
  | 'collecting'
  | 'analyzing'
  | 'complete'
  | 'failed';

export interface ArchitectRunSummary {
  run_id: string;
  run_type: string;
  status: ArchitectRunStatus;
  created_at: string;           // ISO
  duration_ms: number | null;
  cost_usd: number | null;
  context_bundle_r2_key: string | null;
  error_message: string | null;
}

export interface StartRunResponse {
  success: true;
  run_id: string;
  status: 'collecting';
  started_at: string;           // ISO
}

export interface RunInProgressError {
  success: false;
  error: 'architect_run_in_progress';
  run_id: string;
  status: ArchitectRunStatus;
}

export interface ListRunsResponse {
  success: true;
  runs: ArchitectRunSummary[];
}

export interface GetRunResponse {
  success: true;
  run: ArchitectRunSummary;
  bundle: unknown | null;
}

/**
 * POST /api/admin/architect/collect
 *
 * Returns the 202 success payload on a fresh start. Throws an Error
 * whose `.cause` is a `RunInProgressError` when the backend responds
 * with 409 — callers can inspect it to surface the existing run_id in
 * the UI.
 */
export async function startArchitectRun(
  runType: ArchitectRunType = 'ondemand',
): Promise<StartRunResponse> {
  const res = await api.post<StartRunResponse>(
    '/api/admin/architect/collect',
    { run_type: runType },
  );
  // The shared `api` wrapper always returns the raw JSON body, so we
  // have to distinguish success/409 by the `success` field.
  if (res.success === false) {
    const err = new Error(
      (res as unknown as { error?: string }).error ??
        'Failed to start ARCHITECT run',
    );
    (err as Error & { cause?: unknown }).cause =
      res as unknown as RunInProgressError;
    throw err;
  }
  return res as unknown as StartRunResponse;
}

/**
 * GET /api/admin/architect/runs?limit=20
 */
export async function listArchitectRuns(
  limit = 20,
): Promise<ArchitectRunSummary[]> {
  const res = await api.get<ListRunsResponse>(
    `/api/admin/architect/runs?limit=${encodeURIComponent(String(limit))}`,
  );
  if (res.success === false) {
    throw new Error(
      (res as unknown as { error?: string }).error ??
        'Failed to list ARCHITECT runs',
    );
  }
  return (res as unknown as ListRunsResponse).runs;
}

/**
 * GET /api/admin/architect/runs/:run_id
 */
export async function getArchitectRun(
  runId: string,
): Promise<GetRunResponse> {
  const res = await api.get<GetRunResponse>(
    `/api/admin/architect/runs/${encodeURIComponent(runId)}`,
  );
  if (res.success === false) {
    throw new Error(
      (res as unknown as { error?: string }).error ??
        'Failed to load ARCHITECT run',
    );
  }
  return res as unknown as GetRunResponse;
}

export function isRunInProgressError(
  err: unknown,
): err is Error & { cause: RunInProgressError } {
  if (!(err instanceof Error)) return false;
  const cause = (err as Error & { cause?: unknown }).cause;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { error?: string }).error === 'architect_run_in_progress'
  );
}
