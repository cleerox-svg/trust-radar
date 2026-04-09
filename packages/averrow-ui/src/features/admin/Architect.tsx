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
  getArchitectAnalyses,
  getArchitectRun,
  getArchitectSynthesis,
  isAnalysisInProgressError,
  isRunInProgressError,
  isSynthesisInProgressError,
  listArchitectRuns,
  startArchitectAnalysis,
  startArchitectRun,
  startArchitectSynthesis,
  type ArchitectAnalysisRow,
  type ArchitectRunStatus,
  type ArchitectRunSummary,
  type ArchitectRunType,
} from '@/api/architectApi';
import { Badge, Button, Card, PageHeader } from '@/design-system/components';

/* ─── Helpers ─────────────────────────────────────────────────────── */

const POLL_INTERVAL_MS = 10_000;
const POLL_ANALYSIS_INTERVAL_MS = 5_000;
const POLL_SYNTHESIS_INTERVAL_MS = 5_000;
const ANALYSIS_SECTIONS_REQUIRED = 3;

type AnalysisState =
  | { kind: 'starting' }
  | { kind: 'polling' }
  | { kind: 'ready'; analyses: ArchitectAnalysisRow[] }
  | { kind: 'error'; message: string };

type SynthesisState =
  | { kind: 'starting' }
  | { kind: 'polling' }
  | { kind: 'ready'; reportMd: string }
  | { kind: 'error'; message: string };

