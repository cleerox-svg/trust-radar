import { useState } from "react";

const PLATFORMS = [
  {
    key: "trust-radar",
    name: "Trust Radar",
    description: "Threat intelligence & URL trust scoring",
    color: "#22D3EE",
    url: "/",
    active: true,
  },
  {
    key: "imprsn8",
    name: "imprsn8",
    description: "Brand impersonation detection & protection",
    color: "#EAB308",
    url: "https://imprsn8.com",
    active: false,
  },
];

export function PlatformSwitcher() {
  const [open, setOpen] = useState(false);
  const current = PLATFORMS.find((p) => p.active) ?? PLATFORMS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[--border-subtle] hover:border-[--border-default] transition-colors text-xs"
      >
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: current.color }} />
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>{current.name}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="var(--text-tertiary)" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg shadow-xl overflow-hidden"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }}
          >
            <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-subtle)" }}>
              LRX Platforms
            </div>
            {PLATFORMS.map((p) => (
              <a
                key={p.key}
                href={p.url}
                onClick={(e) => {
                  if (p.active) {
                    e.preventDefault();
                    setOpen(false);
                  }
                }}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-[--surface-base] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${p.color}20`, border: `1px solid ${p.color}40` }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                    {p.active && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-mono">current</span>
                    )}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{p.description}</div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
