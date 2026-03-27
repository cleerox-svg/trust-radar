import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { createMockTakedown } from '@/test/mocks';
import { Takedowns } from './Takedowns';

const mockMutate = vi.fn();

vi.mock('@/hooks/useTakedowns', () => ({
  useAdminTakedowns: vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
  }),
  useTakedownEvidence: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useUpdateTakedown: vi.fn().mockReturnValue({
    mutate: vi.fn(),
  }),
}));

import { useAdminTakedowns, useUpdateTakedown } from '@/hooks/useTakedowns';

describe('Takedowns Page', () => {
  const mockTakedowns = [
    createMockTakedown({ status: 'draft' }),
    createMockTakedown({ id: 'td-002', status: 'submitted', target_value: 'evil.com', severity: 'CRITICAL' }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useAdminTakedowns as any).mockReturnValue({
      data: mockTakedowns,
      isLoading: false,
    });
    (useUpdateTakedown as any).mockReturnValue({
      mutate: mockMutate,
    });
  });

  it('renders takedown list', () => {
    renderWithProviders(<Takedowns />);
    expect(screen.getByText('phishing.test.com')).toBeInTheDocument();
    expect(screen.getByText('evil.com')).toBeInTheDocument();
  });

  it('shows status-appropriate action buttons for draft', () => {
    renderWithProviders(<Takedowns />);
    expect(screen.getByText('SUBMIT')).toBeInTheDocument();
    expect(screen.getByText('WITHDRAW')).toBeInTheDocument();
  });

  it('shows status-appropriate action buttons for submitted', () => {
    renderWithProviders(<Takedowns />);
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    // "TAKEN DOWN" appears as both a tab and a button, so use getAllByText
    const takenDownElements = screen.getAllByText('TAKEN DOWN');
    expect(takenDownElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders status tabs', () => {
    renderWithProviders(<Takedowns />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
  });

  it('shows target type badges', () => {
    renderWithProviders(<Takedowns />);
    const urlBadges = screen.getAllByText('url');
    expect(urlBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('shows provider name', () => {
    renderWithProviders(<Takedowns />);
    const providers = screen.getAllByText('via Cloudflare');
    expect(providers.length).toBeGreaterThanOrEqual(1);
  });

  it('shows SPARROW badge for auto-generated takedowns', () => {
    renderWithProviders(<Takedowns />);
    const sparrowBadges = screen.getAllByText('SPARROW');
    expect(sparrowBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading state when loading', () => {
    (useAdminTakedowns as any).mockReturnValue({
      data: null,
      isLoading: true,
    });
    const { container } = renderWithProviders(<Takedowns />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('expands takedown details on click', async () => {
    renderWithProviders(<Takedowns />);
    await userEvent.click(screen.getByText('phishing.test.com'));
    expect(screen.getByText('Malicious URL targeting Test Brand')).toBeInTheDocument();
  });
});
