import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { trustbot, scans, type ScanResult } from "../lib/api";
import { Card, CardContent, Badge, Button } from "../components/ui";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTED = [
  "How many critical threats do we have?",
  "What's our current trust score?",
  "Show recent agent activity",
  "Summarize today's threat landscape",
];

export default function AIAdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hi! I'm the Trust Radar AI Advisor. I can answer questions about your threat landscape, run URL scans, and provide intelligence insights. Ask me anything!" },
  ]);
  const [input, setInput] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMut = useMutation({
    mutationFn: (query: string) => trustbot.chat(query),
    onSuccess: (data) => {
      setMessages((m) => [...m, { role: "assistant", text: data.response }]);
    },
    onError: (err: Error) => {
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${err.message}` }]);
    },
  });

  const scanMut = useMutation({
    mutationFn: (url: string) => scans.scan(url),
    onSuccess: (r: ScanResult) => {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `Scanned **${r.domain}** — Trust Score: **${r.trust_score}/100**, Risk: **${r.risk_level.toUpperCase()}**. ${
            r.flags.length > 0
              ? `Flags: ${r.flags.map((f) => f.detail).join("; ")}.`
              : "No risk flags detected."
          }${r.metadata.virustotal ? ` VirusTotal: ${r.metadata.virustotal.malicious} malicious, ${r.metadata.virustotal.harmless} harmless.` : ""}`,
        },
      ]);
      setScanUrl("");
    },
    onError: (err: Error) => {
      setMessages((m) => [...m, { role: "assistant", text: `Scan failed: ${err.message}` }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const q = input.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    chatMut.mutate(q);
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanUrl.trim()) return;
    setMessages((m) => [...m, { role: "user", text: `Scan ${scanUrl.trim()}` }]);
    scanMut.mutate(scanUrl.trim());
  };

  const isLoading = chatMut.isPending || scanMut.isPending;

  return (
    <div className="animate-fade-in space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-blue-500 text-sm font-bold">AI</div>
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary]">AI Advisor</h1>
          <p className="text-xs text-[--text-secondary]">Ask questions, scan URLs, get instant AI-powered analysis</p>
        </div>
      </div>

      {/* Scan bar */}
      <Card>
        <CardContent>
          <form onSubmit={handleScan} className="flex gap-2">
            <input
              className="flex-1 text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-cyan-500 focus:outline-none font-mono"
              type="url"
              placeholder="Scan a URL for instant AI analysis..."
              value={scanUrl}
              onChange={(e) => setScanUrl(e.target.value)}
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !scanUrl.trim()} size="sm">Scan</Button>
          </form>
        </CardContent>
      </Card>

      {/* Suggested questions */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            onClick={() => setInput(s)}
            className="text-xs border border-[--border-subtle] text-[--text-tertiary] rounded-full px-3 py-1.5 hover:border-cyan-500 hover:text-blue-500 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Chat */}
      <Card>
        <CardContent className="!p-0">
          <div ref={scrollRef} className="h-96 overflow-y-auto p-4 space-y-3 flex flex-col">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] text-sm px-3.5 py-2.5 rounded-xl leading-relaxed ${
                  m.role === "user"
                    ? "bg-cyan-500 text-white font-medium"
                    : "bg-[--surface-raised] border border-[--border-subtle] text-[--text-primary]"
                }`}>
                  {m.text.split("**").map((part, j) =>
                    j % 2 === 1
                      ? <strong key={j} className="font-semibold">{part}</strong>
                      : part
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[--surface-raised] border border-[--border-subtle] rounded-xl px-4 py-3 text-sm text-[--text-tertiary]">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-[--border-subtle] p-3 flex gap-2">
            <input
              className="flex-1 text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-cyan-500 focus:outline-none"
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="sm">Send</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
