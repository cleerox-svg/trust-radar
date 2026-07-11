import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { VerdictBand } from './VerdictBand';
import type { FeedFailureRow } from '@/hooks/useMetrics';
import type { PipelineEntry } from '@/hooks/useAgents';

vi.mock('@/hooks/useSystemHealth', () => ({ useSystemHealth: vi.fn() }));
vi.mock('@/hooks/useBudget', () => ({ useBudgetStatus: vi.fn() }));
vi.mock('@/hooks/useMetrics', () => ({ useFeedFailures: vi.fn() }));
vi.mock('@/hooks/useAgents', () => ({ usePipelineStatus: vi.fn() }));

import { useSystemHealth } from '@/hooks/useSystemHealth';
import { useBudgetStatus } from '@/hooks/useBudget';
import { useFeedFailures } from '@/hooks/useMetrics';
import { usePipelineStatus } from '@/hooks/useAgents';

interface HealthMock { data?: { agents: { total: number; successes: number; errors: number } }; isLoading?: boolean; isError?: boolean }
interface BudgetMock { data?: { throttle_level: string; pct_used: number }; isLoading?: boolean; isError?: boolean }
interface FeedsMock { data?: { per_feed: FeedFailureRow[] }; isLoading?: boolean; isError?: boolean }
interface PipelinesMock { data?: PipelineEntry[]; isLoading?: boolean; isError?: boolean }

const healthyHealth: HealthMock = {
  data: { agents: { total: 10, successes: 10, errors: 0 } },
  isLoading: false,
  isError: false,
};
const healthyBudget: BudgetMock = {
  data: { throttle_level: 'none', pct_used: 12 },
  isLoading: false,
  isError: false,
};
const healthyFeeds: FeedsMock = {
  data: { per_feed: [] },
  isLoading: false,
  isError: false,
};
const healthyPipelines: PipelinesMock = {
  data: [],
  isLoading: false,
  isError: false,
};

function mockAll(overrides: {
  health?: HealthMock;
  budget?: BudgetMock;
  feeds?: FeedsMock;
  pipelines?: PipelinesMock;
} = {}) {
  (useSystemHealth as ReturnType<typeof vi.fn>).mockReturnValue({ ...healthyHealth, ...overrides.health });
  (useBudgetStatus as ReturnType<typeof vi.fn>).mockReturnValue({ ...healthyBudget, ...overrides.budget });
  (useFeedFailures as ReturnType<typeof vi.fn>).mockReturnValue({ ...healthyFeeds, ...overrides.feeds });
  (usePipelineStatus as ReturnType<typeof vi.fn>).mockReturnValue({ ...healthyPipelines, ...overrides.pipelines });
}

describe('VerdictBand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows OPERATIONAL when every signal is resolved and healthy', () => {
    mockAll();
    renderWithProviders(<VerdictBand />);
    expect(screen.getByText('OPERATIONAL')).toBeInTheDocument();
  });

  it('never shows OPERATIONAL while a signal is still unresolved (unknown != ok)', () => {
    mockAll({ feeds: { data: undefined, isLoading: true } });
    renderWithProviders(<VerdictBand />);
    expect(screen.queryByText('OPERATIONAL')).not.toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('does not let an unresolved hook mask a genuine critical signal (worst-of, not last-write)', () => {
    mockAll({
      budget: { data: { throttle_level: 'emergency', pct_used: 97 } },
      feeds: { data: undefined, isLoading: true },
    });
    renderWithProviders(<VerdictBand />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.queryByText('PENDING')).not.toBeInTheDocument();
  });

  it('surfaces feed and agent problems together at the worst severity', () => {
    mockAll({
      health: { data: { agents: { total: 10, successes: 8, errors: 2 } } },
      feeds: {
        data: {
          per_feed: [
            { feed_name: 'a', display_name: 'A', enabled: true, paused_reason: null, pulls: 20, success: 5, failed: 15, partial: 0, failure_rate_pct: 75, records_ingested: 0, last_success_at: null, last_failure_at: null, consecutive_failures: 4, threshold: 5, pct_to_auto_pause: 80, verdict: { tone: 'failed', label: 'FAILED' } },
          ],
        },
      },
    });
    renderWithProviders(<VerdictBand />);
    // pct_to_auto_pause >= 80 is the 'critical' feed tier, which outranks
    // the agents 'high' signal, so the band reads CRITICAL overall.
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });
});
