import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { trustbot } from "../lib/api";
import { Card, CardContent, Button } from "../components/ui";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export function TrustBotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Welcome to **TrustBot**. I'm your threat intelligence copilot.\n\nAsk me about:\n- Threat overview and status\n- Domain or IP lookups\n- Critical alerts\n- Feed status\n- Agent runs\n\nType your question below to get started.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMut = useMutation({
    mutationFn: (query: string) => trustbot.chat(query),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          context: data.context,
        },
      ]);
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `**Error:** ${err instanceof Error ? err.message : "Something went wrong."}`,
          timestamp: new Date(),
        },
      ]);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || chatMut.isPending) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: query, timestamp: new Date() },
    ]);
    setInput("");
    chatMut.mutate(query);
  };

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">TrustBot</h1>
        <p className="text-sm text-[--text-secondary]">AI-powered threat intelligence assistant with database context</p>
      </div>

      {/* Chat Messages */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 overflow-y-auto space-y-4 pb-0">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-cyan-500/15 border border-cyan-500/25 text-[--text-primary]"
                    : "bg-[--surface-base] border border-[--border-subtle] text-[--text-primary]"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                    <span className="text-[10px] font-mono text-blue-500 uppercase tracking-wider">TrustBot</span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  <MarkdownLite content={msg.content} />
                </div>
                <div className="text-[10px] text-[--text-tertiary] mt-2 font-mono">
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {chatMut.isPending && (
            <div className="flex justify-start">
              <div className="bg-[--surface-base] border border-[--border-subtle] rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                  <span className="text-xs text-[--text-tertiary]">Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about threats, domains, IPs, feeds, agents..."
          className="flex-1 h-10 rounded-lg border border-[--border-default] bg-[--surface-base] px-4 text-sm text-[--text-primary] placeholder:text-[--text-tertiary] focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-colors"
          disabled={chatMut.isPending}
        />
        <Button type="submit" variant="default" disabled={chatMut.isPending || !input.trim()}>
          Send
        </Button>
      </form>

      {/* Quick Actions */}
      <div className="mt-2 flex flex-wrap gap-2">
        {["Threat overview", "Critical alerts", "Feed status", "Agent runs"].map((q) => (
          <button
            key={q}
            onClick={() => { setInput(q); inputRef.current?.focus(); }}
            className="text-[11px] px-2.5 py-1 rounded-full border border-[--border-subtle] text-[--text-tertiary] hover:text-[--text-primary] hover:border-[--border-default] transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Simple markdown-like renderer ──────────────────────────────

function MarkdownLite({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        // Bold
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        });

        // List items
        if (line.startsWith("- ")) {
          return <div key={i} className="pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-blue-500">{rendered.map((r, idx) => idx === 0 ? <span key={idx}>{String(parts[0]).slice(2)}{parts.length > 1 ? rendered.slice(1) : null}</span> : null)}</div>;
        }

        // Empty line = paragraph break
        if (line.trim() === "") return <div key={i} className="h-2" />;

        return <div key={i}>{rendered}</div>;
      })}
    </>
  );
}
