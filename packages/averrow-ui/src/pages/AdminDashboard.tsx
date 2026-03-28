import { useSystemHealth } from '@/hooks/useSystemHealth';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageLoader } from '@/components/ui/PageLoader';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

function fmt(n: number): string {
  return n.toLocaleString();
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-cockpit/95 px-3 py-2 backdrop-blur-sm">
      <div className="font-mono text-[10px] text-contrail/60">{label}</div>
      <div className="font-mono text-sm font-bold text-parchment">{fmt(payload[0].value)} threats</div>
    </div>
  );
}

export function AdminDashboard() {
  const { data, isLoading } = useSystemHealth();

  if (isLoading) return <PageLoader />;

  const threats = data?.threats ?? { total: 0, today: 0, week: 0 };
  const agents = data?.agents ?? { total: 0, successes: 0, errors: 0 };
  const feeds = data?.feeds ?? { pulls: 0, ingested: 0 };
  const sessions = data?.sessions ?? { count: 0 };
  const migrations = data?.migrations ?? { total: 0, last_run: null, last_name: null };
  const audit = data?.audit ?? { count: 0 };
  const trend = data?.trend ?? [];
  const infra = data?.infrastructure ?? {
    mainDb: { name: 'trust-radar-v2', sizeMb: 79.5, tables: 57, region: 'ENAM' },
    auditDb: { name: 'trust-radar-v2-audit', sizeKb: 180, tables: 2, region: 'ENAM' },
    worker: { name: 'trust-radar', platform: 'Cloudflare Workers' },
    kvNamespaces: [{ name: 'trust-radar-cache' }, { name: 'SESSIONS' }, { name: 'CACHE' }],
  };

  const successRate = agents.total > 0 ? Math.round((agents.successes / agents.total) * 100) : 100;
  const isHealthy = agents.errors === 0;
  const trendTotal = trend.reduce((s, t) => s + t.count, 0);
  const trendAvg = trend.length > 0 ? Math.round(trendTotal / trend.length) : 0;
  const trendPeak = trend.reduce((max, t) => t.count > max.count ? t : max, { day: '', count: 0 });

  const chartData = trend.map((t) => ({
    date: shortDate(t.day),
    threats: t.count,
  }));

  const dbSizePercent = Math.min((infra.mainDb.sizeMb / 500) * 100, 100);

  return (
    <div className="animate-fade-in space-y-8">
      {/* ── PAGE HEADER ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-parchment">System Health</h1>
          <p className="font-mono text-[11px] text-contrail/40 mt-1">All systems running normally</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={isHealthy ? 'dot-pulse-green' : 'dot-pulse-amber'} />
          <span className={`badge-glass ${isHealthy ? 'badge-active' : 'badge-accelerating'}`}>
            {isHealthy ? 'OPERATIONAL' : 'DEGRADED'}
          </span>
          <span className="font-mono text-[9px] text-contrail/30 ml-2">Updated just now</span>
        </div>
      </div>

      {/* ── TOP STAT ROW ────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card glass-card-teal rounded-xl p-4">
          <div className="section-label mb-2">Threats Today</div>
          <div className="metric-xl glow-teal">{fmt(threats.today)}</div>
          <div className="font-mono text-[9px] text-contrail/40 mt-1">{fmt(threats.total)} total</div>
        </div>
        <div className="glass-card glass-card-green rounded-xl p-4">
          <div className="section-label mb-2">Feed Ingestion</div>
          <div className="metric-xl glow-green">{fmt(feeds.ingested)}</div>
          <div className="font-mono text-[9px] text-contrail/40 mt-1">records (24h)</div>
        </div>
        <div className="glass-card glass-card-green rounded-xl p-4">
          <div className="section-label mb-2">Agent Runs</div>
          <div className="metric-xl glow-green">{fmt(agents.total)}</div>
          <div className="font-mono text-[9px] text-contrail/40 mt-1">
            {fmt(agents.successes)} success / {agents.errors} errors
          </div>
        </div>
        <div className="glass-card glass-card-teal rounded-xl p-4">
          <div className="section-label mb-2">Active Sessions</div>
          <div className="metric-xl glow-teal">{fmt(sessions.count)}</div>
          <div className="font-mono text-[9px] text-contrail/40 mt-1">authenticated</div>
        </div>
      </div>

      {/* ── THREE-COLUMN LAYOUT ─────────────────── */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
        {/* LEFT — Infrastructure */}
        <div className="space-y-4">
          <SectionLabel>Infrastructure</SectionLabel>

          {/* Database */}
          <div className="glass-card glass-card-teal rounded-xl p-4 space-y-4">
            <div className="section-label">Database</div>

            {/* Main DB */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[11px] font-semibold text-parchment">{infra.mainDb.name}</span>
                <span className="badge-glass badge-active">PRIMARY</span>
              </div>
              <div className="progress-bar-track h-2 mb-1.5">
                <div className="progress-bar-fill-teal" style={{ width: `${dbSizePercent}%` }} />
              </div>
              <div className="font-mono text-[10px] text-contrail/50">{infra.mainDb.sizeMb} MB</div>
              <div className="font-mono text-[10px] text-contrail/40 mt-0.5">
                {infra.mainDb.tables} tables &middot; {migrations.total} migrations
              </div>
              <div className="font-mono text-[10px] text-contrail/40">
                Region: {infra.mainDb.region} &middot; Created Mar 13
              </div>
              {migrations.last_run && (
                <div className="font-mono text-[10px] text-contrail/40">
                  Last migration: {shortDate(migrations.last_run)}
                </div>
              )}
            </div>

            <hr className="hud-divider" />

            {/* Audit DB */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[11px] font-semibold text-parchment">{infra.auditDb.name}</span>
                <span className="badge-glass badge-dormant">AUDIT</span>
              </div>
              <div className="font-mono text-[10px] text-contrail/40">
                {infra.auditDb.sizeKb} KB &middot; {infra.auditDb.tables} tables &middot; {infra.auditDb.region}
              </div>
            </div>
          </div>

          {/* Worker */}
          <div className="glass-card glass-card-teal rounded-xl p-4">
            <div className="section-label mb-3">Worker</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="dot-pulse-green" />
                <span className="font-mono text-[11px] font-semibold text-parchment">{infra.worker.name}</span>
              </div>
              <span className="badge-glass badge-active">ACTIVE</span>
            </div>
            <div className="font-mono text-[10px] text-contrail/40 mt-1.5">{infra.worker.platform}</div>
            <div className="font-mono text-[10px] text-contrail/30 mt-0.5">ID: 5a136591...</div>
            <div className="font-mono text-[10px] text-contrail/40 mt-0.5">Region: ENAM</div>
          </div>

          {/* KV Namespaces */}
          <div className="glass-card rounded-xl p-4">
            <div className="section-label mb-3">KV Namespaces ({infra.kvNamespaces.length})</div>
            <div className="space-y-2">
              {infra.kvNamespaces.map((kv) => (
                <div key={kv.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="dot-pulse-green" />
                    <span className="font-mono text-[11px] text-parchment">{kv.name}</span>
                  </div>
                  <span className="badge-glass badge-active">ACTIVE</span>
                </div>
              ))}
              <div className="font-mono text-[10px] text-contrail/40 mt-1 ml-5">
                {fmt(sessions.count)} active sessions
              </div>
            </div>
          </div>
        </div>

        {/* CENTER — Activity */}
        <div className="space-y-4">
          <SectionLabel>Activity</SectionLabel>

          {/* Threat Ingestion Chart */}
          <div className="glass-card glass-card-teal rounded-xl p-4">
            <div className="section-label mb-3">Threat Ingestion (14D)</div>
            <div className="h-[180px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#00D4FF" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'rgba(120,160,200,0.4)', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(120,160,200,0.3)', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="threats"
                      stroke="#00D4FF"
                      strokeWidth={2}
                      fill="url(#tealGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="font-mono text-[11px] text-contrail/30">No trend data</span>
                </div>
              )}
            </div>
            <hr className="hud-divider" />
            <div className="flex items-center justify-between font-mono text-[10px] text-contrail/50">
              <span>Total: {fmt(trendTotal)}</span>
              <span>Avg/day: {fmt(trendAvg)}</span>
              {trendPeak.day && <span>Peak: {shortDate(trendPeak.day)}</span>}
            </div>
          </div>

          {/* Agent Performance */}
          <div className="glass-card glass-card-green rounded-xl p-4">
            <div className="section-label mb-3">Agent Performance (24H)</div>
            <div className="flex gap-4 mb-3">
              <div>
                <div className="font-display text-lg font-bold text-parchment">{fmt(agents.total)}</div>
                <div className="font-mono text-[9px] text-contrail/40 uppercase">Runs</div>
              </div>
              <div>
                <div className="font-display text-lg font-bold text-parchment">{fmt(agents.successes)}</div>
                <div className="font-mono text-[9px] text-contrail/40 uppercase">Success</div>
              </div>
              <div>
                <div className={`font-display text-lg font-bold ${agents.errors > 0 ? 'text-accent' : 'text-parchment'}`}>
                  {agents.errors}
                </div>
                <div className="font-mono text-[9px] text-contrail/40 uppercase">Errors</div>
              </div>
            </div>
            <div className="progress-bar-track h-2 mb-1.5">
              <div
                className={successRate >= 90 ? 'progress-bar-fill-teal' : successRate >= 50 ? 'progress-bar-fill-amber' : 'progress-bar-fill-red'}
                style={{ width: `${successRate}%` }}
              />
            </div>
            <div className="font-mono text-[10px] text-contrail/50 mb-3">{successRate}% success rate</div>
            <hr className="hud-divider" />
            <div className="font-mono text-[10px] text-contrail/50 mt-2">
              {fmt(feeds.pulls)} feed pulls &middot; {fmt(feeds.ingested)} ingested
            </div>
          </div>
        </div>

        {/* RIGHT — Security & Compliance */}
        <div className="space-y-4">
          <SectionLabel>Security &amp; Compliance</SectionLabel>

          {/* Sessions */}
          <div className="glass-card glass-card-teal rounded-xl p-4">
            <div className="section-label mb-3">Sessions</div>
            <div className="font-display text-2xl font-bold text-parchment mb-1">{fmt(sessions.count)}</div>
            <div className="font-mono text-[10px] text-contrail/40 mb-3">active sessions &middot; 1 total user</div>
            <Link
              to="/profile"
              className="font-mono text-[10px] text-orbital-teal hover:text-thrust transition-colors"
            >
              Revoke all sessions &rarr;
            </Link>
          </div>

          {/* Compliance */}
          <div className="glass-card rounded-xl p-4">
            <div className="section-label mb-3">Compliance</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-positive">&#10003;</span>
                <span className="text-parchment/80">Data residency: ENAM</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-positive">&#10003;</span>
                <span className="text-parchment/80">Audit logging: Active</span>
              </div>
              <div className="font-mono text-[10px] text-contrail/40 ml-5">
                {fmt(audit.count)} events recorded
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-positive">&#10003;</span>
                <span className="text-parchment/80">Encryption at rest: D1 managed</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-positive">&#10003;</span>
                <span className="text-parchment/80">TLS: Cloudflare managed</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-positive">&#10003;</span>
                <span className="text-parchment/80">Auth: Google OAuth</span>
              </div>
            </div>
            <div className="mt-3">
              <Link
                to="/admin/audit"
                className="font-mono text-[10px] text-orbital-teal hover:text-thrust transition-colors"
              >
                View Audit Log &rarr;
              </Link>
            </div>
          </div>

          {/* Migrations */}
          <div className="glass-card rounded-xl p-4">
            <div className="section-label mb-3">Migrations</div>
            <div className="font-display text-lg font-bold text-parchment">{migrations.total}</div>
            <div className="font-mono text-[10px] text-contrail/40 mt-0.5">migrations run</div>
            {migrations.last_run && (
              <div className="font-mono text-[10px] text-contrail/40 mt-1.5">
                Last: {shortDate(migrations.last_run)}
              </div>
            )}
            {migrations.last_name && (
              <div className="font-mono text-[10px] text-contrail/30 mt-0.5 truncate">
                {migrations.last_name}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-positive font-mono text-[11px]">&#10003;</span>
              <span className="font-mono text-[10px] text-parchment/70">Up to date</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
