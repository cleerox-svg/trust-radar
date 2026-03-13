/**
 * useThreatPush — WebSocket hook for real-time threat push from ThreatPushHub.
 *
 * Connects to /ws/threats, reconnects with exponential backoff on failure,
 * and invalidates react-query caches when new threat events arrive.
 *
 * Usage:
 *   const { connected, lastEvent } = useThreatPush();
 */

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type ThreatPushEventType = "threat_new" | "stats_update" | "ping";

export interface ThreatPushEvent {
  type: ThreatPushEventType;
  payload?: unknown;
  ts: number;
}

interface UseThreatPushResult {
  connected: boolean;
  lastEvent: ThreatPushEvent | null;
}

const BASE_DELAY  = 1000;   // 1s initial reconnect delay
const MAX_DELAY   = 30000;  // 30s max delay
const MAX_RETRIES = 10;     // give up after 10 consecutive failures

function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/threats`;
}

export function useThreatPush(): UseThreatPushResult {
  const queryClient = useQueryClient();
  const wsRef       = useRef<WebSocket | null>(null);
  const retryRef    = useRef(0);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef  = useRef(true);
  const pingRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<ThreatPushEvent | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    function cleanup() {
      if (pingRef.current)  { clearInterval(pingRef.current);  pingRef.current  = null; }
      if (timerRef.current) { clearTimeout(timerRef.current);  timerRef.current = null; }
      if (wsRef.current)    { wsRef.current.close();            wsRef.current    = null; }
    }

    function scheduleReconnect() {
      if (!mountedRef.current) return;
      retryRef.current++;
      if (retryRef.current > MAX_RETRIES) {
        console.warn("[useThreatPush] max retries reached, stopping");
        return;
      }
      const delay = Math.min(BASE_DELAY * Math.pow(2, retryRef.current - 1), MAX_DELAY);
      timerRef.current = setTimeout(connect, delay);
    }

    function connect() {
      if (!mountedRef.current) return;
      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current) { ws.close(); return; }
          setConnected(true);
          retryRef.current = 0;
          // Keepalive ping every 25s
          pingRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const msg = JSON.parse(event.data as string) as ThreatPushEvent;
            setLastEvent(msg);
            if (msg.type === "threat_new") {
              queryClient.invalidateQueries({ queryKey: ["threat-stats"] });
              queryClient.invalidateQueries({ queryKey: ["threats-list"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            } else if (msg.type === "stats_update") {
              queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
              queryClient.invalidateQueries({ queryKey: ["threat-stats"] });
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
          wsRef.current = null;
          if (!mountedRef.current) return;
          setConnected(false);
          scheduleReconnect();
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        console.warn("[useThreatPush] connect error:", err);
        scheduleReconnect();
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // mount/unmount only — queryClient is stable

  return { connected, lastEvent };
}
