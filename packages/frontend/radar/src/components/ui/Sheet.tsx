import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";

type SheetSide = "left" | "right";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  side?: SheetSide;
  children: React.ReactNode;
  className?: string;
  width?: string;
}

export function Sheet({ open, onClose, side = "right", children, className, width = "w-80" }: SheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const slideClass = side === "right"
    ? "right-0 animate-slide-in"
    : "left-0";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 modal-backdrop animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={cn(
          "absolute top-0 bottom-0 h-full overflow-y-auto p-6",
          width,
          slideClass,
          className
        )}
        style={{
          background: "var(--surface-overlay)",
          borderLeft: side === "right" ? "1px solid var(--border-default)" : undefined,
          borderRight: side === "left" ? "1px solid var(--border-default)" : undefined,
        }}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn-icon p-1.5"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-6 pr-8", className)} {...props}>
      {children}
    </div>
  );
}

export function SheetTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg font-semibold", className)} style={{ color: "var(--text-primary)" }} {...props}>
      {children}
    </h2>
  );
}
