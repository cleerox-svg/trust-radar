import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardBody } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies hover styles by default', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass('hover:-translate-y-0.5');
  });

  it('disables hover when hover=false', () => {
    const { container } = render(<Card hover={false}>Content</Card>);
    expect(container.firstChild).not.toHaveClass('hover:-translate-y-0.5');
  });

  it('applies base styling', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass('glass-card');
    expect(container.firstChild).toHaveClass('rounded-xl');
    expect(container.firstChild).toHaveClass('p-4');
  });

  it('accepts custom className', () => {
    const { container } = render(<Card className="cursor-pointer">Content</Card>);
    expect(container.firstChild).toHaveClass('cursor-pointer');
  });
});

describe('CardHeader', () => {
  it('renders with section label styling', () => {
    render(<CardHeader>Section Title</CardHeader>);
    const el = screen.getByText('Section Title');
    expect(el).toHaveClass('font-mono');
    expect(el).toHaveClass('text-accent');
    expect(el).toHaveClass('uppercase');
  });
});

describe('CardBody', () => {
  it('renders children', () => {
    render(<CardBody>Body content</CardBody>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(<CardBody className="space-y-4">Content</CardBody>);
    expect(container.firstChild).toHaveClass('space-y-4');
  });
});
