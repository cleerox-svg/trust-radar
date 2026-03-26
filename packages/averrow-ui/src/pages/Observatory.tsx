import { useState } from 'react';
import { useObservatoryThreats, useObservatoryStats, useObservatoryArcs } from '@/hooks/useObservatory';
import { ThreatMap } from '@/components/observatory/ThreatMap';
import { cn } from '@/lib/cn';

const PERIODS = [
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
];

const SOURCES = [
  { id: 'all', label: 'All' },
  { id: 'feeds', label: 'Feeds' },
  { id: 'spam_trap', label: 'Spam Trap' },
];

export function Observatory() {
  const [period, setPeriod] = useState('7d');
  const [source, setSource] = useState('all');
  const [showArcs, setShowArcs] = useState(true);
  const [showNodes, setShowNodes] = useState(true);
  const [colorBy, setColorBy] = useState<'severity' | 'type'>('severity');

  const { data: threats = [] } = useObservatoryThreats({ period, source });
  const { data: stats } = useObservatoryStats({ period, source });
  const { data: arcs = [] } = useObservatoryArcs({ period, source });

  return (
    <div className="relative h-[calc(100vh-3rem)] -m-6 overflow-hidden">
      {/* Full-screen map */}
      <ThreatMap
        threats={threats}
        arcs={arcs}
        showArcs={showArcs}
        showNodes={showNodes}
        colorBy={colorBy}
      />

      {/* Top-left: Stats overlay */}
      <div className="absolute top-4 left-4 z-10 flex gap-3">
        {stats && (
          <>
            <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3">
              <div className="font-display text-2xl font-extrabold text-parchment">
                {stats.active_threats?.toLocaleString()}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-contrail/50">
                Active Threats
              </div>
            </div>
            <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3">
              <div className="font-display text-2xl font-extrabold text-accent">{stats.countries}</div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-contrail/50">Countries</div>
            </div>
            <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3">
              <div className="font-display text-2xl font-extrabold text-contrail">
                {stats.brands_affected}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-contrail/50">
                Brands Affected
              </div>
            </div>
            <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3">
              <div className="font-display text-2xl font-extrabold text-warning">{stats.threats_24h}</div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-contrail/50">Last 24H</div>
            </div>
          </>
        )}
      </div>

      {/* Top-right: Controls overlay */}
      <div className="absolute top-4 right-16 z-10 flex flex-col gap-2">
        {/* Period selector */}
        <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg p-1.5 flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                'font-mono text-[10px] font-bold px-3 py-1 rounded transition-all',
                period === p.id
                  ? 'bg-accent text-white'
                  : 'text-contrail/50 hover:text-parchment hover:bg-white/5'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg p-1.5 flex gap-1">
          {SOURCES.map(s => (
            <button
              key={s.id}
              onClick={() => setSource(s.id)}
              className={cn(
                'font-mono text-[10px] font-bold px-3 py-1 rounded transition-all',
                source === s.id
                  ? 'bg-contrail/20 text-contrail'
                  : 'text-contrail/40 hover:text-parchment hover:bg-white/5'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Layer toggles */}
        <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg p-2 space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showNodes}
              onChange={e => setShowNodes(e.target.checked)}
              className="accent-accent w-3 h-3"
            />
            <span className="font-mono text-[10px] text-contrail/60">Nodes</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showArcs}
              onChange={e => setShowArcs(e.target.checked)}
              className="accent-accent w-3 h-3"
            />
            <span className="font-mono text-[10px] text-contrail/60">Arcs</span>
          </label>
        </div>

        {/* Color mode */}
        <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg p-1.5 flex gap-1">
          <button
            onClick={() => setColorBy('severity')}
            className={cn(
              'font-mono text-[10px] px-2 py-1 rounded',
              colorBy === 'severity' ? 'bg-accent/20 text-accent' : 'text-contrail/40'
            )}
          >
            Severity
          </button>
          <button
            onClick={() => setColorBy('type')}
            className={cn(
              'font-mono text-[10px] px-2 py-1 rounded',
              colorBy === 'type' ? 'bg-accent/20 text-accent' : 'text-contrail/40'
            )}
          >
            Type
          </button>
        </div>
      </div>

      {/* Bottom-right: LIVE indicator */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="bg-cockpit/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <span className="font-mono text-[10px] font-bold text-positive">LIVE</span>
          <span className="font-mono text-[10px] text-contrail/40">
            {threats.length.toLocaleString()} threats
          </span>
        </div>
      </div>

      {/* Bottom-left: Legend */}
      <div className="absolute bottom-4 left-4 z-10">
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
                <LegendItem color="rgb(232,146,60)" label="Typosquatting" />
                <LegendItem color="rgb(180,60,60)" label="Malware" />
                <LegendItem color="rgb(200,80,120)" label="Credential" />
                <LegendItem color="rgb(120,80,200)" label="Impersonation" />
              </>
            )}
          </div>
        </div>
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
