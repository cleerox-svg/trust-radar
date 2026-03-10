import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { trustbot } from "../lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function TrustBotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm TrustBot, your threat intelligence copilot. Ask me about threats, domains, feeds, agents, or anything in the platform." },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = useMutation({
    mutationFn: (query: string) => trustbot.chat(query),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send() {
    const q = input.trim();
    if (!q || chat.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    chat.mutate(q);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-600 transition-all hover:scale-105 flex items-center justify-center"
        aria-label={open ? "Close TrustBot" : "Open TrustBot"}
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 w-[380px] max-h-[520px] rounded-xl overflow-hidden shadow-2xl shadow-black/40 flex flex-col"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-void)" }}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>TrustBot</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-mono">AI</span>
            <div className="flex-1" />
            <button onClick={() => setOpen(false)} className="text-[--text-tertiary] hover:text-[--text-primary] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: "380px" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] text-xs leading-relaxed rounded-lg px-3 py-2 ${
                    msg.role === "user"
                      ? "bg-cyan-500 text-white"
                      : ""
                  }`}
                  style={msg.role === "assistant" ? { background: "var(--surface-base)", color: "var(--text-secondary)" } : undefined}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chat.isPending && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-1" style={{ background: "var(--surface-base)", color: "var(--text-tertiary)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="px-3 py-1.5 flex gap-1.5 flex-wrap" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {["Threat overview", "Feed status", "Agent runs", "Critical alerts"].map((q) => (
              <button
                key={q}
                onClick={() => { setInput(q); }}
                className="text-[10px] px-2 py-1 rounded-full border transition-colors"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-tertiary)" }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 flex gap-2 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <input
              type="text"
              className="input flex-1 text-xs"
              placeholder="Ask TrustBot..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={chat.isPending}
            />
            <button
              onClick={send}
              disabled={!input.trim() || chat.isPending}
              className="px-3 py-1.5 rounded-md bg-cyan-500 text-white text-xs font-medium disabled:opacity-40 hover:bg-cyan-600 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
