import { useState, useEffect } from 'react';
import { useObservatoryThreats, useObservatoryStats, useObservatoryArcs } from '@/hooks/useObservatory';
import { ThreatMap } from '@/components/observatory/ThreatMap';
import { useBrands } from '@/hooks/useBrands';
import { useProviders } from '@/hooks/useProviders';
import { useAgents } from '@/hooks/useAgents';
import { useOperations } from '@/hooks/useOperations';
import { Badge } from '@/components/ui/Badge';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/cn';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

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

export function Observatory() {
  const [period, setPeriod] = useState('7d');
  const [source, setSource] = useState('all');
  const [showBeams, setShowBeams] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [showNodes, setShowNodes] = useState(true);
  const [colorBy, setColorBy] = useState<'severity' | 'type'>('severity');
  const [showPanel, setShowPanel] = useState(true);
  const [clock, setClock] = useState('');

  const { data: threats = [] } = useObservatoryThreats({ period, source });
  const { data: stats } = useObservatoryStats({ period, source });
  const { data: arcs = [] } = useObservatoryArcs({ period, source });

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
      {/* Full-screen map — account for bottom bar */}
      <div className="absolute inset-0 bottom-[52px]">
        <ThreatMap
          threats={threats}
          arcs={arcs}
          showBeams={showBeams}
          showParticles={showParticles}
          showNodes={showNodes}
          colorBy={colorBy}
        />
      </div>

      {/* Top-left: Period selector + color mode + layer toggles */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {/* Period selector */}
        <div className="bg-cockpit/90 backdrop-blur-sm rounded-lg p-1.5 flex gap-1" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                'font-mono text-[10px] font-bold px-3 py-1 rounded transition-all',
                period === p.id
                  ? 'glass-btn-active'
                  : 'glass-btn'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Color mode */}
        <div className="bg-cockpit/90 backdrop-blur-sm rounded-lg p-1.5 flex gap-1" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
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

        {/* Layer toggles — styled pill buttons */}
        <div className="bg-cockpit/90 backdrop-blur-sm rounded-lg p-1.5 flex gap-1" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
          <button
            onClick={() => setShowBeams(!showBeams)}
            className={cn(
              'font-mono text-[10px] font-bold px-3 py-1 rounded transition-all',
              showBeams ? 'glass-btn-active' : 'glass-btn'
            )}
          >
            Beams
          </button>
          <button
            onClick={() => setShowParticles(!showParticles)}
            className={cn(
              'font-mono text-[10px] font-bold px-3 py-1 rounded transition-all',
              showParticles ? 'glass-btn-active' : 'glass-btn'
            )}
          >
            Particles
          </button>
          <button
            onClick={() => setShowNodes(!showNodes)}
            className={cn(
              'font-mono text-[10px] font-bold px-3 py-1 rounded transition-all',
              showNodes ? 'glass-btn-active' : 'glass-btn'
            )}
          >
            Nodes
          </button>
        </div>
      </div>

      {/* Top-right: Live clock */}
      <div className="absolute top-4 right-16 z-10">
        <div className="font-mono text-accent text-lg font-bold">{clock}</div>
      </div>

      {/* Bottom-left: Legend */}
      <div className="absolute bottom-[68px] left-4 z-10">
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

      {/* Bottom-right: LIVE indicator */}
      <div className="absolute bottom-[68px] right-4 z-10">
        <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <span className="font-mono text-[10px] font-bold text-positive">LIVE</span>
          <span className="font-mono text-[10px] text-contrail/40">
            {threats.length.toLocaleString()} threats
          </span>
        </div>
      </div>

      {/* Bottom stats bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-cockpit/95 backdrop-blur-sm border-t border-white/5">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Source filter */}
          <div className="flex items-center gap-1">
            {SOURCES.map(s => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={cn(
                  'font-mono text-[11px] font-bold px-3 py-1 rounded transition-all',
                  source === s.id ? 'text-parchment' : 'text-contrail/40 hover:text-parchment'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Stats chips */}
          <div className="flex items-center gap-6">
            {stats && (
              <>
                <StatChip value={stats.threats_mapped} label="Threats Mapped" color="text-accent" />
                <StatChip value={stats.countries} label="Countries" color="text-contrail" />
                <StatChip value={stats.active_campaigns} label="Active Campaigns" color="text-warning" />
                <StatChip value={stats.brands_monitored} label="Brands Monitored" color="text-positive" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right sidebar panel */}
      {showPanel && (
        <div className="absolute top-0 right-0 bottom-[52px] w-80 z-10 bg-cockpit/95 backdrop-blur-sm border-l border-white/5 overflow-y-auto">
          {/* Top Targeted Brands */}
          <div className="p-4 border-b border-white/5">
            <div className="section-label font-mono font-bold mb-3">
              Top Targeted Brands
            </div>
            <TopBrandsList period={period} />
          </div>

          {/* Hosting Providers */}
          <div className="p-4 border-b border-white/5">
            <div className="section-label font-mono font-bold mb-3">
              Hosting Providers
            </div>
            <TopProvidersList period={period} />
          </div>

          {/* Agent Intelligence */}
          <div className="p-4 border-b border-white/5">
            <div className="section-label font-mono font-bold mb-3">
              Agent Intelligence
            </div>
            <AgentIntelFeed />
          </div>

          {/* Active Operations */}
          <div className="p-4 border-b border-white/5">
            <div className="section-label font-mono font-bold mb-3">
              Active Operations
            </div>
            <ActiveOperationsPanel />
          </div>

          {/* Live Feed */}
          <div className="p-4">
            <div className="section-label font-mono font-bold mb-3">
              Live Feed
            </div>
            <LiveThreatFeed />
          </div>
        </div>
      )}
      {/* Panel toggle button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="absolute top-1/2 z-20 transform -translate-y-1/2 bg-cockpit/90 border border-white/10 rounded-l-lg px-1 py-3 text-contrail/40 hover:text-parchment"
        style={showPanel ? { right: '320px' } : { right: 0 }}
      >
        {showPanel ? '\u203A' : '\u2039'}
      </button>
    </div>
  );
}

function StatChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div>
        <div className={cn('font-display text-lg font-extrabold', color)}>{(value ?? 0).toLocaleString()}</div>
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
            'font-mono text-xs font-bold',
            brand.threat_count >= 100 ? 'text-red-400' :
            brand.threat_count >= 20 ? 'text-amber-400' : 'text-parchment'
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
            <span className="font-mono text-xs font-bold text-accent">{provider.active_threat_count}</span>
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
  const { data: operations = [] } = useOperations({ status: 'active', limit: 5 });

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
            <span className="font-mono text-[10px] font-bold text-accent">{op.threat_count}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {op.status === 'active' && (op.confidence_score ?? 0) >= 70 && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                ACCELERATING
              </span>
            )}
            {op.agent_notes?.toLowerCase().includes('pivot') && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
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
  critical: 'bg-red-400',
  high: 'bg-amber-400',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400',
};

function LiveThreatFeed() {
  const { data: entries = [] } = useQuery({
    queryKey: ['observatory-live-feed'],
    queryFn: async () => {
      const res = await api.get<LiveThreatEntry[]>('/api/threats/recent?limit=8');
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
