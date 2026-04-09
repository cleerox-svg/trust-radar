// ARCHITECT — admin control page.
//
// Super-admin cockpit for the ARCHITECT meta-agent. Exposes two buttons
// to trigger a collection run ("Run Collection" = ondemand, "Deep Run"
// = deep) and a table showing recent runs. Auto-refreshes every 10s
// while any row is still in a non-terminal status so the UI reflects
// the background worker finishing without a manual reload.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Compass } from 'lucide-react';

import {
  getArchitectRun,
  isRunInProgressError,
  listArchitectRuns,
  startArchitectRun,
  type ArchitectRunStatus,
  type ArchitectRunSummary,
  type ArchitectRunType,
} from '@/api/architectApi';
import { Badge, Button, Card, PageHeader } from '@/design-system/components';

/* ─── Helpers ─────────────────────────────────────────────────────── */

const POLL_INTERVAL_MS = 10_000;
const TERMINAL: ReadonlySet<ArchitectRunStatus> = new Set<ArchitectRunStatus>([
  'complete',
  'failed',
]);

function isTerminal(status: ArchitectRunStatus): boolean {
  return TERMINAL.has(status);
}

function statusSeverity(
  status: ArchitectRunStatus,
): 'critical' | 'high' | 'medium' | 'info' {
  switch (status) {
    case 'complete':
      return 'info';
    case 'failed':
      return 'critical';
    case 'analyzing':
      return 'high';
    case 'collecting':
    default:
      return 'medium';
  }
}

function statusColor(status: ArchitectRunStatus): string {
  switch (status) {
    case 'complete':
      return 'var(--green)';
    case 'failed':
      return 'var(--sev-critical)';
    case 'analyzing':
      return 'var(--sev-high)';
    case 'collecting':
    default:
      return 'var(--amber)';
  }
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 0) return 'just now';
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(then).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function formatCost(usd: number | null): string {
  if (usd === null || usd === undefined) return '—';
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}

/* ─── Main page ───────────────────────────────────────────────────── */

