import { useState } from "react";
import { scans, ScanResult } from "../lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTED = [
  "Why would a domain score below 40?",
  "What makes a URL high risk?",
  "How does VirusTotal affect the score?",
  "Explain the signal station architecture",
];

const KNOWLEDGE: Record<string, string> = {
  "score below": "A trust score below 40 usually means multiple risk factors are present: no HTTPS, recent domain registration (< 30 days), VirusTotal detections, or suspicious patterns like typosquatting. Check the flags section of any scan result for the specific reasons.",
  "high risk": "A URL is classified as high or critical risk when: 1+ VirusTotal engines flag it as malicious, the domain was registered very recently, there's no valid SSL certificate, or it matches known phishing/malware patterns. Any combination of these pushes the score below 40.",
  "virustotal": "VirusTotal checks the URL against 70+ antivirus engines. Each malicious detection reduces the trust score by up to 10 points (capped at 50 total deduction), and each suspicious detection reduces it by up to 5 points (capped at 20). Even one malicious detection is a serious red flag.",
  "station": "Trust Radar uses three signal stations: Station Alpha ingests signals from the web scanner, Station Beta from the API endpoint, and Station Gamma from the browser extension. Cache Node 001 handles deduplicated / cached scan results. Station data feeds the live Signals page.",
  "ssl": "An invalid or missing SSL certificate reduces the trust score by 25 points and is one of the clearest indicators of a risky URL. Valid SSL doesn't guarantee safety, but its absence is a major warning sign.",
  "whois": "WHOIS data provides domain registration date, registrar, and country. Domains registered within the last 30 days are flagged as suspicious, since phishing/scam sites are often ephemeral.",
  "cache": "Scan results are cached per domain for up to 24 hours to avoid redundant external API calls. If a result shows 'cached', it reflects the most recent live scan of that domain, not a new real-time check.",
  "alert": "Alerts are triggered when scans produce high or critical risk results. Open alerts require acknowledgment (ACK) by an operator. After ACK, investigate the flagged domain before marking it resolved or escalating.",
};

function getReply(input: string): string {
  const q = input.toLowerCase();
  for (const [key, answer] of Object.entries(KNOWLEDGE)) {
    if (q.includes(key)) return answer;
  }
  return "I can answer questions about trust scores, risk levels, VirusTotal integration, signal stations, SSL, WHOIS data, caching, and alert triage. Try one of the suggested questions above, or describe what you'd like to understand about Trust Radar.";
}

export default function AIAdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hi! I'm the Trust Radar AI Advisor. Ask me anything about how the platform works, what scores mean, or how to interpret your results." },
  ]);
  const [input, setInput] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const handleSend = () => {
    const q = input.trim();
    if (!q) return;
    const reply = getReply(q);
    setMessages((m) => [...m, { role: "user", text: q }, { role: "assistant", text: reply }]);
    setInput("");
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanUrl.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const r = await scans.scan(scanUrl.trim());
      setScanResult(r);
      setMessages((m) => [
        ...m,
        { role: "user", text: `Scan ${scanUrl}` },
        {
          role: "assistant",
          text: `Scanned **${r.domain}** — Trust Score: **${r.trust_score}/100**, Risk: **${r.risk_level.toUpperCase()}**. ${
            r.flags.length > 0
              ? `Flags detected: ${r.flags.map((f) => f.detail).join("; ")}.`
              : "No risk flags detected."
          }`,
        },
      ]);
      setScanUrl("");
    } catch (err: any) {
      setMessages((m) => [...m, { role: "assistant", text: `Scan failed: ${err.message}` }]);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-radar-cyan/20 border border-radar-cyan/40 flex items-center justify-center text-radar-cyan">
          +
        </div>
        <div>
          <h1 className="text-lg font-semibold text-radar-text">AI Advisor</h1>
          <p className="text-xs text-radar-muted">Ask questions, scan URLs, get instant analysis</p>
        </div>
      </div>

      {/* Scan bar */}
      <form onSubmit={handleScan} className="card !py-3 flex gap-2">
        <input
          className="input flex-1"
          type="url"
          placeholder="Scan a URL for instant AI analysis…"
          value={scanUrl}
          onChange={(e) => setScanUrl(e.target.value)}
          disabled={scanning}
        />
        <button className="btn-primary whitespace-nowrap !px-4" type="submit" disabled={scanning || !scanUrl.trim()}>
          {scanning ? "…" : "Scan"}
        </button>
      </form>

      {/* Suggested questions */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            onClick={() => { setInput(s); }}
            className="text-xs border border-radar-border text-radar-muted rounded-full px-3 py-1.5 hover:border-radar-cyan hover:text-radar-cyan transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="card !p-0 overflow-hidden">
        <div className="h-80 overflow-y-auto p-4 space-y-3 flex flex-col">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] text-xs px-3.5 py-2.5 rounded-xl leading-relaxed ${
                m.role === "user"
                  ? "bg-radar-cyan text-radar-bg font-medium"
                  : "bg-radar-sidebar border border-radar-border text-radar-text"
              }`}>
                {m.text.split("**").map((part, j) =>
                  j % 2 === 1
                    ? <strong key={j} className="font-semibold">{part}</strong>
                    : part
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-radar-border p-3 flex gap-2">
          <input
            className="input flex-1 !py-1.5 text-xs"
            placeholder="Ask a question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button
            className="btn-primary !px-3 !py-1.5 text-xs"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            Send
          </button>
        </div>
      </div>

      {/* Latest scan result */}
      {scanResult && (
        <div className="card space-y-2 border-radar-cyan/20 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-radar-text">{scanResult.domain}</span>
            <span className={`text-lg font-bold font-mono ${
              scanResult.trust_score >= 80 ? "text-radar-green" :
              scanResult.trust_score >= 50 ? "text-radar-yellow" : "text-radar-red"
            }`}>{scanResult.trust_score}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-radar-muted">
            <span>Risk: <span className="text-radar-text font-mono">{scanResult.risk_level}</span></span>
            <span>SSL: <span className={scanResult.metadata.ssl_valid ? "text-radar-green" : "text-radar-red"}>{scanResult.metadata.ssl_valid ? "valid" : "invalid"}</span></span>
            {scanResult.metadata.country && <span>Country: <span className="text-radar-text">{scanResult.metadata.country}</span></span>}
            {scanResult.metadata.virustotal && (
              <span>VT: <span className="text-radar-red">{scanResult.metadata.virustotal.malicious}m</span> / <span className="text-radar-green">{scanResult.metadata.virustotal.harmless}h</span></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
