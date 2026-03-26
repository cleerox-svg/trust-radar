import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { createMockAgent } from '@/test/mocks';
import { AdminDashboard } from './AdminDashboard';

const mockAgents = [
  createMockAgent(),
  createMockAgent({ agent_id: 'sparrow', name: 'sparrow', display_name: 'Sparrow', color: '#E87040' }),
];

vi.mock('@/hooks/useAgents', () => ({
  useDashboardStats: vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
  }),
  useAgents: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  usePipelineStatus: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
}));

// Mock the AgentIcon component since it may have SVG dependencies
vi.mock('@/components/brand/AgentIcon', () => ({
  AgentIcon: ({ agent }: { agent: string }) => <span data-testid={`agent-icon-${agent}`} />,
}));

// Mock ActivitySparkline since it's a chart component
vi.mock('@/components/ui/ActivitySparkline', () => ({
  ActivitySparkline: () => <div data-testid="sparkline" />,
}));

import { useDashboardStats, useAgents, usePipelineStatus } from '@/hooks/useAgents';

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDashboardStats as any).mockReturnValue({
      data: {
        total_brands: 9333,
        monitored_brands: 500,
        active_threats: 20374,
        total_threats: 50000,
        threats_24h: 150,
        agents_operational: 7,
        agents_total: 7,
        feeds_healthy: 45,
        feeds_total: 45,
        takedowns_pending: 12,
        total_users: 0,
        total_orgs: 0,
        leads_new: 0,
        spam_captures_24h: 0,
      },
      isLoading: false,
    });
    (useAgents as any).mockReturnValue({
      data: mockAgents,
      isLoading: false,
    });
    (usePipelineStatus as any).mockReturnValue({
      data: [
        { name: 'Threat Ingest', pending: 3, status: 'healthy', schedule: '30m' },
      ],
      isLoading: false,
    });
  });

  it('renders dashboard stats', () => {
    renderWithProviders(<AdminDashboard />);
    expect(screen.getByText('9333')).toBeInTheDocument();
    expect(screen.getByText('20374')).toBeInTheDocument();
  });

  it('renders agent cards', () => {
    renderWithProviders(<AdminDashboard />);
    expect(screen.getByText('Sentinel')).toBeInTheDocument();
    expect(screen.getByText('Sparrow')).toBeInTheDocument();
  });

  it('renders section labels', () => {
    renderWithProviders(<AdminDashboard />);
    expect(screen.getByText('System Overview')).toBeInTheDocument();
    expect(screen.getByText('Agent Health')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Automation')).toBeInTheDocument();
  });

  it('shows stat card labels', () => {
    renderWithProviders(<AdminDashboard />);
    expect(screen.getByText('Total Brands')).toBeInTheDocument();
    expect(screen.getByText('Active Threats')).toBeInTheDocument();
    expect(screen.getByText('Agents Operational')).toBeInTheDocument();
  });

  it('shows agent job counts', () => {
    renderWithProviders(<AdminDashboard />);
    // Both agents have 20 jobs
    const jobCounts = screen.getAllByText('20');
    expect(jobCounts.length).toBeGreaterThanOrEqual(2);
  });

  it('shows pipeline status', () => {
    renderWithProviders(<AdminDashboard />);
    expect(screen.getByText('Threat Ingest')).toBeInTheDocument();
    expect(screen.getByText('3 pending')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    (useDashboardStats as any).mockReturnValue({ data: null, isLoading: true });
    (useAgents as any).mockReturnValue({ data: null, isLoading: true });
    const { container } = renderWithProviders(<AdminDashboard />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows empty state when no agent data', () => {
    (useAgents as any).mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<AdminDashboard />);
    expect(screen.getByText('No agent data available')).toBeInTheDocument();
  });

  it('shows empty state when no dashboard data', () => {
    (useDashboardStats as any).mockReturnValue({ data: null, isLoading: false });
    renderWithProviders(<AdminDashboard />);
    expect(screen.getByText('No dashboard data available')).toBeInTheDocument();
  });
});
