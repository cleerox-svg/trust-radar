import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders message', () => {
    render(<EmptyState message="No data available" />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState message="Empty" description="Try adjusting filters" />);
    expect(screen.getByText('Try adjusting filters')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<EmptyState message="Empty" />);
    expect(screen.queryByText('Try adjusting filters')).not.toBeInTheDocument();
  });

  it('renders action button when provided', async () => {
    const onClick = vi.fn();
    render(<EmptyState message="Empty" action={{ label: 'Retry', onClick }} />);
    const btn = screen.getByText('Retry');
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not render action button when not provided', () => {
    render(<EmptyState message="Empty" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders centered layout', () => {
    const { container } = render(<EmptyState message="Empty" />);
    expect(container.firstChild).toHaveClass('flex');
    expect(container.firstChild).toHaveClass('items-center');
    expect(container.firstChild).toHaveClass('justify-center');
  });
});
