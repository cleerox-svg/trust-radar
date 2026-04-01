import { useParams, useNavigate } from 'react-router-dom';
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
  try { return JSON.parse(val) as string[]; }
  catch { return []; }
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
  const ttps = parseJsonArray(actor.primary_ttps);

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
          <span className="text-lg">{countryFlag(actor.country_code)}</span>
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
          title="AFFILIATION"
          metric={<span className="text-[28px] font-bold leading-none text-signal-red">{actor.affiliation ?? '?'}</span>}
          metricLabel="state sponsor"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-signal-red" />
              <span className="text-[11px] text-white/60">Group</span>
              <span className="text-[11px] font-mono text-instrument-white">{actor.affiliation ?? 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-afterburner" />
              <span className="text-[11px] text-white/60">Confidence</span>
              <span className="text-[11px] font-mono text-instrument-white">{actor.attribution_confidence}</span>
            </div>
          </div>
        </StatCard>
        <StatCard
          title="CAPABILITY"
          metric={<span className="text-[24px] font-bold leading-none text-afterburner">{(actor.capability ?? '?').replace(/_/g, ' ')}</span>}
          metricLabel="type"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-afterburner" />
            <span className="text-[11px] text-white/60">Primary</span>
            <span className="text-[11px] font-mono text-instrument-white">{(actor.capability ?? 'unknown').replace(/_/g, ' ')}</span>
          </div>
        </StatCard>
        <StatCard
          title="INFRASTRUCTURE"
          metric={<span className="text-[32px] font-bold leading-none text-wing-blue">{actor.infrastructure?.length ?? 0}</span>}
          metricLabel="tracked"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-wing-blue" />
            <span className="text-[11px] text-white/60">Tracked ASNs/IPs/Domains</span>
          </div>
        </StatCard>
        <StatCard
          title="LINKED THREATS"
          metric={<span className="text-[32px] font-bold leading-none text-[#f87171]">{actor.linked_threat_count}</span>}
          metricLabel="threats"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f87171]" />
            <span className="text-[11px] text-white/60">From known ASNs</span>
          </div>
        </StatCard>
      </div>

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
