import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

// ─── Context ────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ─── Icons + colors per variant ────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, { icon: typeof CheckCircle; bg: string; border: string; color: string }> = {
  success: { icon: CheckCircle,    bg: "rgba(22,163,74,0.08)",  border: "rgba(22,163,74,0.3)",  color: "#16A34A" },
  error:   { icon: XCircle,        bg: "rgba(220,38,38,0.08)",  border: "rgba(220,38,38,0.3)",  color: "#DC2626" },
  warning: { icon: AlertTriangle,  bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", color: "#F59E0B" },
  info:    { icon: Info,           bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.3)", color: "#3B82F6" },
};

// ─── Single toast item ─────────────────────────────────────────────

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const cfg = VARIANT_CONFIG[t.variant];
  const Icon = cfg.icon;

  useEffect(() => {
    const dur = t.duration ?? 4000;
    const fadeTimer = setTimeout(() => setExiting(true), dur - 300);
    const removeTimer = setTimeout(() => onDismiss(t.id), dur);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, [t.id, t.duration, onDismiss]);

  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg shadow-lg max-w-sm pointer-events-auto"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        backdropFilter: "blur(12px)",
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateX(20px)" : "translateX(0)",
        transition: "opacity 0.3s, transform 0.3s",
      }}
    >
      <Icon size={16} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{t.title}</div>
        {t.description && (
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{t.description}</div>
        )}
      </div>
      <button
        onClick={() => onDismiss(t.id)}
        className="p-0.5 rounded hover:bg-white/10 transition-colors"
        style={{ color: "var(--text-tertiary)" }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─── Provider ───────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((opts: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }]); // max 5
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    success: (title, description) => addToast({ variant: "success", title, description }),
    error: (title, description) => addToast({ variant: "error", title, description }),
    warning: (title, description) => addToast({ variant: "warning", title, description }),
    info: (title, description) => addToast({ variant: "info", title, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div
        className="fixed bottom-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        style={{ maxHeight: "50vh" }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
