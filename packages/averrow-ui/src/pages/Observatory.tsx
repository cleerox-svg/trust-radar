import { useState, useEffect, useCallback, useRef } from 'react';
import { useObservatoryThreats, useObservatoryStats, useObservatoryArcs, useObservatoryHeatmap } from '@/hooks/useObservatory';
import type { ArcData } from '@/hooks/useObservatory';
import { ThreatMap } from '@/components/observatory/ThreatMap';
import type { MapMode } from '@/components/observatory/ThreatMap';
import { useBrands } from '@/hooks/useBrands';
import { useProviders } from '@/hooks/useProviders';
import { useAgents } from '@/hooks/useAgents';
import { useOperations } from '@/hooks/useOperations';
import type { Operation } from '@/hooks/useOperations';
import { Badge } from '@/components/ui/Badge';
import { EventTicker } from '@/components/observatory/EventTicker';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/cn';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { X, ChevronDown, Activity } from 'lucide-react';
import { ObservatoryOverlay } from '@/components/ui/ObservatoryOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { BIMIGradeBadge } from '@/components/ui/BIMIGradeBadge';
import { AgentAttribution } from '@/components/ui/AgentAttribution';

const PERIODS = [
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
];

const SOURCES = [
  { id: 'all', label: 'All Sources' },
  { id: 'feeds', label: 'Feeds' },
  { id: 'spam_trap', label: 'Spam Trap' },
];

const MAP_MODES: { id: MapMode; label: string }[] = [
  { id: 'global', label: 'GLOBAL' },
  { id: 'operations', label: 'OPERATIONS' },
  { id: 'heatmap', label: 'HEATMAP' },
];

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try { return JSON.parse(val) as string[]; }
  catch { return []; }
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65),
  );
}

