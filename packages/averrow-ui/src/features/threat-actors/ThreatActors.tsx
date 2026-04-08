import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  Badge,
  Card,
  FilterBar,
  PageHeader,
  SaasTechniqueBadge,
  StatCard,
  StatGrid,
} from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useThreatActors, useThreatActorStats } from '@/hooks/useThreatActors';
import type { ThreatActor } from '@/hooks/useThreatActors';
import { saasTechniquesForTtps } from '@/lib/saas-techniques';

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

function actorStatusBadge(status: string) {
  switch (status) {
    case 'active':    return <Badge severity="critical" label="Active"    size="xs" pulse />;
    case 'dormant':   return <Badge status="inactive"   label="Dormant"   size="xs" />;
    case 'disrupted': return <Badge status="healthy"    label="Disrupted" size="xs" />;
    default:          return <Badge status="inactive"   label={status}    size="xs" />;
  }
}

// ─── Attribution + TTP color maps ─────────────────────────────

const ATTRIBUTION_COLORS: Record<string, string> = {
  IRGC: 'var(--red)',
  GRU:  'var(--blue)',
  FSB:  'var(--blue)',
  SVR:  'var(--blue)',
  MSS:  'var(--sev-high)',
  RGB:  'var(--sev-medium)',
  APT:  'var(--amber)',
};

