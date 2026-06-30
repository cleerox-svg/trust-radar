// v4 command palette (⌘K). Hand-rolled, no new dependency.
//
// Opens on ⌘K / Ctrl-K, on clicking the topbar search box, or the mobile
// search icon. Filters a flat list of navigation destinations (every v4 nav
// item plus the consolidated tab targets + entity pages that don't surface as
// their own menu row) and jumps there via react-router. Fully keyboard
// driven: ↑/↓ to move, Enter to go, Esc to close.
//
// The command list is supplied by ShellV4 so it inherits the same role-gating
// the sidebar applies — nothing here re-derives permissions.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PaletteCommand {
  label: string;
  to: string;
  /** Group heading shown in the list (e.g. "SOC Console"). */
  group: string;
  icon?: LucideIcon;
  /** Extra search terms that should match this command but aren't in the label. */
  keywords?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}

function scoreMatch(cmd: PaletteCommand, q: string): boolean {
  if (!q) return true;
  const haystack = `${cmd.label} ${cmd.group} ${cmd.keywords ?? ''} ${cmd.to}`.toLowerCase();
  // every whitespace-separated token must appear somewhere
  return q.split(/\s+/).filter(Boolean).every(tok => haystack.includes(tok));
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // reset state each time the palette opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // focus after the element is painted
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const results = useMemo(
    () => commands.filter(c => scoreMatch(c, query.trim().toLowerCase())),
    [commands, query],
  );

  // keep the active index in range as the result set shrinks
  useEffect(() => { setActive(0); }, [query]);

  // scroll the active row into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  if (!open) return null;

  const go = (cmd: PaletteCommand | undefined) => {
    if (!cmd) return;
    onClose();
    navigate(cmd.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // group consecutive results under their group heading
  let lastGroup: string | null = null;

  return (
    <div className="cmdk-overlay" onMouseDown={onClose} role="presentation">
      <div
        className="cmdk-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="cmdk-search">
          <Search size={16} strokeWidth={2} />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search pages — threats, brands, actors, agents…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="cmdk-esc">ESC</kbd>
        </div>

        <div className="cmdk-list" ref={listRef}>
          {results.length === 0 && (
            <div className="cmdk-empty">No matches for “{query}”.</div>
          )}
          {results.map((cmd, i) => {
            const Icon = cmd.icon;
            const showHeading = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            return (
              <div key={cmd.to + cmd.label}>
                {showHeading && <div className="cmdk-group">{cmd.group}</div>}
                <button
                  type="button"
                  data-idx={i}
                  className={'cmdk-item' + (i === active ? ' active' : '')}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(cmd)}
                >
                  {Icon && <Icon size={16} strokeWidth={2} className="cmdk-item-icon" />}
                  <span className="cmdk-item-label">{cmd.label}</span>
                  {i === active && <CornerDownLeft size={13} strokeWidth={2} className="cmdk-item-enter" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
