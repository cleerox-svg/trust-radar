import { useState, useEffect, useCallback } from 'react';
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
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useBreakpoint } from '@/hooks/useBreakpoint';

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
  const [mobileBrandsOpen, setMobileBrandsOpen] = useState(false);
  const [clock, setClock] = useState('');
  const [mapMode, setMapMode] = useState<MapMode>('global');

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
    <div className="relative h-[calc(100vh-3rem)] -m-6 overflow-hidden">
      {/* Full-screen map */}
      <div className="absolute inset-0 bottom-[84px]">
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
      </div>

      {/* Top-left: Mode switcher + Period selector + Color mode */}
      {isMobile ? (
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-1.5">
          {/* Row 1: Mode tabs — horizontally scrollable pills */}
          <div className="overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex gap-2 flex-nowrap w-max">
              {MAP_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMapMode(m.id)}
                  className={cn(
                    'font-mono text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap transition-all',
                    mapMode === m.id
                      ? 'bg-orbital-teal/20 text-orbital-teal border border-orbital-teal/60'
                      : 'bg-cockpit/80 text-white/60 border border-white/10 backdrop-blur-sm'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {/* Row 2: Period + Color + Source — horizontally scrollable pills */}
          <div className="overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex gap-2 flex-nowrap w-max">
              {PERIODS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={cn(
                    'font-mono text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap transition-all',
                    period === p.id
                      ? 'bg-orbital-teal/20 text-orbital-teal border border-orbital-teal/60'
                      : 'bg-cockpit/80 text-white/60 border border-white/10 backdrop-blur-sm'
                  )}
                >
                  {p.label}
                </button>
              ))}
              <span className="w-px bg-white/10 self-stretch flex-shrink-0" />
              {mapMode === 'global' && (
                <>
                  {(['severity', 'type'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setColorBy(c)}
                      className={cn(
                        'font-mono text-xs px-3 py-1 rounded-full whitespace-nowrap transition-all capitalize',
                        colorBy === c
                          ? 'bg-orbital-teal/20 text-orbital-teal border border-orbital-teal/60'
                          : 'bg-cockpit/80 text-white/60 border border-white/10 backdrop-blur-sm'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                  <span className="w-px bg-white/10 self-stretch flex-shrink-0" />
                </>
              )}
              {SOURCES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSource(s.id)}
                  className={cn(
                    'font-mono text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap transition-all',
                    source === s.id
                      ? 'bg-orbital-teal/20 text-orbital-teal border border-orbital-teal/60'
                      : 'bg-cockpit/80 text-white/60 border border-white/10 backdrop-blur-sm'
                  )}
                >
                  {s.label}
                </button>
              ))}
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

      {/* Bottom-left: Legend */}
      {mapMode === 'global' && (
        <div className="absolute bottom-[100px] left-4 z-10">
          <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg p-3">
            <div className="font-mono text-[9px] text-contrail/40 uppercase tracking-wider mb-2">
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
      )}

      {/* Heatmap legend (bottom-left) */}
      {mapMode === 'heatmap' && (
        <div className="absolute bottom-[100px] left-4 z-10">
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
      <div className="absolute bottom-[100px] right-4 z-10">
        <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <span className="live-indicator">LIVE</span>
          <span className="font-mono text-[10px] text-contrail/40 tabular-nums">
            {threats.length.toLocaleString()} threats
          </span>
        </div>
      </div>

      {/* Event ticker — self-positions with fixed at bottom */}
      <EventTicker />

      {/* Bottom stats bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-cockpit/95 backdrop-blur-sm border-t border-white/5">
        <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3">
          {/* Mode label */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="section-label">
              {mapMode === 'global' ? 'GLOBAL THREAT MAP' : mapMode === 'operations' ? 'OPERATIONS MAP' : 'DENSITY HEATMAP'}
            </span>
          </div>

          {/* Stats chips */}
          <div className="flex items-center gap-3 md:gap-6 overflow-x-auto scrollbar-none">
            {stats && (
              <>
                <StatChip value={stats.threats_mapped} label={isMobile ? 'Threats' : 'Threats Mapped'} color="text-accent" />
                <StatChip value={stats.countries} label="Countries" color="text-contrail" />
                <div className="hidden md:block">
                  <StatChip value={stats.active_campaigns} label="Active Campaigns" color="text-warning" />
                </div>
                <div className="hidden md:block">
                  <StatChip value={stats.brands_monitored} label="Brands Monitored" color="text-positive" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
          <div className="font-mono text-[10px] text-contrail/40 mb-2">
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

      {/* ─── Mobile bottom brands panel ─── */}
      {isMobile && mapMode === 'global' && (
        <div className={cn(
          'absolute left-0 right-0 z-20 md:hidden transition-all duration-300 ease-in-out',
          mobileBrandsOpen ? 'bottom-[84px]' : 'bottom-[84px]'
        )}>
          {/* Handle / toggle bar */}
          <button
            onClick={() => setMobileBrandsOpen(!mobileBrandsOpen)}
            className="w-full flex items-center justify-center gap-2 bg-cockpit/90 backdrop-blur-sm border-t border-x border-cyan-800/30 rounded-t-xl px-4 py-2"
          >
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-orbital-teal">
              Top Brands
            </span>
            <span className={cn(
              'font-mono text-[10px] text-orbital-teal transition-transform duration-300',
              mobileBrandsOpen ? 'rotate-180' : ''
            )}>
              ▲
            </span>
          </button>
          {/* Expandable brand list */}
          <div className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out bg-cockpit/90 backdrop-blur-sm border-x border-cyan-800/30',
            mobileBrandsOpen ? 'max-h-72' : 'max-h-0'
          )}>
            <div className="overflow-y-auto max-h-72 px-3 py-2">
              <MobileTopBrandsList period={period} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Desktop sidebar backdrop (no longer used on mobile) ─── */}

      {/* ─── Right sidebar panel (desktop only) ─── */}
      {!isMobile && showPanel && mapMode !== 'heatmap' && (
        <div className="absolute top-0 right-0 bottom-[84px] z-20 w-80 bg-cockpit/95 backdrop-blur-sm border-l border-white/5 overflow-y-auto">
          {/* Mode-aware header */}
          {mapMode === 'global' && (
            <>
              <div className="p-4 border-b border-white/5">
                <div className="section-label font-mono font-bold mb-3">
                  Top Targeted Brands
                </div>
                <TopBrandsList period={period} />
              </div>
              <div className="p-4 border-b border-white/5">
                <div className="section-label font-mono font-bold mb-3">
                  Hosting Providers
                </div>
                <TopProvidersList period={period} />
              </div>
              <div className="p-4 border-b border-white/5">
                <div className="section-label font-mono font-bold mb-3">
                  Agent Intelligence
                </div>
                <AgentIntelFeed />
              </div>
              <div className="p-4 border-b border-white/5">
                <div className="section-label font-mono font-bold mb-3">
                  Active Operations
                </div>
                <ActiveOperationsPanel />
              </div>
              <div className="p-4">
                <div className="section-label font-mono font-bold mb-3">
                  Live Feed
                </div>
                <LiveThreatFeed />
              </div>
            </>
          )}

          {mapMode === 'operations' && (
            <div className="p-4">
              <div className="section-label font-mono font-bold mb-3">
                Active Operations
              </div>
              <OperationsClusterList
                operations={operations}
                onSelect={(op) => {
                  const countries = parseJsonArray(op.countries);
                  const pos = countries.length > 0 ? countries[0] : '';
                  setClickedCluster({ cluster: op, x: window.innerWidth / 2 - 160, y: 100 });
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Panel toggle button (desktop only) */}
      {!isMobile && mapMode !== 'heatmap' && (
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="absolute top-1/2 z-30 transform -translate-y-1/2 bg-cockpit/90 border border-white/10 rounded-l-lg px-1 py-3 text-contrail/40 hover:text-parchment"
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
        <div className={cn('font-display text-lg font-extrabold tabular-nums', color)}>{(value ?? 0).toLocaleString()}</div>
        <div className="font-mono text-[9px] text-contrail/40 uppercase">{label}</div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-mono text-[10px] text-contrail/60">{label}</span>
    </div>
  );
}

function OperationsClusterList({ operations, onSelect }: { operations: Operation[]; onSelect: (op: Operation) => void }) {
  if (operations.length === 0) {
    return <div className="text-[10px] text-contrail/30 font-mono">No active operations</div>;
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
            className="w-full text-left rounded-lg p-2.5 transition-all glass-card hover:border-orbital-teal/30"
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
                <span className="font-mono text-[10px] text-white/30">
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
          <span className="font-mono text-[10px] text-contrail/30 w-4">{i + 1}</span>
          <img
            src={`https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=32`}
            alt=""
            className="w-4 h-4"
          />
          <span className="text-xs text-parchment/80 flex-1 truncate">{brand.name}</span>
          <span className={cn(
            'font-mono text-xs font-bold tabular-nums',
            brand.threat_count >= 100 ? 'text-red-400 glow-red' :
            brand.threat_count >= 20 ? 'text-amber-400' : 'text-parchment'
          )}>
            {brand.threat_count}
          </span>
        </div>
      ))}
    </div>
  );
}

function MobileTopBrandsList({ period }: { period: string }) {
  const { data: brands = [] } = useBrands({ view: 'top', limit: 8, timeRange: period });

  if (brands.length === 0) {
    return <div className="text-[10px] text-contrail/30 font-mono py-2">Loading brands...</div>;
  }

  return (
    <div className="space-y-1">
      {brands.map((brand, i) => (
        <div key={brand.id} className="flex items-center gap-2 py-1">
          <span className="font-mono text-[10px] text-contrail/40 w-4 flex-shrink-0">{i + 1}</span>
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
          <div className="font-mono text-[9px] text-contrail/30">{provider.asn}</div>
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
    return <div className="text-[10px] text-contrail/30 font-mono">No active operations</div>;
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
              <span className="font-mono text-[9px] text-contrail/30 truncate">
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
    return <div className="text-[10px] text-contrail/30 font-mono">Waiting for threats...</div>;
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
            <span className="font-mono text-[9px] text-contrail/40">{entry.country_code}</span>
          )}
          <span className="font-mono text-[9px] text-contrail/30 flex-shrink-0">
            {relativeTime(entry.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

