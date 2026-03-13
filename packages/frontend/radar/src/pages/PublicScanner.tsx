import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { WordMark } from "../components/LogoMark";

const BASE = "/api";

interface PublicScanResult {
  domain: string;
  trust_score: number;
  risk_level: string;
  flags: Array<{ type: string; severity: string; detail: string }>;
  metadata: {
    ssl_valid?: boolean;
    country?: string;
    registrar?: string;
    registered_at?: string;
  };
}

const riskColors: Record<string, string> = {
  safe: "#22C55E",
  low: "#22D3EE",
  medium: "#EAB308",
  high: "#F97316",
  critical: "#EF4444",
};

export default function PublicScanner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicScanResult | null>(null);
  const [error, setError] = useState("");

  async function handleScan(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${BASE}/scan/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Scan failed");
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  const riskColor = result ? riskColors[result.risk_level] ?? "var(--text-tertiary)" : "";

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-base)", color: "var(--text-primary)" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <Link to="/">
          <WordMark size={26} textSize="text-base" />
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-[--text-secondary] hover:text-[--text-primary] transition-colors">
            Sign In
          </Link>
          <Link
            to="/register"
            className="text-sm font-semibold px-4 py-2 rounded-lg"
            style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-16 px-6">
        {/* Hero */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-6"
            style={{ background: "rgba(34, 211, 238, 0.1)", border: "1px solid rgba(34, 211, 238, 0.2)", color: "var(--cyan-400)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Free URL scanner — no login required
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3">
            Check any URL for <span style={{ color: "var(--cyan-400)" }}>threats</span>
          </h1>
          <p className="text-base" style={{ color: "var(--text-secondary)" }}>
            Instant trust score, risk flags, SSL verification, and WHOIS data.
          </p>
        </div>

        {/* Scanner form */}
        <form onSubmit={handleScan} className="flex gap-3 mb-8">
          <input
            className="flex-1 text-sm px-4 py-3 rounded-lg font-mono focus:outline-none"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-6 py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
          >
            {loading ? "Scanning..." : "Scan"}
          </button>
        </form>

        {error && (
          <div className="text-sm text-center mb-6 px-4 py-3 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-6 animate-fade-in">
            {/* Score + domain header */}
            <div
              className="rounded-xl p-6 flex items-center gap-6"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
            >
              <div className="relative w-20 h-20 shrink-0">
                <svg width={80} height={80} viewBox="0 0 80 80" className="-rotate-90">
                  <circle cx={40} cy={40} r={35} fill="none" stroke="var(--border-subtle)" strokeWidth={3} />
                  <circle
                    cx={40} cy={40} r={35} fill="none" stroke={riskColor} strokeWidth={3}
                    strokeDasharray={220} strokeDashoffset={220 - (result.trust_score / 100) * 220}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.34, 1.1, 0.64, 1)" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-mono font-bold text-xl" style={{ color: riskColor }}>{result.trust_score}</span>
                </div>
              </div>
              <div>
                <div className="font-mono text-lg font-bold">{result.domain}</div>
                <span
                  className="inline-block text-xs font-bold uppercase px-2 py-0.5 rounded mt-1"
                  style={{ background: `${riskColor}20`, color: riskColor }}
                >
                  {result.risk_level} risk
                </span>
              </div>
            </div>

            {/* Flags */}
            {result.flags.length > 0 && (
              <div className="rounded-xl p-5" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}>
                <h3 className="text-sm font-semibold mb-3">Risk Flags</h3>
                <div className="space-y-2">
                  {result.flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--surface-base)" }}>
                      <span
                        className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: `${riskColors[f.severity] ?? "#888"}20`, color: riskColors[f.severity] ?? "#888" }}
                      >
                        {f.severity}
                      </span>
                      <div>
                        <div className="text-sm font-medium">{f.type.replace(/_/g, " ")}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{f.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="rounded-xl p-5" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}>
              <h3 className="text-sm font-semibold mb-3">Domain Info</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: "SSL", value: result.metadata.ssl_valid === undefined ? "—" : result.metadata.ssl_valid ? "Valid" : "Invalid" },
                  { label: "Country", value: result.metadata.country ?? "—" },
                  { label: "Registrar", value: result.metadata.registrar ?? "—" },
                  { label: "Registered", value: result.metadata.registered_at ? new Date(result.metadata.registered_at).toLocaleDateString() : "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{label}</div>
                    <div className="font-mono truncate">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="text-center py-4">
              <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                Want AI analysis, VirusTotal results, and scan history?
              </p>
              <Link
                to="/register"
                className="inline-block px-6 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
              >
                Create Free Account
              </Link>
            </div>
          </div>
        )}

        {/* Empty state features */}
        {!result && !loading && (
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[
              { title: "SSL Check", desc: "Verify certificate validity" },
              { title: "WHOIS Data", desc: "Domain age & registrar" },
              { title: "Risk Scoring", desc: "Multi-engine analysis" },
            ].map(({ title, desc }) => (
              <div
                key={title}
                className="rounded-xl p-4 text-center"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="text-sm font-semibold mb-1">{title}</div>
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
