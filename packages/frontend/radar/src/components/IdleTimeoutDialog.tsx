import { useEffect, useRef, useState, useCallback } from "react";

const IDLE_MS = 15 * 60 * 1000;  // 15 minutes
const COUNTDOWN_S = 60;           // 60 second warning

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousedown", "mousemove", "keydown", "scroll", "touchstart", "pointerdown",
];

interface Props {
  onLogout: () => void;
}

export function IdleTimeoutDialog({ onLogout }: Props) {
  const [showDialog, setShowDialog] = useState(false);
  const [remaining, setRemaining] = useState(COUNTDOWN_S);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetIdle = useCallback(() => {
    if (showDialog) return; // don't reset during countdown
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setShowDialog(true);
      setRemaining(COUNTDOWN_S);
    }, IDLE_MS);
  }, [showDialog]);

  // Attach activity listeners
  useEffect(() => {
    ACTIVITY_EVENTS.forEach((evt) => document.addEventListener(evt, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => document.removeEventListener(evt, resetIdle));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);

  // Countdown when dialog is shown
  useEffect(() => {
    if (!showDialog) return;
    countdownTimer.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer.current!);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownTimer.current) clearInterval(countdownTimer.current); };
  }, [showDialog, onLogout]);

  function handleStayActive() {
    setShowDialog(false);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    resetIdle();
  }

  if (!showDialog) return null;

  const pct = (remaining / COUNTDOWN_S) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }}
      >
        <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Session timeout
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          You&apos;ve been idle for 15 minutes. Your session will end in{" "}
          <span className="font-mono font-bold" style={{ color: "var(--cyan-400)" }}>{remaining}s</span>.
        </p>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full mb-5 overflow-hidden" style={{ background: "var(--surface-base)" }}>
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%`, background: pct > 33 ? "var(--cyan-400)" : "#EF4444" }}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleStayActive}
            className="flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--cyan-400)", color: "#0A0E1A" }}
          >
            Stay Active
          </button>
          <button
            onClick={onLogout}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
