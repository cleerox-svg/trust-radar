import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../App";

const PLATFORMS = [
  {
    key: "trust-radar",
    name: "Trust Radar",
    description: "Threat intelligence & URL trust scoring",
    color: "#22D3EE",
    baseUrl: "/",
    adminUrl: "/admin",
    active: true,
  },
  {
    key: "imprsn8",
    name: "imprsn8",
    description: "Brand impersonation detection & protection",
    color: "#EAB308",
    baseUrl: "https://imprsn8.com",
    adminUrl: "https://imprsn8.com/admin",
    active: false,
  },
];

export function PlatformSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = location.pathname.startsWith("/admin");
  const current = PLATFORMS.find((p) => p.active) ?? PLATFORMS[0];

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
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[--border-subtle] hover:border-[--border-default] transition-colors text-xs"
      >
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: current.color }} />
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>{current.name}</span>
        <ChevronDown
          size={10}
          style={{ color: "var(--text-tertiary)", transform: open ? "rotate(180deg)" : "", transition: "transform 0.15s" }}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-50 w-60 rounded-lg shadow-xl overflow-hidden"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }}
          >
            <div
              className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-subtle)" }}
            >
              LRX Platforms
            </div>
            {PLATFORMS.map((p) => {
              const href = p.active ? undefined : isAdmin ? p.adminUrl : p.baseUrl;
              return (
                <a
                  key={p.key}
                  href={href}
                  onClick={(e) => {
                    if (p.active) { e.preventDefault(); setOpen(false); }
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-[--surface-base] transition-colors no-underline"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${p.color}20`, border: `1px solid ${p.color}40` }}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                      {p.active && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-mono">current</span>
                      )}
                      {!p.active && isAdmin && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                          style={{ background: `${p.color}15`, color: p.color }}
                        >
                          admin
                        </span>
                      )}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{p.description}</div>
                  </div>
                </a>
              );
            })}
            {user?.is_admin && !isAdmin && (
              <>
                <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
                <button
                  onClick={() => { navigate("/admin"); setOpen(false); }}
                  className="flex items-center gap-3 px-3 py-2.5 w-full text-left hover:bg-[--surface-base] transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)" }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} style={{ color: "#ef4444" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Admin Console</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}>ADM</span>
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Users, feeds, platform settings</div>
                  </div>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
