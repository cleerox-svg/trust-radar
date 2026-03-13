/**
 * CommandCenter — Full-viewport SOC-terminal HUD.
 *
 * Layout:
 *   - ThreatMapGL fills the entire viewport (background)
 *   - Mission Control Ribbon: top-center bar with live pulse + KPIs
 *   - Left Dock (collapsible): Live Threat Feed
 *   - Right Dock (collapsible): Correlation Matrix
 *   - Toggle buttons for docks
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Shield, Globe2, Cpu, ChevronLeft, ChevronRight,
  AlertCircle, Layers, Radio,
} from "lucide-react";
import { threats, agents, dashboard, type Threat } from "../lib/api";
import { ThreatMapGL, type ThreatPoint } from "../components/ThreatMapGL";
import { CorrelationMatrix } from "../components/ui/CorrelationMatrix";
import { Badge } from "../components/ui";
import { useThreatPush } from "../lib/useThreatPush";
import { cn } from "../lib/cn";

// ─── Severity helpers ─────────────────────────────────────────────

const severityColor: Record<string, string> = {
  critical: "#EF4444",
  high:     "#F97316",
  medium:   "#EAB308",
  low:      "#22C55E",
};

// ─── Live Feed Panel ──────────────────────────────────────────────

// Matches the partial shape returned in ThreatStats.recentThreats
interface RecentThreat {
  id: string;
  type: string;
  title: string;
  severity: string;
  source: string;
  domain: string | null;
  ioc_value: string | null;
  ip_address: string | null;
  country_code: string | null;
  created_at: string;
}

interface FeedPanelProps {
  recentThreats: RecentThreat[];
}

function LiveFeedPanel({ recentThreats }: FeedPanelProps) {
  const [feedOffset, setFeedOffset] = useState(0);

  useEffect(() => {
    if (recentThreats.length === 0) return;
    const timer = setInterval(() => {
      setFeedOffset((prev) => (prev + 1) % Math.max(1, recentThreats.length));
    }, 2500);
    return () => clearInterval(timer);
  }, [recentThreats.length]);

  const visible = useMemo(() => {
    if (recentThreats.length === 0) return [];
    const doubled = [...recentThreats, ...recentThreats];
    const start = feedOffset % recentThreats.length;
    return doubled.slice(start, start + 8);
  }, [recentThreats, feedOffset]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: "#22C55E" }}
        />
        <span className="text-[11px] font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
          LIVE THREAT FEED
        </span>
        <span className="ml-auto text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
          {recentThreats.length} events
        </span>
      </div>

      <div className="flex-1 overflow-hidden space-y-1.5">
        {visible.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs" style={{ color: "var(--text-tertiary)" }}>
            No recent threats
          </div>
        )}
        {visible.map((t, i) => (
          <motion.div
            key={`${t.id}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: i * 0.03 }}
            className="rounded-md px-2.5 py-2"
            style={{
              background: "rgba(17, 24, 39, 0.85)",
              border: "1px solid var(--border-subtle)",
              borderLeft: `3px solid ${severityColor[t.severity] ?? "#64748B"}`,
            }}
          >
            <div className="flex items-start justify-between gap-1 mb-0.5">
              <span className="text-[11px] font-medium truncate flex-1" style={{ color: "var(--text-primary)" }}>
                {t.title ?? t.domain ?? t.ioc_value ?? "Unknown threat"}
              </span>
              <span
                className="text-[9px] font-mono uppercase shrink-0 rounded px-1 py-0.5"
                style={{
                  color: severityColor[t.severity] ?? "#64748B",
                  background: `${severityColor[t.severity] ?? "#64748B"}18`,
                }}
              >
                {t.severity}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                {t.type}
              </span>
              {t.country_code && (
                <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                  · {t.country_code}
                </span>
              )}
              {t.source && (
                <span className="text-[10px] font-mono truncate" style={{ color: "var(--text-tertiary)" }}>
                  · {t.source}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Mission Control Ribbon ───────────────────────────────────────

interface RibbonProps {
  totalThreats: number;
  criticalThreats: number;
  countriesActive: number;
  activeAgents: number;
  wsConnected: boolean;
}

function MissionRibbon({ totalThreats, criticalThreats, countriesActive, activeAgents, wsConnected }: RibbonProps) {
  const stats = [
    { icon: Shield, label: "Threats", value: totalThreats, color: "#3B82F6" },
    { icon: AlertCircle, label: "Critical", value: criticalThreats, color: criticalThreats > 0 ? "#EF4444" : "#22C55E" },
    { icon: Globe2, label: "Countries", value: countriesActive, color: "#60A5FA" },
    { icon: Cpu, label: "Agents", value: activeAgents, color: "#8B5CF6" },
  ];

  return (
    <div
      className="flex items-center gap-4 rounded-xl px-4 py-2.5"
      style={{
        background: "rgba(6, 10, 18, 0.88)",
        border: "1px solid var(--border-default)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 30px rgba(59,130,246,0.1)",
      }}
    >
      {/* Brand + pulse */}
      <div className="flex items-center gap-2 mr-2">
        <Radio className="w-3.5 h-3.5" style={{ color: wsConnected ? "#22C55E" : "#64748B" }} />
        <span className="text-xs font-display font-bold" style={{ color: "var(--primary)" }}>
          TRUST RADAR
        </span>
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: wsConnected ? "#22C55E" : "#64748B",
            animation: wsConnected ? "pulse 2s ease-in-out infinite" : "none",
          }}
        />
      </div>

      <div className="w-px h-5" style={{ background: "var(--border-default)" }} />

      {/* Stat chips */}
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
          <span className="text-[11px] font-mono" style={{ color: "var(--text-tertiary)" }}>{label}</span>
          <span className="text-sm font-bold tabular-nums font-mono" style={{ color }}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </span>
        </div>
      ))}

      <div className="w-px h-5" style={{ background: "var(--border-default)" }} />

      {/* Live timestamp */}
      <LiveClock />
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--text-tertiary)" }}>
      {time.toISOString().slice(11, 19)} UTC
    </span>
  );
}

