import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>CRITICAL</Badge>);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('applies variant classes for critical', () => {
    const { container } = render(<Badge variant="critical">HIGH</Badge>);
    expect(container.firstChild).toHaveClass('text-accent');
  });

  it('applies default variant when none specified', () => {
    const { container } = render(<Badge>DEFAULT</Badge>);
    expect(container.firstChild).toHaveClass('bg-white/5');
  });

  it('accepts custom className', () => {
    const { container } = render(<Badge className="custom-class">TEST</Badge>);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders all variant types without error', () => {
    const variants = ['critical', 'high', 'medium', 'low', 'success', 'info', 'default'] as const;
    variants.forEach(variant => {
      const { unmount } = render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toBeInTheDocument();
      unmount();
    });
  });

  it('applies base styling classes', () => {
    const { container } = render(<Badge>TEST</Badge>);
    expect(container.firstChild).toHaveClass('font-mono');
    expect(container.firstChild).toHaveClass('uppercase');
    expect(container.firstChild).toHaveClass('rounded');
    expect(container.firstChild).toHaveClass('border');
  });
});