type ModalKind = 'bundle' | 'analysis' | 'synthesis';
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
  const [modalRunId, setModalRunId] = useState<string | null>(null);
  const [modalKind, setModalKind] = useState<ModalKind>('bundle');
  const [modalContent, setModalContent] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [analysisState, setAnalysisState] = useState<
    Record<string, AnalysisState>
  >({});
  const [synthesisState, setSynthesisState] = useState<
    Record<string, SynthesisState>
  >({});

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
    setModalRunId(runId);
    setModalKind('bundle');
    setModalContent(null);
    setModalLoading(true);
    try {
      const res = await getArchitectRun(runId);
      setModalContent(JSON.stringify(res.bundle, null, 2));
    } catch (err) {
      setModalContent(
        `Failed to load bundle: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setModalLoading(false);
    }
  }, []);

  const openAnalysis = useCallback(
    (runId: string, analyses: ArchitectAnalysisRow[]) => {
      // Reuse the bundle modal component — swap the data source to the
      // parsed analysis_json for each section, pretty-printed.
      setModalRunId(runId);
      setModalKind('analysis');
      setModalContent(
        JSON.stringify(
          analyses.map((a) => ({
            section: a.section,
            status: a.status,
            model: a.model,
            duration_ms: a.duration_ms,
            cost_usd: a.cost_usd,
            analysis: a.analysis,
          })),
          null,
          2,
        ),
      );
      setModalLoading(false);
    },
    [],
  );

  const openSynthesis = useCallback((runId: string, reportMd: string) => {
    setModalRunId(runId);
    setModalKind('synthesis');
    setModalContent(reportMd);
    setModalLoading(false);
  }, []);

  const closeBundle = useCallback(() => {
    setModalRunId(null);
    setModalContent(null);
  }, []);

  const handleStartAnalysis = useCallback(async (runId: string) => {
    setAnalysisState((prev) => ({ ...prev, [runId]: { kind: 'starting' } }));
    try {
      await startArchitectAnalysis(runId);
      setAnalysisState((prev) => ({ ...prev, [runId]: { kind: 'polling' } }));
    } catch (err) {
      if (isAnalysisInProgressError(err)) {
        // Already running — just start polling.
        setAnalysisState((prev) => ({
          ...prev,
          [runId]: { kind: 'polling' },
        }));
        return;
      }
      setAnalysisState((prev) => ({
        ...prev,
        [runId]: {
          kind: 'error',
          message:
            err instanceof Error ? err.message : 'Failed to start analysis',
        },
      }));
    }
  }, []);

  // Derive a stable key for the set of runs currently being polled for
  // analysis, so the polling effect only re-runs when that set changes.
  const pollingKey = useMemo(
    () =>
      Object.entries(analysisState)
        .filter(([, s]) => s.kind === 'polling')
        .map(([runId]) => runId)
        .sort()
        .join(','),
    [analysisState],
  );

  // Poll every 5s while any analysis is in flight. When all three
  // sections for a run come back complete, flip that run to 'ready'.
  useEffect(() => {
    if (!pollingKey) return;
    const ids = pollingKey.split(',');
    const poll = async () => {
      for (const runId of ids) {
        try {
          const res = await getArchitectAnalyses(runId);
          const allComplete =
            res.analyses.length >= ANALYSIS_SECTIONS_REQUIRED &&
            res.analyses.every((a) => a.status === 'complete');
          const anyFailed = res.analyses.some((a) => a.status === 'failed');
          if (allComplete) {
            setAnalysisState((prev) =>
              prev[runId]?.kind === 'polling'
                ? {
                    ...prev,
                    [runId]: { kind: 'ready', analyses: res.analyses },
                  }
                : prev,
            );
          } else if (anyFailed) {
            const failed = res.analyses.find((a) => a.status === 'failed');
            setAnalysisState((prev) =>
              prev[runId]?.kind === 'polling'
                ? {
                    ...prev,
                    [runId]: {
                      kind: 'error',
                      message:
                        failed?.error_message ?? 'Analysis section failed',
                    },
                  }
                : prev,
            );
          }
          // else still pending/analyzing — keep polling
        } catch (err) {
          setAnalysisState((prev) =>
            prev[runId]?.kind === 'polling'
              ? {
                  ...prev,
                  [runId]: {
                    kind: 'error',
                    message:
                      err instanceof Error
                        ? err.message
                        : 'Failed to load analyses',
                  },
                }
              : prev,
          );
        }
      }
    };
    const id = setInterval(() => {
      void poll();
    }, POLL_ANALYSIS_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pollingKey]);

  const handleStartSynthesis = useCallback(async (runId: string) => {
    setSynthesisState((prev) => ({ ...prev, [runId]: { kind: 'starting' } }));
    try {
      await startArchitectSynthesis(runId);
      setSynthesisState((prev) => ({
        ...prev,
        [runId]: { kind: 'polling' },
      }));
    } catch (err) {
      if (isSynthesisInProgressError(err)) {
        // Already running — just start polling.
        setSynthesisState((prev) => ({
          ...prev,
          [runId]: { kind: 'polling' },
        }));
        return;
      }
      setSynthesisState((prev) => ({
        ...prev,
        [runId]: {
          kind: 'error',
          message:
            err instanceof Error ? err.message : 'Failed to start synthesis',
        },
      }));
    }
  }, []);

  // Derive a stable key for the set of runs currently being polled for
  // synthesis, so the polling effect only re-runs when that set changes.
  const synthesisPollingKey = useMemo(
    () =>
      Object.entries(synthesisState)
        .filter(([, s]) => s.kind === 'polling')
        .map(([runId]) => runId)
        .sort()
        .join(','),
    [synthesisState],
  );

  // Poll every 5s while any synthesis is in flight. When a run's
  // synthesis row returns status='complete' flip that run to 'ready'.
  useEffect(() => {
    if (!synthesisPollingKey) return;
    const ids = synthesisPollingKey.split(',');
    const poll = async () => {
      for (const runId of ids) {
        try {
          const row = await getArchitectSynthesis(runId);
          if (row.status === 'complete') {
            setSynthesisState((prev) =>
              prev[runId]?.kind === 'polling'
                ? {
                    ...prev,
                    [runId]: {
                      kind: 'ready',
                      reportMd: row.report_md ?? '',
                    },
                  }
                : prev,
            );
          } else if (row.status === 'failed') {
            setSynthesisState((prev) =>
              prev[runId]?.kind === 'polling'
                ? {
                    ...prev,
                    [runId]: {
                      kind: 'error',
                      message: row.error_message ?? 'Synthesis failed',
                    },
                  }
                : prev,
            );
          }
          // else still pending/synthesizing — keep polling
        } catch (err) {
          setSynthesisState((prev) =>
            prev[runId]?.kind === 'polling'
              ? {
                  ...prev,
                  [runId]: {
                    kind: 'error',
                    message:
                      err instanceof Error
                        ? err.message
                        : 'Failed to load synthesis',
                  },
                }
              : prev,
          );
        }
      }
    };
    const id = setInterval(() => {
      void poll();
    }, POLL_SYNTHESIS_INTERVAL_MS);
    return () => clearInterval(id);
  }, [synthesisPollingKey]);

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
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => void openBundle(run.run_id)}
                            className="font-mono text-[11px] underline-offset-2 hover:underline"
                            style={{ color: 'var(--amber)' }}
                          >
                            view
                          </button>
                          {(() => {
                            const state = analysisState[run.run_id];
                            if (!state) {
                              return (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    void handleStartAnalysis(run.run_id)
                                  }
                                >
                                  Analyze
                                </Button>
                              );
                            }
                            if (state.kind === 'starting') {
                              return (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  loading
                                  disabled
                                >
                                  Analyze
                                </Button>
                              );
                            }
                            if (state.kind === 'polling') {
                              return (
                                <span
                                  className="font-mono text-[11px]"
                                  style={{ color: 'var(--amber)' }}
                                >
                                  Analysis started…
                                </span>
                              );
                            }
                            if (state.kind === 'ready') {
                              const synth = synthesisState[run.run_id];
                              return (
                                <>
                                  <button
                                    onClick={() =>
                                      openAnalysis(run.run_id, state.analyses)
                                    }
                                    className="font-mono text-[11px] underline-offset-2 hover:underline"
                                    style={{ color: 'var(--green)' }}
                                  >
                                    View Analysis
                                  </button>
                                  {(() => {
                                    if (!synth) {
                                      return (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            void handleStartSynthesis(
                                              run.run_id,
                                            )
                                          }
                                        >
                                          Synthesize
                                        </Button>
                                      );
                                    }
                                    if (synth.kind === 'starting') {
                                      return (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          loading
                                          disabled
                                        >
                                          Synthesize
                                        </Button>
                                      );
                                    }
                                    if (synth.kind === 'polling') {
                                      return (
                                        <span
                                          className="font-mono text-[11px]"
                                          style={{ color: 'var(--amber)' }}
                                        >
                                          Synthesizing…
                                        </span>
                                      );
                                    }
                                    if (synth.kind === 'ready') {
                                      return (
                                        <button
                                          onClick={() =>
                                            openSynthesis(
                                              run.run_id,
                                              synth.reportMd,
                                            )
                                          }
                                          className="font-mono text-[11px] underline-offset-2 hover:underline"
                                          style={{ color: 'var(--green)' }}
                                        >
                                          View Report
                                        </button>
                                      );
                                    }
                                    // error
                                    return (
                                      <span
                                        className="font-mono text-[11px]"
                                        style={{ color: 'var(--sev-critical)' }}
                                        title={synth.message}
                                      >
                                        {synth.message.length > 40
                                          ? `${synth.message.slice(0, 40)}…`
                                          : synth.message}
                                      </span>
                                    );
                                  })()}
                                </>
                              );
                            }
                            // error
                            return (
                              <span
                                className="font-mono text-[11px]"
                                style={{ color: 'var(--sev-critical)' }}
                                title={state.message}
                              >
                                {state.message.length > 40
                                  ? `${state.message.slice(0, 40)}…`
                                  : state.message}
                              </span>
                            );
                          })()}
                        </div>
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

      {/* Bundle / Analysis viewer modal — portaled to <body> so it escapes
          any parent stacking context and covers the full viewport
          including the TopBar. Reused verbatim for both data sources. */}
      {modalRunId &&
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
                    {modalKind === 'analysis'
                      ? 'Analysis'
                      : modalKind === 'synthesis'
                        ? 'Report'
                        : 'Bundle'}{' '}
                    · {modalRunId.slice(0, 8)}…
                  </div>
                  <Button variant="ghost" size="sm" onClick={closeBundle}>
                    Close
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {modalLoading ? (
                    <div
                      className="p-8 text-center font-mono text-[11px]"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      Loading{' '}
                      {modalKind === 'analysis'
                        ? 'analysis'
                        : modalKind === 'synthesis'
                          ? 'report'
                          : 'bundle'}
                      …
                    </div>
                  ) : (
                    <pre
                      className="whitespace-pre-wrap break-all p-5 font-mono text-[11px]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {modalContent ??
                        (modalKind === 'analysis'
                          ? 'Analysis unavailable'
                          : modalKind === 'synthesis'
                            ? 'Report unavailable'
                            : 'Bundle unavailable')}
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