// ─── Dock Panel wrapper ───────────────────────────────────────────

interface DockProps {
  side: "left" | "right";
  open: boolean;
  onToggle: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function DockPanel({ side, open, onToggle, title, icon, children }: DockProps) {
  const isLeft = side === "left";

  return (
    <div
      className="relative flex"
      style={{ height: "100%", flexDirection: isLeft ? "row" : "row-reverse" }}
    >
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
            style={{ height: "100%" }}
          >
            <div
              className="flex flex-col h-full p-3"
              style={{
                width: 300,
                background: "rgba(6, 10, 18, 0.90)",
                borderRight: isLeft ? "1px solid var(--border-default)" : "none",
                borderLeft: !isLeft ? "1px solid var(--border-default)" : "none",
                backdropFilter: "blur(20px)",
              }}
            >
              {/* Panel header */}
              <div className="flex items-center gap-2 mb-3 pb-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {icon}
                <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {title}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center rounded-sm"
        style={{
          alignSelf: "center",
          width: 20,
          height: 60,
          background: "rgba(17, 24, 39, 0.85)",
          border: "1px solid var(--border-default)",
          borderLeft: isLeft ? "none" : "1px solid var(--border-default)",
          borderRight: !isLeft ? "none" : "1px solid var(--border-default)",
          color: "var(--text-tertiary)",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        {isLeft
          ? open ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
          : open ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />
        }
      </button>
    </div>
  );
}

// ─── Main CommandCenter page ──────────────────────────────────────

export default function CommandCenter() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Data queries
  const { data: threatStats } = useQuery({
    queryKey: ["threat-stats"],
    queryFn: threats.stats,
    refetchInterval: 60000,
  });
  const { data: threatList } = useQuery({
    queryKey: ["threats-list"],
    queryFn: () => threats.list({ limit: 200 }),
  });
  const { data: agentStats } = useQuery({
    queryKey: ["agent-stats"],
    queryFn: agents.stats,
    refetchInterval: 30000,
  });

  // WebSocket real-time push
  const { connected: wsConnected } = useThreatPush();

  // Derived stats
  const ts = threatStats?.summary ?? {} as Record<string, number>;
  const as_ = agentStats?.summary ?? {} as Record<string, number>;

  const totalThreats = (ts.total as number) ?? 0;
  const criticalThreats = (ts.critical as number) ?? 0;
  const countriesActive = (ts.countries as number) ?? 0;
  const activeAgents = (as_.running as number) ?? 0;

  // Build ThreatPoints for GL map from threat list
  const threatPoints = useMemo<ThreatPoint[]>(() => {
    const list = threatList?.threats ?? [];
    return list
      .filter((t): t is Threat & { lat: number; lng: number } =>
        typeof t.lat === "number" && typeof t.lng === "number"
      )
      .map((t) => ({
        id: t.id,
        type: t.type ?? "unknown",
        severity: (t.severity as ThreatPoint["severity"]) ?? "low",
        title: t.title ?? t.domain ?? t.ioc_value ?? "Unknown",
        country_code: t.country_code ?? undefined,
        lat: t.lat,
        lng: t.lng,
        source: t.source ?? undefined,
      }));
  }, [threatList]);

  const recentThreats = threatStats?.recentThreats ?? [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--surface-void)",
      }}
    >
      {/* ── Top Ribbon ────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center z-20 px-4 py-2"
        style={{ pointerEvents: "none" }}
      >
        <div style={{ pointerEvents: "all" }}>
          <MissionRibbon
            totalThreats={totalThreats}
            criticalThreats={criticalThreats}
            countriesActive={countriesActive}
            activeAgents={activeAgents}
            wsConnected={wsConnected}
          />
        </div>
      </div>

      {/* ── Mobile layout: widgets above, map below ──────────── */}
      <div className="flex flex-col flex-1 overflow-hidden md:hidden">
        {/* Mobile panel tabs */}
        <div
          className="flex border-b shrink-0"
          style={{ borderColor: "var(--border-subtle)", background: "var(--surface-elevated)" }}
        >
          <button
            onClick={() => { setLeftOpen(true); setRightOpen(false); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-mono transition-colors"
            style={{ color: leftOpen ? "var(--primary)" : "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", borderBottom: leftOpen ? "2px solid var(--primary)" : "2px solid transparent" }}
          >
            <Activity className="w-3 h-3" />
            LIVE FEED
          </button>
          <button
            onClick={() => { setRightOpen(true); setLeftOpen(false); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-mono transition-colors"
            style={{ color: rightOpen ? "var(--primary)" : "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", borderBottom: rightOpen ? "2px solid var(--primary)" : "2px solid transparent" }}
          >
            <Layers className="w-3 h-3" />
            MATRIX
          </button>
        </div>

        {/* Mobile widget panel */}
        <div
          className="overflow-y-auto shrink-0"
          style={{ maxHeight: "40vh", background: "var(--surface-elevated)" }}
        >
          {leftOpen && <LiveFeedPanel recentThreats={recentThreats} />}
          {rightOpen && <CorrelationMatrix live />}
        </div>

        {/* Map at the bottom on mobile */}
        <div className="flex-1 relative min-h-0">
          <ThreatMapGL threats={threatPoints} className="absolute inset-0" />
        </div>
      </div>

      {/* ── Desktop layout: side docks + map ──────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left dock */}
        <div className="flex z-10" style={{ pointerEvents: "all" }}>
          <DockPanel
            side="left"
            open={leftOpen}
            onToggle={() => setLeftOpen(!leftOpen)}
            title="LIVE THREAT FEED"
            icon={<Activity className="w-3.5 h-3.5" style={{ color: "#22C55E" }} />}
          >
            <LiveFeedPanel recentThreats={recentThreats} />
          </DockPanel>
        </div>

        {/* Map fills remaining space */}
        <div className="flex-1 relative">
          <ThreatMapGL
            threats={threatPoints}
            className="absolute inset-0"
          />
        </div>

        {/* Right dock */}
        <div className="flex z-10" style={{ pointerEvents: "all" }}>
          <DockPanel
            side="right"
            open={rightOpen}
            onToggle={() => setRightOpen(!rightOpen)}
            title="CORRELATION MATRIX"
            icon={<Layers className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />}
          >
            <CorrelationMatrix live />
          </DockPanel>
        </div>
      </div>

      {/* ── Bottom status strip ───────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-4 py-1.5 z-20"
        style={{
          background: "rgba(6, 10, 18, 0.80)",
          borderTop: "1px solid var(--border-subtle)",
          backdropFilter: "blur(8px)",
        }}
      >
        <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
          TRUST RADAR COMMAND CENTER
        </span>
        <span className="w-1 h-1 rounded-full bg-[--border-strong]" />
        <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
          {totalThreats.toLocaleString()} threats indexed
        </span>
        <span className="w-1 h-1 rounded-full bg-[--border-strong]" />
        <span
          className="text-[10px] font-mono"
          style={{ color: wsConnected ? "#22C55E" : "#64748B" }}
        >
          {wsConnected ? "● LIVE" : "○ POLLING"}
        </span>
        <div className="ml-auto flex gap-3">
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className="text-[10px] font-mono flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{ color: leftOpen ? "var(--primary)" : "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
          >
            <Activity className="w-3 h-3" />
            Feed
          </button>
          <button
            onClick={() => setRightOpen(!rightOpen)}
            className="text-[10px] font-mono flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{ color: rightOpen ? "var(--primary)" : "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
          >
            <Layers className="w-3 h-3" />
            Matrix
          </button>
        </div>
      </div>
    </div>
  );
}
