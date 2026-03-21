import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";

const platforms = [
  {
    id: "imprsn8",
    name: "imprsn8",
    description: "Identity protection",
    color: "#f0a500",
    baseUrl: null, // current
    adminUrl: null, // current
  },
  {
    id: "trust-radar",
    name: "Trust Radar",
    description: "URL threat intelligence",
    color: "#22d3ee",
    baseUrl: "https://trustradar.ca",
    adminUrl: "https://trustradar.ca/admin",
  },
];

export function PlatformSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-colors"
        style={{
          color: "var(--text-secondary)",
          background: open ? "var(--surface-overlay)" : "transparent",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-overlay)")}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: "#f0a500" }}
        />
        imprsn8
        <ChevronDown size={10} style={{ opacity: 0.5 }} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg shadow-2xl overflow-hidden"
          style={{
            background: "var(--surface-overlay)",
            border: "1px solid var(--border-default)",
            minWidth: 210,
          }}
        >
          <div
            className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-subtle)" }}
          >
            LRX Platforms
          </div>
          {platforms.map((p) => {
            const isCurrent = p.baseUrl === null;
            const href = isCurrent ? undefined : (isAdmin ? p.adminUrl : p.baseUrl);
            return (
              <a
                key={p.id}
                href={href ?? undefined}
                onClick={(e) => {
                  if (isCurrent) { e.preventDefault(); setOpen(false); }
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors no-underline"
                style={{
                  color: isCurrent ? p.color : "var(--text-secondary)",
                  background: isCurrent ? `${p.color}10` : "transparent",
                  cursor: isCurrent ? "default" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = "var(--surface-float)";
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: p.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{p.name}</span>
                    {!isCurrent && isAdmin && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                        style={{ background: `${p.color}20`, color: p.color }}
                      >
                        admin
                      </span>
                    )}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    {p.description}
                  </div>
                </div>
                {isCurrent && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${p.color}20`, color: p.color }}
                  >
                    Active
                  </span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
