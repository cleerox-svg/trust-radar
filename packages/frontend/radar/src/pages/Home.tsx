import { useState, type FormEvent } from "react";
import { scans, type ScanResult } from "../lib/api";
import { Card, CardContent, Badge, Button, ScoreRing } from "../components/ui";

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
    <div className="max-w-3xl mx-auto py-12 space-y-10 animate-fade-in">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 text-green-400 text-sm font-mono mb-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Real-time threat intelligence
        </div>
        <h1 className="font-display text-5xl font-bold tracking-tight text-[--text-primary]">
          Is this URL <span className="text-green-400">safe?</span>
        </h1>
        <p className="text-[--text-secondary] text-lg max-w-xl mx-auto">
          Paste any link to instantly get a trust score, risk flags, SSL status, WHOIS data, and VirusTotal results.
        </p>
      </div>

      {/* Scanner */}
      <Card>
        <CardContent>
          <form onSubmit={handleScan} className="flex gap-3">
            <input
              className="flex-1 text-sm px-3 py-2.5 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-cyan-500 focus:outline-none font-mono"
              placeholder="https://example.com or domain.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !url.trim()}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Scanning...
                </span>
              ) : "Analyze"}
            </Button>
          </form>
          {error && <p className="text-red-400 text-sm font-mono mt-3">{error}</p>}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-fade-in">
          {/* Score header */}
          <Card>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ScoreRing score={result.trust_score} size="lg" />
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="font-mono text-xl font-bold text-[--text-primary]">{result.domain}</div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Badge variant={result.risk_level as "critical" | "high" | "medium" | "low"}>{result.risk_level} risk</Badge>
                    {result.cached && (
                      <span className="text-xs text-[--text-tertiary] border border-[--border-subtle] rounded px-1.5 py-0.5 font-mono">cached</span>
                    )}
                  </div>
                  {result.cached && (
                    <div className="text-xs text-[--text-tertiary]">Cached result from {new Date(result.created_at).toLocaleString()}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Flags */}
          {result.flags.length > 0 && (
            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Risk Flags</h3>
                <div className="space-y-2">
                  {result.flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                      <Badge variant={f.severity as "critical" | "high" | "medium" | "low"}>{f.severity}</Badge>
                      <div>
                        <div className="text-sm font-medium text-[--text-primary]">{f.type.replace(/_/g, " ")}</div>
                        <div className="text-xs text-[--text-tertiary] mt-0.5">{f.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Metadata</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: "SSL Valid", value: result.metadata.ssl_valid === undefined ? "—" : result.metadata.ssl_valid ? "Valid" : "Invalid", color: result.metadata.ssl_valid ? "text-green-400" : "text-red-400" },
                  { label: "Country", value: result.metadata.country ?? "—" },
                  { label: "IP Address", value: result.metadata.ip ?? "—" },
                  { label: "Registrar", value: result.metadata.registrar ?? "—" },
                  { label: "Registered", value: result.metadata.registered_at ? new Date(result.metadata.registered_at).toLocaleDateString() : "—" },
                  { label: "SSL Expiry", value: result.metadata.ssl_expiry ? new Date(result.metadata.ssl_expiry).toLocaleDateString() : "—" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="text-xs text-[--text-tertiary]">{label}</div>
                    <div className={`font-mono text-sm ${color ?? "text-[--text-primary]"} truncate`}>{value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* VirusTotal */}
          {result.metadata.virustotal && (
            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-[--text-primary] mb-3">VirusTotal</h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Malicious", value: result.metadata.virustotal.malicious, color: "text-red-400" },
                    { label: "Suspicious", value: result.metadata.virustotal.suspicious, color: "text-yellow-400" },
                    { label: "Harmless", value: result.metadata.virustotal.harmless, color: "text-green-400" },
                    { label: "Undetected", value: result.metadata.virustotal.undetected, color: "text-[--text-tertiary]" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <div className={`font-mono font-bold text-2xl tabular-nums ${color}`}>{value}</div>
                      <div className="text-xs text-[--text-tertiary] mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Insight */}
          {result.metadata.ai_insight && (
            <Card className="border-cyan-500/20">
              <CardContent>
                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Analysis
                </h3>
                <p className="text-sm text-[--text-primary] leading-relaxed mb-2">{result.metadata.ai_insight.summary}</p>
                <p className="text-xs text-[--text-tertiary] leading-relaxed mb-3">{result.metadata.ai_insight.explanation}</p>
                {result.metadata.ai_insight.recommendations.length > 0 && (
                  <ul className="space-y-1">
                    {result.metadata.ai_insight.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-[--text-secondary]">
                        <span className="text-cyan-400 mt-0.5 shrink-0">-&gt;</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { title: "SSL Check", desc: "Certificate validity & expiry" },
            { title: "WHOIS Data", desc: "Domain age, registrar & country" },
            { title: "VirusTotal", desc: "70+ antivirus engine scan" },
          ].map(({ title, desc }) => (
            <Card key={title} className="hover:border-green-500/30 transition-colors">
              <CardContent className="text-center space-y-2">
                <div className="text-sm font-semibold text-[--text-primary]">{title}</div>
                <div className="text-xs text-[--text-tertiary]">{desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
