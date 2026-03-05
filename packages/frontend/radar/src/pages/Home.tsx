import { useState, type FormEvent } from "react";
import { scans, type ScanResult } from "../lib/api";

const RISK_COLOR: Record<string, string> = {
  safe: "text-radar-green",
  low: "text-sky-400",
  medium: "text-radar-yellow",
  high: "text-orange-400",
  critical: "text-radar-red",
};

const RISK_BG: Record<string, string> = {
  safe: "bg-radar-green/10 border-radar-green/30",
  low: "bg-sky-400/10 border-sky-400/30",
  medium: "bg-radar-yellow/10 border-radar-yellow/30",
  high: "bg-orange-400/10 border-orange-400/30",
  critical: "bg-radar-red/10 border-radar-red/30",
};

function ScoreRing({ score, risk }: { score: number; risk: string }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#00ff88" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center w-40 h-40">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1a2744" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="text-center z-10">
        <div className="font-mono font-bold text-4xl" style={{ color }}>{score}</div>
        <div className="text-xs text-radar-muted mt-0.5 uppercase tracking-widest">{risk}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");

  async function handleScan(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await scans.scan(url.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-radar-green/10 border border-radar-green/20 rounded-full px-4 py-1.5 text-radar-green text-sm font-mono mb-2">
          <span className="w-2 h-2 rounded-full bg-radar-green animate-pulse-slow" />
          Real-time threat intelligence
        </div>
        <h1 className="text-5xl font-bold tracking-tight">
          Is this URL <span className="text-radar-green">safe?</span>
        </h1>
        <p className="text-radar-muted text-lg max-w-xl mx-auto">
          Paste any link to instantly get a trust score, risk flags, SSL status, WHOIS data, and VirusTotal results.
        </p>
      </div>

      {/* Scanner */}
      <form onSubmit={handleScan} className="card space-y-4">
        <div className="flex gap-3">
          <input
            className="input font-mono text-sm"
            placeholder="https://example.com or domain.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary whitespace-nowrap" disabled={loading || !url.trim()}>
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Scanning…
              </span>
            ) : "Analyze"}
          </button>
        </div>
        {error && <p className="text-radar-red text-sm font-mono">{error}</p>}
      </form>

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease]">
          {/* Score header */}
          <div className={`card border ${RISK_BG[result.risk_level]} flex flex-col sm:flex-row items-center gap-6`}>
            <ScoreRing score={result.trust_score} risk={result.risk_level} />
            <div className="flex-1 space-y-1 text-center sm:text-left">
              <div className="font-mono text-sm text-radar-muted">Domain</div>
              <div className="font-mono text-xl font-bold text-slate-100">{result.domain}</div>
              <div className={`text-sm font-semibold uppercase tracking-widest ${RISK_COLOR[result.risk_level]}`}>
                {result.risk_level} risk
              </div>
              {result.cached && (
                <div className="text-xs text-radar-muted mt-2">Cached result · {new Date(result.created_at).toLocaleString()}</div>
              )}
            </div>
          </div>

          {/* Flags */}
          {result.flags.length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-slate-300 text-sm uppercase tracking-wider">Risk Flags</h3>
              {result.flags.map((f, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${RISK_BG[f.severity]}`}>
                  <span className={`text-xs font-mono font-bold uppercase mt-0.5 ${RISK_COLOR[f.severity]}`}>{f.severity}</span>
                  <div>
                    <div className="text-sm font-medium text-slate-200">{f.type.replace(/_/g, " ")}</div>
                    <div className="text-xs text-radar-muted mt-0.5">{f.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Metadata grid */}
          <div className="card grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "SSL Valid", value: result.metadata.ssl_valid === undefined ? "—" : result.metadata.ssl_valid ? "✓ Yes" : "✗ No" },
              { label: "Country", value: result.metadata.country ?? "—" },
              { label: "IP Address", value: result.metadata.ip ?? "—" },
              { label: "Registrar", value: result.metadata.registrar ?? "—" },
              { label: "Registered", value: result.metadata.registered_at ? new Date(result.metadata.registered_at).toLocaleDateString() : "—" },
              { label: "SSL Expiry", value: result.metadata.ssl_expiry ? new Date(result.metadata.ssl_expiry).toLocaleDateString() : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <div className="text-xs text-radar-muted uppercase tracking-wider">{label}</div>
                <div className="font-mono text-sm text-slate-200 truncate">{value}</div>
              </div>
            ))}
          </div>

          {/* VirusTotal */}
          {result.metadata.virustotal && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-slate-300 text-sm uppercase tracking-wider">VirusTotal</h3>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Malicious", value: result.metadata.virustotal.malicious, color: "text-radar-red" },
                  { label: "Suspicious", value: result.metadata.virustotal.suspicious, color: "text-radar-yellow" },
                  { label: "Harmless", value: result.metadata.virustotal.harmless, color: "text-radar-green" },
                  { label: "Undetected", value: result.metadata.virustotal.undetected, color: "text-radar-muted" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <div className={`font-mono font-bold text-2xl ${color}`}>{value}</div>
                    <div className="text-xs text-radar-muted mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: "🔒", title: "SSL Check", desc: "Certificate validity & expiry" },
            { icon: "🌍", title: "WHOIS Data", desc: "Domain age, registrar & country" },
            { icon: "🛡️", title: "VirusTotal", desc: "70+ antivirus engine scan" },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="card text-center space-y-2 hover:border-radar-green/50 transition-colors cursor-default">
              <div className="text-2xl">{icon}</div>
              <div className="text-sm font-semibold text-slate-300">{title}</div>
              <div className="text-xs text-radar-muted">{desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
