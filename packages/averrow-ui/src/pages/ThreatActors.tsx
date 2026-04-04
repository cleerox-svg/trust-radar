import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '@/components/brands/StatCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useThreatActors, useThreatActorStats } from '@/hooks/useThreatActors';
import type { ThreatActor } from '@/hooks/useThreatActors';

// ─── Helpers ──────────────────────────────────────────────────

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65),
  );
}

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try { return JSON.parse(val) as string[]; }
  catch { return []; }
}

// ─── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-signal-red/20 text-red-400 border-signal-red/30',
    dormant: 'bg-white/5 text-gauge-gray border-white/10',
    disrupted: 'bg-green-500/20 text-green-400 border-green-500/30',
    unknown: 'bg-white/5 text-gauge-gray border-white/10',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${colors[status] ?? colors.unknown}`}>
      {status}
    </span>
  );
}


// ─── Actor Row ────────────────────────────────────────────────

function ActorRow({ actor, onClick }: { actor: ThreatActor; onClick: () => void }) {
  const aliases = parseJsonArray(actor.aliases);
  const ttps = parseJsonArray(actor.ttps);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-white/10 bg-instrument-panel p-4 hover:border-afterburner/30 hover:bg-panel-highlight transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-instrument-white font-semibold">{actor.name}</span>
            <StatusBadge status={actor.status} />
          </div>
          {aliases.length > 0 && (
            <div className="text-[10px] text-gauge-gray font-mono mb-1">
              AKA: {aliases.join(', ')}
            </div>
          )}
          {actor.description && (
            <p className="text-[11px] text-white/60 line-clamp-2 mt-1">{actor.description}</p>
          )}
          {ttps.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ttps.slice(0, 4).map(ttp => (
                <span key={ttp} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-gauge-gray border border-white/5">
                  {ttp.replace(/_/g, ' ')}
                </span>
              ))}
              {ttps.length > 4 && (
                <span className="font-mono text-[9px] text-gauge-gray">+{ttps.length - 4}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{countryFlag(actor.country)}</span>
            <span className="font-mono text-[10px] text-gauge-gray">{actor.attribution ?? 'Unknown'}</span>
          </div>
          <div className="flex gap-3 mt-1">
            <span className="font-mono text-[10px] text-white/40">{actor.infra_count ?? 0} infra</span>
            <span className="font-mono text-[10px] text-white/40">{actor.target_count ?? 0} targets</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export function ThreatActors() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'IR' | 'RU' | 'CN' | 'KP'>('all');
  const country = filter === 'all' ? undefined : filter;

  const { data: actors, isLoading } = useThreatActors({ country, status: 'active' });
  const { data: stats } = useThreatActorStats();

  // Fallback: compute attribution groups from actors list if stats.by_attribution is empty
  const attributionGroups = useMemo(() => {
    if (stats?.by_attribution && stats.by_attribution.length > 0) return stats.by_attribution;
    if (!actors?.length) return [];
    const grouped = new Map<string, number>();
    for (const a of actors) {
      const key = a.attribution || 'Unknown';
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    return Array.from(grouped.entries()).map(([attribution, count]) => ({ attribution, count }));
  }, [stats?.by_attribution, actors]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-mono font-bold text-instrument-white tracking-tight">
          Threat Actors
        </h1>
        <p className="text-[11px] text-gauge-gray mt-1">
          State-sponsored and organized threat actor profiles — infrastructure, TTPs, and targeted brands
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="TRACKED ACTORS"
          metric={<span className="text-[32px] font-bold leading-none text-signal-red">{stats?.total ?? 0}</span>}
          metricLabel="total"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-signal-red" />
            <span className="text-[11px] text-white/60">Active</span>
            <span className="text-[11px] font-mono text-instrument-white">{stats?.active ?? 0}</span>
          </div>
        </StatCard>
        <StatCard
          title="INFRASTRUCTURE"
          metric={<span className="text-[32px] font-bold leading-none text-afterburner">{stats?.tracked_infrastructure ?? 0}</span>}
          metricLabel="tracked"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-afterburner" />
            <span className="text-[11px] text-white/60">ASNs / IPs / Domains</span>
          </div>
        </StatCard>
        <StatCard
          title="TARGETED BRANDS"
          metric={<span className="text-[32px] font-bold leading-none text-[#f87171]">{stats?.targeted_brands ?? 0}</span>}
          metricLabel="brands"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f87171]" />
            <span className="text-[11px] text-white/60">In crosshairs</span>
          </div>
        </StatCard>
        <StatCard
          title="BY ATTRIBUTION"
          metric={<span className="text-[32px] font-bold leading-none text-wing-blue">{attributionGroups.length}</span>}
          metricLabel="groups"
        >
          <div className="space-y-1">
            {attributionGroups.slice(0, 3).map(a => (
              <div key={a.attribution} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-wing-blue" />
                <span className="text-[11px] text-white/60">{a.attribution || 'Unknown'}</span>
                <span className="text-[11px] font-mono text-instrument-white">{a.count}</span>
              </div>
            ))}
          </div>
        </StatCard>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-gauge-gray">Origin:</span>
        {(['all', 'IR', 'RU', 'CN', 'KP'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 font-mono text-[10px] transition-all ${
              filter === f
                ? 'border-afterburner/50 bg-afterburner/10 text-afterburner'
                : 'border-white/10 bg-white/5 text-gauge-gray hover:border-white/20'
            }`}
          >
            {f === 'all' ? 'All' : `${countryFlag(f)} ${f}`}
          </button>
        ))}
      </div>

      {/* Actor List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : actors && actors.length > 0 ? (
        <div className="space-y-3">
          {actors.map(actor => (
            <ActorRow
              key={actor.id}
              actor={actor}
              onClick={() => navigate(`/threat-actors/${actor.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-instrument-panel p-12 text-center">
          <p className="text-gauge-gray font-mono text-sm">No threat actors found for this filter.</p>
        </div>
      )}
    </div>
  );
}
