import { useParams, useNavigate, Link } from 'react-router-dom';
import { StatCard } from '@/components/brands/StatCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useThreatActorDetail } from '@/hooks/useThreatActors';

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65),
  );
}

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed as string[];
    return [];
  } catch {
    // Fallback: treat as comma-separated string
    return val.split(',').map(s => s.trim()).filter(Boolean);
  }
}

export function ThreatActorDetail() {
  const { actorId } = useParams<{ actorId: string }>();
  const navigate = useNavigate();
  const { data: actor, isLoading } = useThreatActorDetail(actorId ?? '');

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!actor) {
    return (
      <div className="p-6">
        <p className="text-gauge-gray font-mono">Threat actor not found.</p>
      </div>
    );
  }

  const aliases = parseJsonArray(actor.aliases);
  const ttps = parseJsonArray(actor.ttps);
  const sectors = parseJsonArray(actor.target_sectors);

  // Parse active_campaigns — may be JSON array of strings, objects with id/name, or comma-separated
  const campaigns = (() => {
    const raw = actor.active_campaigns;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item: unknown) => {
          if (typeof item === 'string') return { id: null, name: item };
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            return { id: (obj.id as string) ?? null, name: (obj.name as string) ?? String(obj.id ?? 'Unknown') };
          }
          return { id: null, name: String(item) };
        });
      }
      return [];
    } catch {
      return raw.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ id: null, name }));
    }
  })();

  return (
    <div className="p-6 space-y-6">
      {/* Back nav */}
      <button
        onClick={() => navigate('/threat-actors')}
        className="text-[11px] text-gauge-gray hover:text-instrument-white font-mono transition-colors"
      >
        &larr; Back to Threat Actors
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-mono font-bold text-instrument-white">{actor.name}</h1>
          <span className="text-lg">{countryFlag(actor.country)}</span>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
            actor.status === 'active' ? 'bg-signal-red/20 text-red-400 border-signal-red/30' : 'bg-white/5 text-gauge-gray border-white/10'
          }`}>
            {actor.status}
          </span>
        </div>
        {aliases.length > 0 && (
          <p className="text-[11px] text-gauge-gray font-mono mt-1">
            Also known as: {aliases.join(', ')}
          </p>
        )}
        {actor.description && (
          <p className="text-[12px] text-white/70 mt-2 max-w-3xl leading-relaxed">{actor.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="ATTRIBUTION"
          metric={<span className="text-lg sm:text-[28px] font-bold leading-none text-signal-red">{actor.attribution ?? '?'}</span>}
          metricLabel="state sponsor"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-signal-red" />
              <span className="text-[11px] text-white/60">Attribution</span>
              <span className="text-[11px] font-mono text-instrument-white">{actor.attribution ?? 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-afterburner" />
              <span className="text-[11px] text-white/60">Country</span>
              <span className="text-[11px] font-mono text-instrument-white">{actor.country ?? 'Unknown'}</span>
            </div>
          </div>
        </StatCard>
        <StatCard
          title="TARGET SECTORS"
          metric={<span className="text-lg sm:text-[24px] font-bold leading-none text-afterburner">{sectors.length || 0}</span>}
          metricLabel="sectors"
        >
          {sectors.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {sectors.slice(0, 3).map(sector => (
                <span key={sector} className="text-[10px] px-1.5 py-0.5 rounded-full bg-wing-blue/10 border border-wing-blue/20 text-wing-blue">
                  {sector}
                </span>
              ))}
              {sectors.length > 3 && (
                <span className="text-[10px] text-white/40">+{sectors.length - 3}</span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-white/30">No sector data</span>
          )}
        </StatCard>
        <StatCard
          title="INFRASTRUCTURE"
          metric={<span className="text-xl sm:text-[32px] font-bold leading-none text-wing-blue">{actor.infrastructure?.length ?? 0}</span>}
          metricLabel="tracked"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-wing-blue" />
            <span className="text-[11px] text-white/60">Tracked ASNs/IPs/Domains</span>
          </div>
        </StatCard>
        <StatCard
          title="LINKED THREATS"
          metric={<span className="text-xl sm:text-[32px] font-bold leading-none text-[#f87171]">{actor.linked_threat_count}</span>}
          metricLabel="threats"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f87171]" />
            <span className="text-[11px] text-white/60">From known ASNs</span>
          </div>
        </StatCard>
      </div>

      {/* Campaigns */}
      {campaigns.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-instrument-panel p-4">
          <h2 className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3 flex items-center gap-2">
            Active Campaigns
            <span className="flex-1 h-px bg-white/[0.06]" />
          </h2>
          <div className="space-y-2">
            {campaigns.map((campaign, idx) => (
              campaign.id ? (
                <Link
                  key={campaign.id}
                  to={`/campaigns/${campaign.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10] transition-all group"
                >
                  <p className="text-instrument-white text-sm font-medium group-hover:text-afterburner transition-colors">
                    {campaign.name}
                  </p>
                  <span className="text-white/20 group-hover:text-afterburner transition-colors">&rarr;</span>
                </Link>
              ) : (
                <div
                  key={`${campaign.name}-${idx}`}
                  className="flex items-center p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                >
                  <p className="text-instrument-white text-sm">{campaign.name}</p>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* TTPs */}
      {ttps.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-instrument-panel p-4">
          <h2 className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3">
            Tactics, Techniques & Procedures
          </h2>
          <div className="flex flex-wrap gap-2">
            {ttps.map(ttp => (
              <span key={ttp} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[11px] text-instrument-white">
                {ttp.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Infrastructure */}
      {actor.infrastructure && actor.infrastructure.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-instrument-panel p-4">
          <h2 className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3">
            Known Infrastructure
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-gauge-gray text-left border-b border-white/10">
                  <th className="pb-2 pr-4">ASN</th>
                  <th className="pb-2 pr-4">Domain</th>
                  <th className="pb-2 pr-4">Country</th>
                  <th className="pb-2 pr-4">Confidence</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {actor.infrastructure.map(infra => (
                  <tr key={infra.id} className="border-b border-white/5 text-white/70">
                    <td className="py-2 pr-4">{infra.asn ?? '—'}</td>
                    <td className="py-2 pr-4">{infra.domain ?? '—'}</td>
                    <td className="py-2 pr-4">{countryFlag(infra.country_code)} {infra.country_code ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={
                        infra.confidence === 'confirmed' ? 'text-green-400' :
                        infra.confidence === 'high' ? 'text-afterburner' : 'text-gauge-gray'
                      }>
                        {infra.confidence}
                      </span>
                    </td>
                    <td className="py-2 text-white/50">{infra.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Targeted Brands */}
      {actor.targets && actor.targets.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-instrument-panel p-4">
          <h2 className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3">
            Targeted Brands ({actor.targets.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {actor.targets.map(target => (
              <button
                key={target.id}
                onClick={() => target.brand_id ? navigate(`/brands/${target.brand_id}`) : undefined}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:border-afterburner/30 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono text-instrument-white font-semibold">
                    {target.brand_name ?? target.sector ?? 'Unknown'}
                  </div>
                  {target.canonical_domain && (
                    <div className="text-[10px] text-gauge-gray">{target.canonical_domain}</div>
                  )}
                </div>
                {target.sector && (
                  <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-gauge-gray border border-white/5">
                    {target.sector}
                  </span>
                )}
              </button>
            ))}
          </div>
          {actor.targets[0]?.context && (
            <p className="text-[10px] text-white/40 mt-3 font-mono">
              Context: {actor.targets[0].context}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
