import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, LogOut, MousePointer } from "lucide-react";

const IDLE_LIMIT_MS = 15 * 60 * 1000;   // 15 minutes idle → show warning
const COUNTDOWN_SEC = 60;                // 60-second countdown before logout

interface Props {
  onLogout: () => void;
}

export function IdleTimeoutDialog({ onLogout }: Props) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  const countdownInterval = useRef<ReturnType<typeof setInterval>>();

  const resetIdle = useCallback(() => {
    if (showWarning) return; // don't reset if warning is active
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(COUNTDOWN_SEC);
    }, IDLE_LIMIT_MS);
  }, [showWarning]);

  // Track user activity
  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    const handler = () => resetIdle();

    events.forEach((e) => document.addEventListener(e, handler, { passive: true }));
    resetIdle(); // start timer

    return () => {
      events.forEach((e) => document.removeEventListener(e, handler));
      clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);

  // Countdown when warning is shown
  useEffect(() => {
    if (!showWarning) {
      clearInterval(countdownInterval.current);
      return;
    }

    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval.current);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval.current);
  }, [showWarning, onLogout]);

  const handleStayActive = () => {
    setShowWarning(false);
    setCountdown(COUNTDOWN_SEC);
    // restart idle timer
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(COUNTDOWN_SEC);
    }, IDLE_LIMIT_MS);
  };

  if (!showWarning) return null;

  const pct = (countdown / COUNTDOWN_SEC) * 100;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div
        className="w-full max-w-sm mx-4 rounded-xl overflow-hidden shadow-2xl"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }}
      >
        {/* Progress bar */}
        <div className="h-1" style={{ background: "var(--surface-overlay)" }}>
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${pct}%`,
              background: countdown > 15 ? "var(--gold-400)" : "#DC2626",
            }}
          />
        </div>

        <div className="p-6 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(240,165,0,0.1)" }}
          >
            <Clock size={28} style={{ color: "var(--gold-400)" }} />
          </div>

          <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Session Timeout Warning
          </h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            You've been inactive for 15 minutes. Your session will end in{" "}
            <span className="font-bold" style={{ color: countdown > 15 ? "var(--gold-400)" : "#DC2626" }}>
              {countdown}s
            </span>.
          </p>

          <div className="flex gap-2 justify-center">
            <button
              onClick={handleStayActive}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs font-bold transition-colors"
              style={{ background: "var(--gold-400)", color: "var(--surface-base)" }}
            >
              <MousePointer size={13} /> Stay Active
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: "var(--surface-overlay)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
              }}
            >
              <LogOut size={13} /> Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
