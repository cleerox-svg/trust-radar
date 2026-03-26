import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Active Threats" value={1234} />);
    expect(screen.getByText('Active Threats')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('renders string values', () => {
    render(<StatCard label="Grade" value="A+" />);
    expect(screen.getByText('A+')).toBeInTheDocument();
  });

  it('renders sublabel when provided', () => {
    render(<StatCard label="Threats" value={100} sublabel="+5 today" />);
    expect(screen.getByText('+5 today')).toBeInTheDocument();
  });

  it('does not render sublabel when not provided', () => {
    render(<StatCard label="Test" value={0} />);
    expect(screen.queryByText('+5 today')).not.toBeInTheDocument();
  });

  it('renders trend with up direction', () => {
    render(<StatCard label="Score" value={85} trend="+12%" trendDirection="up" />);
    const trendEl = screen.getByText('+12%');
    expect(trendEl).toBeInTheDocument();
    expect(trendEl).toHaveClass('text-positive');
  });

  it('renders trend with down direction', () => {
    render(<StatCard label="Score" value={85} trend="-8%" trendDirection="down" />);
    const trendEl = screen.getByText('-8%');
    expect(trendEl).toHaveClass('text-accent');
  });

  it('renders trend with neutral direction', () => {
    render(<StatCard label="Score" value={85} trend="0%" trendDirection="neutral" />);
    const trendEl = screen.getByText('0%');
    expect(trendEl).toHaveClass('text-contrail/40');
  });

  it('applies accent color border', () => {
    const { container } = render(<StatCard label="Test" value={0} accentColor="#C83C3C" />);
    expect(container.firstChild).toHaveStyle({ borderLeftColor: '#C83C3C' });
    expect(container.firstChild).toHaveClass('border-l-[3px]');
  });

  it('does not apply border-left style without accentColor', () => {
    const { container } = render(<StatCard label="Test" value={0} />);
    expect(container.firstChild).not.toHaveClass('border-l-[3px]');
  });
});
