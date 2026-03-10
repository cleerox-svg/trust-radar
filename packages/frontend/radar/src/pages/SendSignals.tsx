import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { scans, signals, type ScanResult } from "../lib/api";
import { Card, CardContent, Badge, Button, ScoreRing } from "../components/ui";

type Mode = "url-scan" | "manual";

export default function SendSignals() {
  const [mode, setMode] = useState<Mode>("url-scan");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);

  // Manual entry state
  const [mSource, setMSource] = useState("station-alpha");
  const [mDomain, setMDomain] = useState("");
  const [mRange, setMRange] = useState(5000);
  const [mIntensity, setMIntensity] = useState(-45);
  const [mQuality, setMQuality] = useState(85);
  const [mTags, setMTags] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const scanMut = useMutation({
    mutationFn: (scanUrl: string) => scans.scan(scanUrl),
    onSuccess: setResult,
  });

  const ingestMut = useMutation({
    mutationFn: () => signals.ingest({
      source: mSource,
      domain: mDomain,
      range_m: mRange,
      intensity_dbz: mIntensity,
      quality: mQuality,
      tags: mTags.split(",").map((t) => t.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      setSubmitSuccess(true);
      setMDomain("");
      setMTags("");
      setTimeout(() => setSubmitSuccess(false), 3000);
    },
  });

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setResult(null);
    scanMut.mutate(url.trim());
  };

  const handleIngest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mDomain.trim()) return;
    ingestMut.mutate();
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Send Signals</h1>
        <p className="text-sm text-[--text-secondary]">Ingest new signals into the radar pipeline</p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2">
        {([
          { key: "url-scan" as Mode, label: "URL Scan" },
          { key: "manual" as Mode, label: "Manual Entry" },
        ]).map((m) => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setResult(null); }}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              mode === m.key
                ? "border-cyan-500 bg-cyan-500/15 text-cyan-400"
                : "border-[--border-subtle] text-[--text-tertiary] hover:text-[--text-secondary]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* URL Scan mode */}
      {mode === "url-scan" && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-0.5">URL Trust Analysis</h3>
            <p className="text-xs text-[--text-secondary] mb-4">Scan a URL to ingest its trust signal into the radar</p>
            <form onSubmit={handleScan} className="flex gap-2">
              <input
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-cyan-500 focus:outline-none font-mono"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={scanMut.isPending}
              />
              <Button type="submit" disabled={scanMut.isPending || !url.trim()}>
                {scanMut.isPending ? "Scanning..." : "Scan URL"}
              </Button>
            </form>

            {scanMut.isError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-3">
                {(scanMut.error as Error).message}
              </div>
            )}

            {result && (
              <div className="mt-4 pt-4 border-t border-[--border-subtle] animate-fade-in space-y-4">
                <div className="flex items-center gap-4">
                  <ScoreRing score={result.trust_score} size="md" />
                  <div>
                    <div className="font-mono font-semibold text-[--text-primary]">{result.domain}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={result.risk_level as "critical" | "high" | "medium" | "low"}>{result.risk_level}</Badge>
                      {result.cached && <span className="text-[10px] text-[--text-tertiary] border border-[--border-subtle] rounded px-1.5 py-0.5 font-mono">cached</span>}
                    </div>
                  </div>
                </div>

                {result.flags.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-[--text-primary] mb-2">Risk Flags</div>
                    <div className="space-y-1.5">
                      {result.flags.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 bg-[--surface-base] border border-[--border-subtle]">
                          <Badge variant={f.severity as "critical" | "high" | "medium" | "low"}>{f.severity}</Badge>
                          <span className="text-[--text-secondary]">{f.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.metadata.ai_insight && (
                  <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3">
                    <div className="text-xs font-semibold text-cyan-400 mb-1">AI Analysis</div>
                    <p className="text-xs text-[--text-secondary] leading-relaxed">{result.metadata.ai_insight.summary}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  {[
                    { label: "IP", value: result.metadata.ip },
                    { label: "Country", value: result.metadata.country },
                    { label: "SSL", value: result.metadata.ssl_valid === undefined ? undefined : result.metadata.ssl_valid ? "Valid" : "Invalid" },
                    { label: "Registrar", value: result.metadata.registrar },
                    result.metadata.virustotal ? { label: "VT", value: `${result.metadata.virustotal.malicious}m / ${result.metadata.virustotal.harmless}h` } : null,
                  ].filter((m): m is { label: string; value: string | undefined } => m !== null && m.value !== undefined).map((m) => (
                    <div key={m.label}>
                      <div className="text-[--text-tertiary]">{m.label}</div>
                      <div className="font-mono text-[--text-primary]">{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual entry mode */}
      {mode === "manual" && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-0.5">Manual Signal Entry</h3>
            <p className="text-xs text-[--text-secondary] mb-4">Directly submit a signal with custom metadata</p>
            <form onSubmit={handleIngest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[--text-tertiary] mb-1">Source</label>
                  <select
                    value={mSource}
                    onChange={(e) => setMSource(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="station-alpha">Station Alpha (Web)</option>
                    <option value="station-beta">Station Beta (API)</option>
                    <option value="station-gamma">Station Gamma (Extension)</option>
                    <option value="manual">Manual Entry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[--text-tertiary] mb-1">Domain *</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-cyan-500 focus:outline-none font-mono"
                    placeholder="example.com"
                    value={mDomain}
                    onChange={(e) => setMDomain(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-[--text-tertiary] mb-1">Range (m)</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] focus:border-cyan-500 focus:outline-none"
                    type="number"
                    value={mRange}
                    onChange={(e) => setMRange(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[--text-tertiary] mb-1">Intensity (dBZ)</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] focus:border-cyan-500 focus:outline-none"
                    type="number"
                    value={mIntensity}
                    onChange={(e) => setMIntensity(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[--text-tertiary] mb-1">Quality (%)</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] focus:border-cyan-500 focus:outline-none"
                    type="number"
                    min="0"
                    max="100"
                    value={mQuality}
                    onChange={(e) => setMQuality(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[--text-tertiary] mb-1">Tags (comma separated)</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-cyan-500 focus:outline-none"
                    placeholder="web, ssl, suspicious"
                    value={mTags}
                    onChange={(e) => setMTags(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" disabled={ingestMut.isPending || !mDomain.trim()}>
                  {ingestMut.isPending ? "Submitting..." : "Submit Signal"}
                </Button>
                {submitSuccess && (
                  <span className="text-xs text-green-400">Signal ingested successfully</span>
                )}
                {ingestMut.isError && (
                  <span className="text-xs text-red-400">{(ingestMut.error as Error).message}</span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