function attributionColor(attribution: string | null): string {
  if (!attribution) return 'var(--text-muted)';
  const upper = attribution.toUpperCase();
  for (const [key, color] of Object.entries(ATTRIBUTION_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return 'var(--text-tertiary)';
}

// High-signal MITRE ATT&CK techniques — phishing, ransomware, DDoS,
// supply chain, valid accounts, network sniffing.
const HIGH_SIGNAL_TTPS = ['T1566', 'T1486', 'T1498', 'T1195', 'T1078', 'T1040'];

function ttpColor(ttp: string): string {
  const code = ttp.split('.')[0];
  if (HIGH_SIGNAL_TTPS.includes(code)) return 'var(--sev-high)';
  return 'var(--text-muted)';
}

// ─── Actor Card ───────────────────────────────────────────────

function ActorCard({ actor, onClick }: { actor: ThreatActor; onClick: () => void }) {
  const aliases       = parseJsonArray(actor.aliases);
  const ttps          = parseJsonArray(actor.ttps);
  const sectors       = parseJsonArray(actor.target_sectors);
  const flag          = countryFlag(actor.country);
  const accColor      = attributionColor(actor.attribution);
  const isActive      = actor.status === 'active';
  const saasTechniques = saasTechniquesForTtps(ttps);

  return (
    <Card
      variant={isActive ? 'active' : 'base'}
      accent={isActive ? accColor : undefined}
      onClick={onClick}
      style={{ padding: '16px 20px', cursor: 'pointer' }}
    >
      {/* Header row: name + status + country */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 12, marginBottom: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Actor name + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 15, fontWeight: 900,
              color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
              letterSpacing: -0.3,
            }}>
              {actor.name}
            </span>
            {actorStatusBadge(actor.status)}
          </div>

          {/* Aliases */}
          {aliases.length > 0 && (
            <div style={{
              fontSize: 10, color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', marginTop: 3,
            }}>
              aka {aliases.slice(0, 3).join(', ')}
              {aliases.length > 3 && ` +${aliases.length - 3}`}
            </div>
          )}
        </div>

        {/* Right: flag + attribution */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'flex-end', gap: 4, flexShrink: 0,
        }}>
          {/* Country flag + code */}
          {actor.country && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 6,
              background: `${accColor}12`,
              border: `1px solid ${accColor}30`,
            }}>
              {flag && <span style={{ fontSize: 14 }}>{flag}</span>}
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-mono)',
                fontWeight: 800, letterSpacing: '0.14em',
                color: accColor, textTransform: 'uppercase',
              }}>
                {actor.country}
              </span>
            </div>
          )}

          {/* Attribution group */}
          {actor.attribution && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)',
              color: accColor, letterSpacing: '0.10em',
              textTransform: 'uppercase',
            }}>
              {actor.attribution}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {actor.description && (
        <p style={{
          fontSize: 12, color: 'var(--text-secondary)',
          lineHeight: 1.60, margin: '0 0 10px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        } as React.CSSProperties}>
          {actor.description}
        </p>
      )}

      {/* TTP pills */}
      {ttps.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {ttps.slice(0, 6).map(ttp => {
            const color = ttpColor(ttp);
            return (
              <span key={ttp} style={{
                fontSize: 9, fontFamily: 'var(--font-mono)',
                fontWeight: 700, letterSpacing: '0.08em',
                padding: '3px 7px', borderRadius: 5,
                background: `${color}10`,
                border: `1px solid ${color}30`,
                color,
              }}>
                {ttp}
              </span>
            );
          })}
          {ttps.length > 6 && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)', padding: '3px 4px',
            }}>
              +{ttps.length - 6}
            </span>
          )}
        </div>
      )}

      {/* SaaS attack techniques (PushSecurity taxonomy) derived from actor TTPs */}
      {saasTechniques.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {saasTechniques.slice(0, 4).map(t => (
            <SaasTechniqueBadge
              key={t.id}
              techniqueId={t.id}
              techniqueName={t.name}
              phase={t.phase}
              phaseLabel={t.phase_label}
              severity={t.severity}
              size="xs"
            />
          ))}
          {saasTechniques.length > 4 && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)', padding: '3px 4px',
            }}>
              +{saasTechniques.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Footer: infra / targets / sectors / last seen */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        paddingTop: 8,
        borderTop: '1px solid var(--border-base)',
        fontSize: 10, fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
      }}>
        {actor.infra_count != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ color: 'var(--blue)' }}>◈</span>
            <span>{actor.infra_count} infra</span>
          </div>
        )}
        {actor.target_count != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ color: 'var(--amber)' }}>◉</span>
            <span>{actor.target_count} targets</span>
          </div>
        )}
        {sectors.length > 0 && (
          <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sectors.slice(0, 3).join(' · ')}
          </div>
        )}
        {actor.last_seen && (
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            Last seen {new Date(actor.last_seen).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────

type CountryFilter = 'all' | 'IR' | 'RU' | 'CN' | 'KP';

export function ThreatActors() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CountryFilter>('all');
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

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'IR',  label: `${countryFlag('IR')} IR` },
    { value: 'RU',  label: `${countryFlag('RU')} RU` },
    { value: 'CN',  label: `${countryFlag('CN')} CN` },
    { value: 'KP',  label: `${countryFlag('KP')} KP` },
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Threat Actors"
        subtitle="State-sponsored and organized threat actor profiles — infrastructure, TTPs, and targeted brands"
      />

      {/* Stats */}
      <StatGrid cols={4}>
        <StatCard
          title="Tracked Actors"
          metric={stats?.total ?? 0}
          metricLabel="Total"
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--text-secondary)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--sev-critical)',
              boxShadow: '0 0 6px var(--sev-critical)',
            }} />
            <span>Active</span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)', fontWeight: 700,
            }}>
              {stats?.active ?? 0}
            </span>
          </div>
        </StatCard>

        <StatCard
          title="Infrastructure"
          metric={stats?.tracked_infrastructure ?? 0}
          metricLabel="Tracked"
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--text-secondary)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--amber)',
              boxShadow: '0 0 6px var(--amber)',
            }} />
            <span>ASNs / IPs / Domains</span>
          </div>
        </StatCard>

        <StatCard
          title="Targeted Brands"
          metric={stats?.targeted_brands ?? 0}
          metricLabel="Brands"
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--text-secondary)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--sev-critical)',
              boxShadow: '0 0 6px var(--sev-critical)',
            }} />
            <span>In crosshairs</span>
          </div>
        </StatCard>

        <StatCard
          title="By Attribution"
          metric={attributionGroups.length}
          metricLabel="Groups"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {attributionGroups.slice(0, 3).map(a => (
              <div key={a.attribution} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: 'var(--text-secondary)',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--blue)',
                  boxShadow: '0 0 6px var(--blue)',
                }} />
                <span>{a.attribution || 'Unknown'}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)', fontWeight: 700,
                  marginLeft: 'auto',
                }}>
                  {a.count}
                </span>
              </div>
            ))}
          </div>
        </StatCard>
      </StatGrid>

      {/* Filter bar */}
      <FilterBar
        filters={filterOptions}
        active={filter}
        onChange={(v) => setFilter(v as CountryFilter)}
      />

      {/* Actor List */}
      {isLoading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
          gap: 12,
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : actors && actors.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
          gap: 12,
        }}>
          {actors.map(actor => (
            <ActorCard
              key={actor.id}
              actor={actor}
              onClick={() => navigate(`/threat-actors/${actor.id}`)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Search />}
          title={`No ${filter !== 'all' ? filter + ' ' : ''}threat actors found`}
          subtitle="Try a different country filter or check back as attribution data updates"
          action={filter !== 'all' ? { label: 'Show all actors', onClick: () => setFilter('all') } : undefined}
          variant="clean"
        />
      )}
    </div>
  );
}