export function Observatory() {
  const { isMobile } = useBreakpoint();
  const [period, setPeriod] = useState('7d');
  const [source, setSource] = useState('all');
  const [showBeams, setShowBeams] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [showNodes, setShowNodes] = useState(true);
  const [colorBy, setColorBy] = useState<'severity' | 'type'>('severity');
  const [showPanel, setShowPanel] = useState(!isMobile);
  const [mobileActiveTab, setMobileActiveTab] = useState<'brands' | 'intel' | 'feed' | null>(null);
  const [clock, setClock] = useState('');
  const [mapMode, setMapMode] = useState<MapMode>('global');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFilterSelect = useCallback((setter: () => void) => {
    setter();
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setFiltersExpanded(false), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, []);

  // Clicked element state
  const [clickedArc, setClickedArc] = useState<{ arc: ArcData; x: number; y: number } | null>(null);
  const [clickedCluster, setClickedCluster] = useState<{ cluster: Operation; x: number; y: number } | null>(null);

  const { data: threats = [] } = useObservatoryThreats({ period, source });
  const { data: stats } = useObservatoryStats({ period, source });
  const { data: arcs = [] } = useObservatoryArcs({ period, source });
  const { data: operations = [] } = useOperations({ status: 'active', limit: 50 });
  const { data: heatmapData = [] } = useObservatoryHeatmap({ period });

  // Close click cards on Escape or click elsewhere
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setClickedArc(null);
        setClickedCluster(null);
      }
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleArcClick = useCallback((arc: ArcData, x: number, y: number) => {
    setClickedCluster(null);
    setClickedArc({ arc, x: Math.min(x, window.innerWidth - 340), y: Math.min(y, window.innerHeight - 200) });
  }, []);

  const handleClusterClick = useCallback((cluster: Operation, x: number, y: number) => {
    setClickedArc(null);
    setClickedCluster({ cluster, x: Math.min(x, window.innerWidth - 340), y: Math.min(y, window.innerHeight - 250) });
  }, []);

  // Close panels when switching modes
  useEffect(() => {
    setClickedArc(null);
    setClickedCluster(null);
    if (mapMode === 'heatmap') {
      setShowPanel(false);
    } else {
      setShowPanel(!isMobile);
    }
  }, [mapMode, isMobile]);

  // Live clock
  useEffect(() => {
    const tzAbbr = Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value || 'LOCAL';

    function update() {
      setClock(
        new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + tzAbbr
      );
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-[calc(100vh-3rem)] overflow-hidden">
      {/* Full-screen map */}
      <div className={cn('absolute inset-0', isMobile ? 'bottom-[108px]' : 'bottom-[84px]')}>
        <ThreatMap
          threats={threats}
          arcs={arcs}
          showBeams={showBeams}
          showParticles={showParticles}
          showNodes={showNodes}
          colorBy={colorBy}
          mapMode={mapMode}
          operations={operations}
          heatmapData={heatmapData}
          onArcClick={handleArcClick}
          onClusterClick={handleClusterClick}
        />
        {threats.length === 0 && (
          <ObservatoryOverlay
            historicalThreats={stats?.threats_mapped ?? 0}
            historicalCountries={stats?.countries ?? 0}
            timeWindow={PERIODS.find(p => p.id === period)?.label ?? period}
          />
        )}
      </div>

      {/* Top-left: Mode switcher + Period selector + Color mode */}
      {isMobile ? (
        <div className="absolute top-3 left-0 right-0 z-10 flex flex-col gap-1.5">
          {/* Row 1: Mode tabs — horizontally scrollable pills */}
          <div className="overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex gap-2 flex-nowrap w-max px-10">
              {MAP_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMapMode(m.id)}
                  className={cn(
                    'flex-shrink-0 font-mono text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap transition-all',
                    mapMode === m.id
                      ? 'bg-afterburner-muted text-afterburner border border-afterburner-border'
                      : 'bg-cockpit/80 text-white/60 border border-white/10 backdrop-blur-sm'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {/* Row 2: Collapsible filter bar */}
          <div className="mx-4">
            {/* Summary bar (collapsed) */}
            <button
              onClick={() => setFiltersExpanded(prev => !prev)}
              className="w-full bg-cockpit/80 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center justify-between"
            >
              <span className="text-xs font-mono">
                <span className="text-afterburner">{PERIODS.find(p => p.id === period)?.label}</span>
                {mapMode === 'global' && (
                  <>
                    <span className="text-white/50"> · </span>
                    <span className="text-afterburner capitalize">{colorBy}</span>
                  </>
                )}
                <span className="text-white/50"> · </span>
                <span className="text-afterburner">{SOURCES.find(s => s.id === source)?.label}</span>
              </span>
              <ChevronDown className={cn(
                'w-3.5 h-3.5 text-white/50 transition-transform duration-300',
                filtersExpanded && 'rotate-180'
              )} />
            </button>

            {/* Expanded filter groups */}
            <div
              className={cn(
                'overflow-hidden transition-all duration-300 ease-in-out',
                filtersExpanded ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="bg-cockpit/80 backdrop-blur-sm rounded-lg mt-1 px-4 py-2">
                {/* TIME group */}
                <div className="py-2">
                  <div className="text-[10px] font-mono uppercase text-white/50 tracking-wider mb-1">Time</div>
                  <div className="flex gap-2">
                    {PERIODS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleFilterSelect(() => setPeriod(p.id))}
                        className={cn(
                          'text-xs px-3 py-1 rounded-full border transition-all font-mono',
                          period === p.id
                            ? 'bg-afterburner-muted text-afterburner border-afterburner'
                            : 'text-contrail/50 border-cyan-800/30 hover:text-contrail/80'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* COLOR group (global mode only) */}
                {mapMode === 'global' && (
                  <div className="py-2 border-t border-cyan-800/10">
                    <div className="text-[10px] font-mono uppercase text-white/50 tracking-wider mb-1">Color</div>
                    <div className="flex gap-2">
                      {(['severity', 'type'] as const).map(c => (
                        <button
                          key={c}
                          onClick={() => handleFilterSelect(() => setColorBy(c))}
                          className={cn(
                            'text-xs px-3 py-1 rounded-full border transition-all font-mono capitalize',
                            colorBy === c
                              ? 'bg-afterburner-muted text-afterburner border-afterburner'
                              : 'text-contrail/50 border-cyan-800/30 hover:text-contrail/80'
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* SOURCE group */}
                <div className="py-2 border-t border-cyan-800/10">
                  <div className="text-[10px] font-mono uppercase text-white/50 tracking-wider mb-1">Source</div>
                  <div className="flex gap-2">
                    {SOURCES.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleFilterSelect(() => setSource(s.id))}
                        className={cn(
                          'text-xs px-3 py-1 rounded-full border transition-all font-mono',
                          source === s.id
                            ? 'bg-afterburner-muted text-afterburner border-afterburner'
                            : 'text-contrail/50 border-cyan-800/30 hover:text-contrail/80'
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          {/* Mode switcher */}
          <div className="bg-cockpit/90 backdrop-blur-sm rounded-lg p-1.5 flex gap-1 flex-shrink-0" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
            {MAP_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMapMode(m.id)}
                className={cn(
                  'font-mono text-[10px] font-bold px-3 py-1 rounded transition-all',
                  mapMode === m.id ? 'glass-btn-active' : 'glass-btn'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Period selector */}
          <div className="bg-cockpit/90 backdrop-blur-sm rounded-lg p-1.5 flex gap-1 flex-shrink-0" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'font-mono text-[10px] font-bold px-3 py-1 rounded transition-all',
                  period === p.id ? 'glass-btn-active' : 'glass-btn'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Color mode (Global mode only) */}
          {mapMode === 'global' && (
            <div className="bg-cockpit/90 backdrop-blur-sm rounded-lg p-1.5 flex gap-1 flex-shrink-0" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
              <button
                onClick={() => setColorBy('severity')}
                className={cn(
                  'font-mono text-[10px] px-2 py-1 rounded transition-all',
                  colorBy === 'severity' ? 'glass-btn-active' : 'glass-btn'
                )}
              >
                Severity
              </button>
              <button
                onClick={() => setColorBy('type')}
                className={cn(
                  'font-mono text-[10px] px-2 py-1 rounded transition-all',
                  colorBy === 'type' ? 'glass-btn-active' : 'glass-btn'
                )}
              >
                Type
              </button>
            </div>
          )}

          {/* Source filter */}
          <div className="bg-cockpit/90 backdrop-blur-sm rounded-lg p-1.5 flex gap-1 flex-shrink-0" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
            {SOURCES.map(s => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={cn(
                  'font-mono text-[10px] font-bold px-3 py-1 rounded transition-all',
                  source === s.id ? 'glass-btn-active' : 'glass-btn'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top-right: Live clock — hidden on mobile to avoid overlap with control bar */}
      <div className="hidden md:block absolute top-4 right-16 z-10">
        <div className="font-mono text-accent text-lg font-bold tabular-nums">{clock}</div>
      </div>

      {/* Legend */}
      {mapMode === 'global' && (
        isMobile ? (
          /* Mobile: horizontal strip below filter rows, top-left */
          <div className="absolute top-[88px] left-4 z-10">
            <div className="bg-cockpit/80 backdrop-blur-sm rounded px-2 py-1 flex flex-row gap-3">
              {colorBy === 'severity' ? (
                <>
                  <LegendItem color="rgb(200,60,60)" label="Critical" />
                  <LegendItem color="rgb(232,146,60)" label="High" />
                  <LegendItem color="rgb(220,170,50)" label="Medium" />
                  <LegendItem color="rgb(120,160,200)" label="Low" />
                </>
              ) : (
                <>
                  <LegendItem color="rgb(200,60,60)" label="Phishing" />
                  <LegendItem color="rgb(251,146,60)" label="Credential" />
                  <LegendItem color="rgb(168,85,247)" label="Malware" />
                  <LegendItem color="rgb(239,68,68)" label="C2" />
                </>
              )}
            </div>
          </div>
        ) : (
          /* Desktop: vertical legend bottom-left */
          <div className="absolute left-4 bottom-[100px] z-10">
            <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg p-3">
              <div className="font-mono text-[9px] text-white/50 uppercase tracking-wider mb-2">
                {colorBy === 'severity' ? 'Severity' : 'Threat Type'}
              </div>
              <div className="space-y-1">
                {colorBy === 'severity' ? (
                  <>
                    <LegendItem color="rgb(200,60,60)" label="Critical" />
                    <LegendItem color="rgb(232,146,60)" label="High" />
                    <LegendItem color="rgb(220,170,50)" label="Medium" />
                    <LegendItem color="rgb(120,160,200)" label="Low" />
                  </>
                ) : (
                  <>
                    <LegendItem color="rgb(200,60,60)" label="Phishing" />
                    <LegendItem color="rgb(251,146,60)" label="Credential" />
                    <LegendItem color="rgb(168,85,247)" label="Malware" />
                    <LegendItem color="rgb(239,68,68)" label="C2" />
                    <LegendItem color="rgb(251,113,133)" label="Web Attack" />
                    <LegendItem color="rgb(34,211,238)" label="Spam/Botnet" />
                  </>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* Heatmap legend (bottom-left) */}
      {mapMode === 'heatmap' && (
        <div className={cn('absolute left-4 z-10', isMobile ? 'bottom-[120px]' : 'bottom-[100px]')}>
          <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg p-4 glass-card glass-card-teal">
            <div className="section-label mb-3">Attack Density ({period.toUpperCase()})</div>
            <div className="flex items-center gap-3 mb-3">
              <LegendItem color="rgb(0,212,255)" label="Low" />
              <LegendItem color="rgb(251,146,60)" label="Medium" />
              <LegendItem color="rgb(200,60,60)" label="High" />
              <LegendItem color="rgb(200,60,60)" label="Critical" />
            </div>
            <div className="font-mono text-[10px] text-contrail/50">
              {heatmapData.length.toLocaleString()} threat points mapped
            </div>
          </div>
        </div>
      )}

      {/* Bottom-right: LIVE indicator */}
      <div className={cn('absolute right-4 z-10', isMobile ? 'bottom-[120px]' : 'bottom-[100px]')}>
        <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <LiveIndicator />
          <span className="font-mono text-[10px] text-white/55 tabular-nums">
            {threats.length.toLocaleString()} threats
          </span>
        </div>
      </div>

      {/* Event ticker — self-positions with fixed at bottom */}
      <EventTicker />

      {/* Bottom stats bar */}
      {isMobile ? (
        <div className="fixed bottom-0 left-0 w-full h-9 z-20 bg-cockpit border-t border-cyan-800/20">
          <div className="flex items-center justify-between px-4 h-full">
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="font-mono uppercase tracking-wider text-[10px] text-contrail/60">
                {mapMode === 'global' ? 'GLOBAL THREAT MAP' : mapMode === 'operations' ? 'OPERATIONS MAP' : 'DENSITY HEATMAP'}
              </span>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
              {stats && (
                <>
                  <span className="font-mono text-[10px] text-afterburner font-bold tabular-nums">
                    {(stats.threats_mapped ?? 0).toLocaleString()}
                  </span>
                  <span className="font-mono text-[10px] text-white/55">THREATS</span>
                  <span className="font-mono text-[10px] text-afterburner font-bold tabular-nums">
                    {(stats.countries ?? 0).toLocaleString()}
                  </span>
                  <span className="font-mono text-[10px] text-white/55">COUNTRIES</span>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 glass-elevated rounded-xl px-6 py-3 flex items-center gap-6">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50 shrink-0">
            {mapMode === 'global' ? 'GLOBAL THREAT MAP' : mapMode === 'operations' ? 'OPERATIONS MAP' : 'DENSITY HEATMAP'}
          </span>
          {stats && (
            <>
              <StatChip value={stats.threats_mapped} label="Threats Mapped" color="text-accent" />
              <StatChip value={stats.countries} label="Countries" color="text-contrail" />
              <StatChip value={stats.active_campaigns} label="Active Campaigns" color="text-warning" />
              <StatChip value={stats.brands_monitored} label="Brands Monitored" color="text-positive" />
            </>
          )}
        </div>
      )}

      {/* ─── Clicked Arc Detail Card ─── */}
      {clickedArc && (
        <div
          className="absolute z-30 w-80 glass-card glass-card-red rounded-xl p-4 animate-fade-in"
          style={{ left: clickedArc.x, top: clickedArc.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => setClickedArc(null)}
            className="absolute top-2 right-2 glass-btn p-1.5 rounded md:bg-transparent md:p-0"
          >
            <X className="w-4 h-4 text-white/50 hover:text-white" />
          </button>
          <div className="font-mono text-[11px] text-parchment font-bold mb-1">
            {clickedArc.arc.source_region} {'\u2192'} {clickedArc.arc.brand_name || 'Unknown'}
          </div>
          <div className="hud-divider" />
          <div className="space-y-1.5">
            {clickedArc.arc.brand_name && (
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-contrail/50">TARGET</span>
                <span className="font-mono text-[10px] text-parchment">{clickedArc.arc.brand_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-mono text-[10px] text-contrail/50">TYPE</span>
              <span className="font-mono text-[10px] text-parchment capitalize">{clickedArc.arc.threat_type?.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-[10px] text-contrail/50">SEVERITY</span>
              <span className="font-mono text-[10px] text-parchment uppercase">{clickedArc.arc.severity}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-[10px] text-contrail/50">VOLUME</span>
              <span className="font-mono text-[10px] text-parchment">{clickedArc.arc.volume} attacks</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Clicked Cluster Detail Card ─── */}
      {clickedCluster && (
        <div
          className={cn(
            'absolute z-30 w-80 glass-card rounded-xl p-4 animate-fade-in',
            clickedCluster.cluster.agent_notes?.includes('ACCELERATING') ? 'glass-card-amber' :
            clickedCluster.cluster.agent_notes?.includes('PIVOT') ? 'glass-card-teal' : 'glass-card-red'
          )}
          style={{ left: clickedCluster.x, top: clickedCluster.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => setClickedCluster(null)}
            className="absolute top-2 right-2 glass-btn p-1.5 rounded md:bg-transparent md:p-0"
          >
            <X className="w-4 h-4 text-white/50 hover:text-white" />
          </button>
          {clickedCluster.cluster.agent_notes?.includes('ACCELERATING') && (
            <span className="badge-glass badge-accelerating font-mono text-[9px] font-bold mb-2 inline-block">ACCELERATING</span>
          )}
          {clickedCluster.cluster.agent_notes?.includes('PIVOT') && (
            <span className="badge-glass badge-pivot font-mono text-[9px] font-bold mb-2 inline-block">PIVOT</span>
          )}
          <div className="font-mono text-[11px] text-parchment font-bold mb-1">
            {clickedCluster.cluster.cluster_name || `Cluster ${clickedCluster.cluster.id.slice(0, 8)}`}
          </div>
          <div className="font-mono text-[10px] text-white/55 mb-2">
            {parseJsonArray(clickedCluster.cluster.asns).join(', ')} {'\u00B7'} {parseJsonArray(clickedCluster.cluster.countries).map(countryFlag).join(' ')}
          </div>
          <div className="hud-divider" />
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="font-mono text-[10px] text-contrail/50">THREATS</span>
              <span className="font-mono text-[10px] text-parchment tabular-nums">{clickedCluster.cluster.threat_count.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-[10px] text-contrail/50">CONFIDENCE</span>
              <span className="font-mono text-[10px] text-parchment tabular-nums">{clickedCluster.cluster.confidence_score ?? '—'}</span>
            </div>
          </div>
          {clickedCluster.cluster.agent_notes && (
            <>
              <div className="hud-divider" />
              <div className="font-mono text-[10px] text-contrail/60 leading-relaxed">
                {clickedCluster.cluster.agent_notes}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Mobile bottom tab bar + expandable panel ─── */}
      {isMobile && (
        <>
          {/* Expanded panel — slides up from above the tab bar */}
          <div className={cn(
            'fixed left-0 w-full z-20 overflow-hidden transition-all duration-300 ease-in-out',
            mobileActiveTab ? 'max-h-64' : 'max-h-0'
          )} style={{ bottom: 'calc(36px + 32px + 40px)' /* stats + ticker + tab bar */ }}>
            <div className="bg-cockpit/95 backdrop-blur-md overflow-y-auto max-h-64 px-3 py-2">
              {mobileActiveTab === 'brands' && <MobileTopBrandsList period={period} />}
              {mobileActiveTab === 'intel' && <AgentIntelFeed />}
              {mobileActiveTab === 'feed' && <LiveThreatFeed />}
            </div>
          </div>

          {/* Tab bar — fixed above ticker */}
          <div className="fixed left-0 w-full z-20 bg-cockpit/95 backdrop-blur-md border-t border-cyan-800/20" style={{ bottom: 'calc(36px + 32px)' /* stats + ticker */ }}>
            <div className="flex justify-evenly items-center h-10">
              {([
                { key: 'brands' as const, label: 'TOP BRANDS' },
                { key: 'intel' as const, label: 'INTEL' },
                { key: 'feed' as const, label: 'LIVE FEED' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setMobileActiveTab(mobileActiveTab === tab.key ? null : tab.key)}
                  className={cn(
                    'font-mono text-xs uppercase tracking-wider px-3 py-2 transition-all',
                    mobileActiveTab === tab.key
                      ? 'text-afterburner border-b-2 border-afterburner'
                      : 'text-contrail/50'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── Desktop sidebar backdrop (no longer used on mobile) ─── */}

      {/* ─── Right sidebar panel (desktop only) ─── */}
      {!isMobile && showPanel && mapMode !== 'heatmap' && (
        <div className="absolute top-0 right-0 bottom-[84px] z-20 w-80 bg-slate-950/88 backdrop-blur-2xl border-l border-white/[0.06] shadow-[-8px_0_40px_rgba(0,0,0,0.5),inset_1px_0_0_rgba(255,255,255,0.04)] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
          {/* Mode-aware header */}
          {mapMode === 'global' && (
            <>
              <div className="px-4 py-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[9px] font-mono tracking-[0.2em] text-white/50 uppercase shrink-0">Top Targeted Brands</span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>
              <div className="px-4 pb-3">
                <TopBrandsList period={period} />
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-4 my-2" />
              <div className="px-4 py-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[9px] font-mono tracking-[0.2em] text-white/50 uppercase shrink-0">Hosting Providers</span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>
              <div className="px-4 pb-3">
                <TopProvidersList period={period} />
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-4 my-2" />
              <div className="px-4 py-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[9px] font-mono tracking-[0.2em] text-white/50 uppercase shrink-0">Agent Intelligence</span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>
              <div className="px-4 pb-3">
                <AgentAttribution agent="Observer + Sentinel" />
                <AgentIntelFeed />
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-4 my-2" />
              <div className="px-4 py-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[9px] font-mono tracking-[0.2em] text-white/50 uppercase shrink-0">Active Operations</span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>
              <div className="px-4 pb-3">
                <ActiveOperationsPanel />
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-4 my-2" />
              <div className="px-4 py-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[9px] font-mono tracking-[0.2em] text-white/50 uppercase shrink-0">Live Feed</span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>
              <div className="px-4 pb-3">
                <LiveThreatFeed />
              </div>
            </>
          )}

          {mapMode === 'operations' && (
            <>
              <div className="px-4 py-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[9px] font-mono tracking-[0.2em] text-white/50 uppercase shrink-0">Active Operations</span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>
              <div className="px-4 pb-3">
                <OperationsClusterList
                  operations={operations}
                  onSelect={(op) => {
                    const countries = parseJsonArray(op.countries);
                    const pos = countries.length > 0 ? countries[0] : '';
                    setClickedCluster({ cluster: op, x: window.innerWidth / 2 - 160, y: 100 });
                  }}
                />
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* Panel toggle button (desktop only) */}
      {!isMobile && mapMode !== 'heatmap' && (
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="absolute top-1/2 z-30 transform -translate-y-1/2 bg-cockpit/90 border border-white/10 rounded-l-lg px-1 py-3 text-white/50 hover:text-parchment"
          style={showPanel ? { right: '320px' } : { right: 0 }}
        >
          {showPanel ? '\u203A' : '\u2039'}
        </button>
      )}
    </div>
  );
}

// ─── Supporting components ───────────────────────────────────

function StatChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div>
        <div className={cn('font-mono text-xl font-bold tabular-nums', color)}>{(value ?? 0).toLocaleString()}</div>
        <div className="font-mono text-[11px] text-white/50 uppercase">{label}</div>
      </div>
    </div>
  );
}

function LegendItem({ color, label, compact }: { color: string; label: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center', compact ? 'gap-1' : 'gap-2')}>
      <span className={cn('rounded-full', compact ? 'w-2 h-2' : 'w-2.5 h-2.5')} style={{ backgroundColor: color }} />
      <span className={cn('font-mono text-contrail/60', compact ? 'text-[10px]' : 'text-[10px]')}>{label}</span>
    </div>
  );
}

function OperationsClusterList({ operations, onSelect }: { operations: Operation[]; onSelect: (op: Operation) => void }) {
  if (operations.length === 0) {
    return (
      <EmptyState
        icon={<Activity />}
        title="No active operations"
        subtitle="Nexus will surface correlated attack clusters as threat data accumulates"
        variant="scanning"
        compact
      />
    );
  }

  return (
    <div className="space-y-2">
      {operations.map(op => {
        const countries = parseJsonArray(op.countries);
        const isAccelerating = op.agent_notes?.includes('ACCELERATING');
        const isPivot = op.agent_notes?.includes('PIVOT');
        return (
          <button
            key={op.id}
            onClick={() => onSelect(op)}
            className="w-full text-left rounded-lg p-2.5 transition-all glass-card hover:border-afterburner-border"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-parchment truncate">
                {op.cluster_name || `Cluster ${op.id.slice(0, 8)}`}
              </span>
              {isAccelerating && <span className="badge-glass badge-accelerating font-mono text-[9px] font-bold">ACCEL</span>}
              {isPivot && <span className="badge-glass badge-pivot font-mono text-[9px] font-bold">PIVOT</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[10px] text-contrail/50 tabular-nums">
                {op.threat_count.toLocaleString()} threats
              </span>
              {countries.length > 0 && (
                <span className="font-mono text-[10px] text-white/50">
                  {countries.map(countryFlag).join(' ')}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function TopBrandsList({ period }: { period: string }) {
  const { data: brands = [] } = useBrands({ view: 'top', limit: 10, timeRange: period });

  return (
    <div className="space-y-2">
      {brands.map((brand, i) => (
        <div key={brand.id} className="flex items-center gap-3 py-1">
          <span className="font-mono text-[10px] text-white/50 w-4">{i + 1}</span>
          <img
            src={`https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=32`}
            alt=""
            className="w-4 h-4"
          />
          <span className="text-xs text-parchment/80 flex-1 truncate">{brand.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <BIMIGradeBadge grade={brand.bimi_grade} size="sm" />
            <span className={cn(
              'font-mono text-xs font-bold tabular-nums',
              brand.threat_count >= 100 ? 'text-red-400 glow-red' :
              brand.threat_count >= 20 ? 'text-amber-400' : 'text-parchment'
            )}>
              {brand.threat_count}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileTopBrandsList({ period }: { period: string }) {
  const { data: brands = [] } = useBrands({ view: 'top', limit: 8, timeRange: period });

  if (brands.length === 0) {
    return <div className="text-[10px] text-white/40 font-mono py-2">Loading brands...</div>;
  }

  return (
    <div className="space-y-1">
      {brands.map((brand, i) => (
        <div key={brand.id} className="flex items-center gap-2 py-1">
          <span className="font-mono text-[10px] text-white/50 w-4 flex-shrink-0">{i + 1}</span>
          <img
            src={`https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=32`}
            alt=""
            className="w-3.5 h-3.5 flex-shrink-0"
          />
          <span className="font-mono text-[11px] text-parchment/80 flex-1 truncate">{brand.name}</span>
          <span className={cn(
            'font-mono text-[11px] font-bold tabular-nums flex-shrink-0',
            brand.threat_count >= 100 ? 'text-red-400' :
            brand.threat_count >= 20 ? 'text-amber-400' : 'text-parchment/60'
          )}>
            {brand.threat_count}
          </span>
        </div>
      ))}
    </div>
  );
}

function TopProvidersList({ period }: { period: string }) {
  const { data } = useProviders({ view: 'worst', limit: 5, timeRange: period });
  const providers = data || [];

  return (
    <div className="space-y-2">
      {providers.map(provider => (
        <div key={provider.id} className="py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-parchment/80 truncate">{provider.name}</span>
            <span className="font-mono text-xs font-bold text-accent tabular-nums">{provider.active_threat_count}</span>
          </div>
          <div className="font-mono text-[9px] text-white/50">{provider.asn}</div>
          {provider.trend_7d != null && provider.trend_7d !== 0 && (
            <span className={cn(
              'font-mono text-[9px]',
              (provider.trend_7d ?? 0) > 0 ? 'text-accent' : 'text-positive'
            )}>
              {(provider.trend_7d ?? 0) > 0 ? '+' : ''}{(provider.trend_7d ?? 0).toFixed(1)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function AgentIntelFeed() {
  const { data: agents } = useAgents();
  const recentOutputs = (agents || [])
    .filter(a => a.last_output_at)
    .sort((a, b) => new Date(b.last_output_at!).getTime() - new Date(a.last_output_at!).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-3">
      {recentOutputs.map(agent => (
        <div key={agent.agent_id} className="text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono font-bold uppercase" style={{ color: agent.color }}>
              {agent.display_name}
            </span>
            <Badge variant={agent.status === 'active' ? 'success' : 'default'}>
              {agent.last_run_status || 'idle'}
            </Badge>
          </div>
          <div className="text-contrail/50">
            {agent.outputs_24h} outputs &middot; {relativeTime(agent.last_output_at)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActiveOperationsPanel() {
  const { data: operations = [] } = useQuery({
    queryKey: ['observatory-operations'],
    queryFn: async () => {
      const res = await api.get<Operation[]>('/api/observatory/operations?status=active&limit=5');
      return res.data ?? [];
    },
    refetchInterval: 60_000,
  });

  if (operations.length === 0) {
    return (
      <EmptyState
        icon={<Activity />}
        title="No active operations"
        subtitle="Operations will appear as the pipeline processes new threats"
        variant="scanning"
        compact
      />
    );
  }

  return (
    <div className="space-y-2">
      {operations.slice(0, 5).map(op => (
        <div key={op.id} className="py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-parchment/80 truncate flex-1 mr-2">
              {op.cluster_name || `Cluster ${op.id.slice(0, 8)}`}
            </span>
            <span className="font-mono text-[10px] font-bold text-accent tabular-nums">{op.threat_count}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {op.status === 'active' && (op.confidence_score ?? 0) >= 70 && (
              <span className="badge-glass badge-accelerating font-mono text-[9px]">
                ACCELERATING
              </span>
            )}
            {op.agent_notes?.toLowerCase().includes('pivot') && (
              <span className="badge-glass badge-pivot font-mono text-[9px]">
                PIVOT
              </span>
            )}
            {op.countries && (
              <span className="font-mono text-[9px] text-white/50 truncate">
                {(() => { try { return (JSON.parse(op.countries) as string[]).slice(0, 3).join(', '); } catch { return ''; } })()}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface LiveThreatEntry {
  id: string;
  threat_type: string;
  severity: string | null;
  country_code: string | null;
  created_at: string;
  malicious_domain: string | null;
}

const SEVERITY_DOT_COLORS: Record<string, string> = {
  critical: 'dot-pulse-red',
  high: 'dot-pulse-amber',
  medium: 'bg-yellow-400',
  low: 'dot-pulse-teal',
};

function LiveThreatFeed() {
  const { data: entries = [] } = useQuery({
    queryKey: ['observatory-live-feed'],
    queryFn: async () => {
      const res = await api.get<LiveThreatEntry[]>('/api/observatory/live?limit=8');
      return res.data ?? [];
    },
    refetchInterval: 15_000,
  });

  if (entries.length === 0) {
    return <div className="text-[10px] text-white/40 font-mono">Waiting for threats...</div>;
  }

  return (
    <div className="space-y-1.5">
      {entries.slice(0, 8).map(entry => (
        <div key={entry.id} className="flex items-center gap-2 py-0.5 animate-fade-in">
          <span className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            SEVERITY_DOT_COLORS[entry.severity?.toLowerCase() ?? ''] ?? 'bg-blue-400'
          )} />
          <span className="font-mono text-[10px] text-parchment/70 truncate flex-1">
            {entry.threat_type?.replace(/_/g, ' ')}
          </span>
          {entry.country_code && (
            <span className="font-mono text-[9px] text-white/55">{entry.country_code}</span>
          )}
          <span className="font-mono text-[9px] text-white/50 flex-shrink-0">
            {relativeTime(entry.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

