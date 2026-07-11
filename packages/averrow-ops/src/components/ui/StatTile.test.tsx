import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('renders label and value', () => {
    render(<StatTile label="Active Threats" value={42} accent="#C83C3C" />);
    expect(screen.getByText('Active Threats')).toBeInTheDocument();
  });

  it('calls onClick on mouse click', async () => {
    const onClick = vi.fn();
    render(<StatTile label="Threats" value={1} accent="#C83C3C" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is keyboard-focusable and marked as a button when onClick is provided', () => {
    const onClick = vi.fn();
    render(<StatTile label="Threats" value={1} accent="#C83C3C" onClick={onClick} />);
    const tile = screen.getByRole('button');
    expect(tile).toHaveAttribute('tabIndex', '0');
  });

  it('calls onClick on Enter keydown', () => {
    const onClick = vi.fn();
    render(<StatTile label="Threats" value={1} accent="#C83C3C" onClick={onClick} />);
    const tile = screen.getByRole('button');
    fireEvent.keyDown(tile, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('calls onClick on Space keydown and prevents the default (page scroll)', () => {
    const onClick = vi.fn();
    render(<StatTile label="Threats" value={1} accent="#C83C3C" onClick={onClick} />);
    const tile = screen.getByRole('button');
    const event = fireEvent.keyDown(tile, { key: ' ' });
    // testing-library's fireEvent returns `false` when the event's
    // default was prevented (mirrors dispatchEvent's return value).
    expect(event).toBe(false);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick for a non-activating key', () => {
    const onClick = vi.fn();
    render(<StatTile label="Threats" value={1} accent="#C83C3C" onClick={onClick} />);
    const tile = screen.getByRole('button');
    fireEvent.keyDown(tile, { key: 'Escape' });
    fireEvent.keyDown(tile, { key: 'a' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('has no button role or tabIndex when onClick is not provided', () => {
    render(<StatTile label="Threats" value={1} accent="#C83C3C" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // Walk up to the outer tile element (label div -> marginTop wrapper -> tile).
    const tile = screen.getByText('Threats').parentElement!.parentElement!;
    expect(tile).not.toHaveAttribute('tabindex');
    expect(tile).not.toHaveAttribute('role');
  });

  it('does not throw on keydown when onClick is not provided', () => {
    render(<StatTile label="Threats" value={1} accent="#C83C3C" />);
    const tile = screen.getByText('Threats').parentElement!.parentElement!;
    expect(() => fireEvent.keyDown(tile, { key: 'Enter' })).not.toThrow();
  });
});
