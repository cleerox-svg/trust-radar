import { useEffect, useRef } from 'react';

interface DropdownProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  className?: string;
}

export function Dropdown({ open, onClose, children, width = 380, className = '' }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent && e.key === 'Escape') {
        onClose();
      } else if (
        e instanceof MouseEvent &&
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handle);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={`absolute top-full right-0 mt-2 glass-card glass-card-teal rounded-xl overflow-hidden animate-fade-in ${className}`}
      style={{ width, zIndex: 'var(--z-dropdown)' }}
    >
      {children}
    </div>
  );
}