export function Architect() {
  const [runs, setRuns] = useState<ArchitectRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<ArchitectRunType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bundleRunId, setBundleRunId] = useState<string | null>(null);
  const [bundleContent, setBundleContent] = useState<string | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);

  const hasActiveRun = useMemo(
    () => runs.some((r) => !isTerminal(r.status)),
    [runs],
  );

  const refresh = useCallback(async () => {
    try {
      const next = await listArchitectRuns(20);
      setRuns(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll while any row is non-terminal.
  useEffect(() => {
    if (!hasActiveRun) return;
    const id = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasActiveRun, refresh]);

  const handleStart = useCallback(
    async (runType: ArchitectRunType) => {
      setStarting(runType);
      setError(null);
      setMessage(null);
      try {
        const res = await startArchitectRun(runType);
        setMessage(
          `Started ${runType === 'deep' ? 'deep' : 'on-demand'} run ${res.run_id.slice(0, 8)}…`,
        );
        await refresh();
      } catch (err) {
        if (isRunInProgressError(err)) {
          setError(
            `A run is already ${err.cause.status} (${err.cause.run_id.slice(0, 8)}…). Wait for it to finish or the 30 minute window to elapse.`,
          );
          await refresh();
        } else {
          setError(
            err instanceof Error ? err.message : 'Failed to start run',
          );
        }
      } finally {
        setStarting(null);
      }
    },
    [refresh],
  );

  const openBundle = useCallback(async (runId: string) => {
    setBundleRunId(runId);
    setBundleContent(null);
    setBundleLoading(true);
    try {
      const res = await getArchitectRun(runId);
      setBundleContent(JSON.stringify(res.bundle, null, 2));
    } catch (err) {
      setBundleContent(
        `Failed to load bundle: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBundleLoading(false);
    }
  }, []);

  const closeBundle = useCallback(() => {
    setBundleRunId(null);
    setBundleContent(null);
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="ARCHITECT"
        subtitle="Meta-agent audit & proposal engine"
        badge={
          <Compass
            size={22}
            strokeWidth={1.8}
            style={{
              color: 'var(--amber)',
              filter: 'drop-shadow(0 0 6px rgba(229,168,50,0.45))',
            }}
          />
        }
      />

      {/* Action card */}
      <Card variant="base" padding={20}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div
              className="font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: 'var(--amber)' }}
            >
              Trigger Collection
            </div>
            <p
              className="mt-2 text-[13px] leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              Run the three ARCHITECT context collectors (repo, data layer,
              ops telemetry) and upload the bundle to R2. The collection
              runs in the background; this page will auto-refresh while the
              run is in flight.
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleStart('ondemand')}
              loading={starting === 'ondemand'}
              disabled={starting !== null || hasActiveRun}
            >
              Run Collection
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void handleStart('deep')}
              loading={starting === 'deep'}
              disabled={starting !== null || hasActiveRun}
            >
              Deep Run
            </Button>
          </div>
        </div>

        {(error || message) && (
          <div
            className="mt-4 rounded-md px-3 py-2 font-mono text-[11px]"
            style={
              error
                ? {
                    background: 'var(--sev-critical-bg)',
                    border: '1px solid var(--sev-critical-border)',
                    color: 'var(--sev-critical)',
                  }
                : {
                    background: 'rgba(229,168,50,0.08)',
                    border: '1px solid rgba(229,168,50,0.25)',
                    color: 'var(--amber)',
                  }
            }
          >
            {error ?? message}
          </div>
        )}
      </Card>

      {/* Runs table */}
      <Card variant="base" padding={0}>
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: 'var(--amber)' }}
          >
            Recent Runs
          </div>
          <div
            className="font-mono text-[10px]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {hasActiveRun
              ? 'Auto-refreshing every 10s…'
              : `${runs.length} run${runs.length === 1 ? '' : 's'}`}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div
            className="px-5 py-12 text-center font-mono text-[11px]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            No runs yet. Trigger a collection to populate this table.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Started', 'Type', 'Status', 'Duration', 'Cost', 'Bundle'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.run_id}
                    className="border-b border-white/[0.03]"
                  >
                    <td
                      className="whitespace-nowrap px-5 py-3 font-mono text-[12px]"
                      style={{ color: 'var(--text-secondary)' }}
                      title={formatAbsolute(run.created_at)}
                    >
                      {formatRelative(run.created_at)}
                    </td>
                    <td
                      className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {run.run_type}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{
                            background: statusColor(run.status),
                            boxShadow: !isTerminal(run.status)
                              ? `0 0 8px ${statusColor(run.status)}`
                              : undefined,
                            animation: !isTerminal(run.status)
                              ? 'pulse 1.5s ease-in-out infinite'
                              : undefined,
                          }}
                        />
                        <Badge
                          severity={statusSeverity(run.status)}
                          label={run.status}
                          size="xs"
                        />
                      </span>
                    </td>
                    <td
                      className="whitespace-nowrap px-5 py-3 font-mono text-[11px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {formatDuration(run.duration_ms)}
                    </td>
                    <td
                      className="whitespace-nowrap px-5 py-3 font-mono text-[11px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {formatCost(run.cost_usd)}
                    </td>
                    <td className="px-5 py-3">
                      {run.status === 'complete' && run.context_bundle_r2_key ? (
                        <button
                          onClick={() => void openBundle(run.run_id)}
                          className="font-mono text-[11px] underline-offset-2 hover:underline"
                          style={{ color: 'var(--amber)' }}
                        >
                          view
                        </button>
                      ) : run.status === 'failed' && run.error_message ? (
                        <span
                          className="font-mono text-[11px]"
                          style={{ color: 'var(--sev-critical)' }}
                          title={run.error_message}
                        >
                          {run.error_message.length > 40
                            ? `${run.error_message.slice(0, 40)}…`
                            : run.error_message}
                        </span>
                      ) : (
                        <span
                          className="font-mono text-[11px]"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Bundle viewer modal — portaled to <body> so it escapes any parent
          stacking context and covers the full viewport including the TopBar. */}
      {bundleRunId &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{
              background: 'rgba(0,0,0,0.70)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 'var(--z-modal)' as unknown as number,
            }}
            onClick={closeBundle}
          >
            <div
              className="flex max-h-[85vh] min-h-0 w-full max-w-4xl flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <Card
                variant="elevated"
                padding={0}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div
                  className="flex flex-shrink-0 items-center justify-between px-5 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="font-mono text-[11px] uppercase tracking-[0.18em]"
                    style={{ color: 'var(--amber)' }}
                  >
                    Bundle · {bundleRunId.slice(0, 8)}…
                  </div>
                  <Button variant="ghost" size="sm" onClick={closeBundle}>
                    Close
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {bundleLoading ? (
                    <div
                      className="p-8 text-center font-mono text-[11px]"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      Loading bundle…
                    </div>
                  ) : (
                    <pre
                      className="whitespace-pre-wrap break-all p-5 font-mono text-[11px]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {bundleContent ?? 'Bundle unavailable'}
                    </pre>
                  )}
                </div>
              </Card>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
