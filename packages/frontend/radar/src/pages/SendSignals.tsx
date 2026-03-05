import { useState } from "react";
import { scans, ScanResult } from "../lib/api";

type Mode = "url-scan" | "manual";

function RiskBadge({ level }: { level: ScanResult["risk_level"] }) {
  const map: Record<string, string> = {
    safe:     "bg-radar-green/15 text-radar-green border-radar-green/30",
    low:      "bg-radar-blue/15 text-radar-blue border-radar-blue/30",
    medium:   "bg-radar-yellow/15 text-radar-yellow border-radar-yellow/30",
    high:     "bg-radar-orange/15 text-radar-orange border-radar-orange/30",
    critical: "bg-radar-red/15 text-radar-red border-radar-red/30",
  };
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${map[level]}`}>
      {level}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value?: string | boolean | null }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-radar-border/50 last:border-0">
      <span className="text-xs text-radar-muted w-32 shrink-0">{label}</span>
      <span className="text-xs font-mono text-radar-text break-all">
        {typeof value === "boolean" ? (value ? "✓ yes" : "✗ no") : value}
      </span>
    </div>
  );
}

export default function SendSignals() {
  const [mode, setMode] = useState<Mode>("url-scan");
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setScanning(true);
    setResult(null);
    setError(null);
    try {
      const r = await scans.scan(url.trim());
      setResult(r);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold text-radar-text">Send Signals</h1>
        <p className="text-xs text-radar-muted mt-0.5">Ingest new signals into the radar pipeline</p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1.5">
        {([
          { key: "url-scan", label: "URL Scan" },
          { key: "manual", label: "Manual Entry" },
        ] as { key: Mode; label: string }[]).map((m) => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setResult(null); setError(null); }}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
              mode === m.key
                ? "bg-radar-cyan/10 border-radar-cyan text-radar-cyan"
                : "border-radar-border text-radar-muted hover:text-radar-text"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* URL Scan mode */}
      {mode === "url-scan" && (
        <div className="card space-y-4">
          <div>
            <div className="text-sm font-semibold text-radar-text">URL Trust Analysis</div>
            <div className="text-xs text-radar-muted mt-0.5">
              Scan a URL to ingest its trust signal into the radar
            </div>
          </div>
          <form onSubmit={handleScan} className="flex gap-2">
            <input
              className="input flex-1"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={scanning}
            />
            <button className="btn-primary whitespace-nowrap" type="submit" disabled={scanning || !url.trim()}>
              {scanning ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Scanning…
                </span>
              ) : "Scan URL"}
            </button>
          </form>

          {error && (
            <div className="text-xs text-radar-red bg-radar-red/10 border border-radar-red/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-t border-radar-border pt-4 flex items-center gap-4">
                {/* Score ring */}
                <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#1a2744" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r="32" fill="none"
                      stroke={result.trust_score >= 80 ? "#00ff88" : result.trust_score >= 50 ? "#f59e0b" : "#ff4444"}
                      strokeWidth="6"
                      strokeDasharray={`${(result.trust_score / 100) * (2 * Math.PI * 32)} ${2 * Math.PI * 32}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-xl font-bold font-mono ${
                      result.trust_score >= 80 ? "text-radar-green" :
                      result.trust_score >= 50 ? "text-radar-yellow" : "text-radar-red"
                    }`}>{result.trust_score}</span>
                    <span className="text-[9px] text-radar-muted">/ 100</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-mono font-semibold text-radar-text">{result.domain}</div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={result.risk_level} />
                    {result.cached && (
                      <span className="text-[10px] text-radar-muted border border-radar-border rounded px-1.5 py-0.5 font-mono">
                        cached
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-radar-muted truncate max-w-xs">{result.url}</div>
                </div>
              </div>

              {/* Flags */}
              {result.flags.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-radar-text mb-2">Risk Flags</div>
                  <div className="space-y-1.5">
                    {result.flags.map((f, i) => (
                      <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
                        f.severity === "high" || f.severity === "critical"
                          ? "bg-radar-red/10 border border-radar-red/20"
                          : f.severity === "medium"
                          ? "bg-radar-yellow/10 border border-radar-yellow/20"
                          : "bg-radar-border/30 border border-radar-border"
                      }`}>
                        <span className={`font-mono shrink-0 ${
                          f.severity === "high" || f.severity === "critical" ? "text-radar-red" :
                          f.severity === "medium" ? "text-radar-yellow" : "text-radar-muted"
                        }`}>[{f.severity}]</span>
                        <span className="text-radar-text">{f.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insight */}
              {result.metadata.ai_insight && (
                <div className="animate-fade-in">
                  <div className="text-xs font-semibold text-radar-text mb-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-radar-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Analysis
                  </div>
                  <div className="card bg-radar-cyan/5 border-radar-cyan/20 space-y-3">
                    <p className="text-xs text-radar-text font-medium leading-relaxed">
                      {result.metadata.ai_insight.summary}
                    </p>
                    <p className="text-xs text-radar-muted leading-relaxed">
                      {result.metadata.ai_insight.explanation}
                    </p>
                    {result.metadata.ai_insight.recommendations.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-radar-muted mb-1.5">Recommendations</div>
                        <ul className="space-y-1">
                          {result.metadata.ai_insight.recommendations.map((r, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-radar-text">
                              <span className="text-radar-cyan mt-0.5 shrink-0">→</span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div>
                <div className="text-xs font-semibold text-radar-text mb-2">Metadata</div>
                <div className="card !py-1">
                  <MetaRow label="IP Address" value={result.metadata.ip} />
                  <MetaRow label="Country" value={result.metadata.country} />
                  <MetaRow label="Registrar" value={result.metadata.registrar} />
                  <MetaRow label="Registered" value={result.metadata.registered_at} />
                  <MetaRow label="SSL Valid" value={result.metadata.ssl_valid} />
                  <MetaRow label="SSL Expiry" value={result.metadata.ssl_expiry} />
                  {result.metadata.virustotal && (
                    <MetaRow
                      label="VirusTotal"
                      value={`${result.metadata.virustotal.malicious} malicious · ${result.metadata.virustotal.suspicious} suspicious · ${result.metadata.virustotal.harmless} harmless`}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual entry mode */}
      {mode === "manual" && (
        <div className="card space-y-4">
          <div>
            <div className="text-sm font-semibold text-radar-text">Manual Signal Entry</div>
            <div className="text-xs text-radar-muted mt-0.5">
              Directly submit a signal with custom metadata
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-radar-muted mb-1">Source</label>
              <input className="input" placeholder="alpha-node-01" />
            </div>
            <div>
              <label className="block text-xs text-radar-muted mb-1">Domain</label>
              <input className="input" placeholder="example.com" />
            </div>
            <div>
              <label className="block text-xs text-radar-muted mb-1">Range (m)</label>
              <input className="input" type="number" placeholder="5000" />
            </div>
            <div>
              <label className="block text-xs text-radar-muted mb-1">Intensity (dBZ)</label>
              <input className="input" type="number" placeholder="-45" />
            </div>
            <div>
              <label className="block text-xs text-radar-muted mb-1">Quality (%)</label>
              <input className="input" type="number" min="0" max="100" placeholder="85" />
            </div>
            <div>
              <label className="block text-xs text-radar-muted mb-1">Tags (comma separated)</label>
              <input className="input" placeholder="web, ssl, suspicious" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button className="btn-primary" disabled>
              Submit Signal
            </button>
            <span className="text-xs text-radar-muted">Manual ingestion coming soon</span>
          </div>
        </div>
      )}
    </div>
  );
}
