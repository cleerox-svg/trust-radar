import { useState, useMemo } from 'react';
import { useAgents, useAgentDetail, useAgentHealth, useAgentOutputsByName, useApiUsage, useDashboardStats } from '@/hooks/useAgents';
import type { Agent, AgentDetailResponse, AgentHealthResponse, AgentOutput } from '@/hooks/useAgents';
import { StatCard } from '@/components/ui/StatCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardGridLoader } from '@/components/ui/PageLoader';
import { Badge } from '@/components/ui/Badge';
import { AgentIcon } from '@/components/brand/AgentIcon';
import { ActivitySparkline } from '@/components/ui/ActivitySparkline';
import { HistoryView } from '@/components/agents/HistoryView';
import { ConfigView } from '@/components/agents/ConfigView';
import { relativeTime, formatDuration } from '@/lib/time';
import { cn } from '@/lib/cn';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

type AgentTab = 'MONITOR' | 'HISTORY' | 'CONFIG';

// ─── Agent metadata registry ────────────────────────────────────────
const AGENT_REGISTRY: Record<string, {
  displayName: string;
  description: string;
  color: string;
  schedule: string;
  trigger: string;
}> = {
  sentinel: {
    displayName: 'Sentinel',
    description: 'Certificate & Domain Surveillance',
    color: '#C83C3C',
    schedule: 'every 30 min',
    trigger: 'cron',
  },
  cartographer: {
    displayName: 'Cartographer',
    description: 'Geo Enrichment & Infrastructure Mapping',
    color: '#78A0C8',
    schedule: 'every 60 min + backfill workflow',
    trigger: 'cron + workflow',
  },
  nexus: {
    displayName: 'NEXUS',
    description: 'Infrastructure correlation — clusters threats by ASN, subnet, and temporal patterns',
    color: '#00D4FF',
    schedule: 'every 4 hours + workflow',
    trigger: 'cron + workflow',
  },
  analyst: {
    displayName: 'Analyst',
    description: 'Threat Classification & Brand Matching',
    color: '#FB923C',
    schedule: 'every 30 min',
    trigger: 'cron',
  },
  observer: {
    displayName: 'Observer',
    description: 'Strategic Intel & Daily Briefings',
    color: '#A78BFA',
    schedule: 'daily',
    trigger: 'cron',
  },
  flight_control: {
    displayName: 'Flight Control',
    description: 'Autonomous supervisor — parallel scaling, stall recovery, token budget enforcement',
    color: '#22D3EE',
    schedule: 'every 60 min',
    trigger: 'cron',
  },
  sparrow: {
    displayName: 'Sparrow',
    description: 'Takedown Agent',
    color: '#4ADE80',
    schedule: 'every 2 hours',
    trigger: 'cron',
  },
  prospector: {
    displayName: 'Pathfinder',
    description: 'Sales Intelligence & Lead Generation',
    color: '#F97316',
    schedule: 'daily',
    trigger: 'cron',
  },
  strategist: {
    displayName: 'Strategist',
    description: 'Campaign Correlation & Clustering',
    color: '#FB7185',
    schedule: 'every 4 hours',
    trigger: 'cron',
  },
  curator: {
    displayName: 'Curator',
    description: 'Platform Hygiene & Data Quality',
    color: '#4ADE80',
    schedule: 'Weekly (Sunday, FC-triggered)',
    trigger: 'event',
  },
};

const AGENT_ORDER = [
  'sentinel', 'cartographer', 'nexus', 'analyst', 'observer',
  'sparrow', 'prospector', 'strategist', 'curator',
];

// ─── Status helpers ─────────────────────────────────────────────────
const statusVariant: Record<string, 'success' | 'critical' | 'high' | 'default'> = {
  active: 'success',
  error: 'critical',
  degraded: 'high',
  idle: 'default',
};

function statusDotColor(agent: Agent): string {
  if (agent.status === 'active') return '#4ADE80';
  if (agent.status === 'error') return '#C83C3C';
  if (agent.status === 'degraded') return '#FB923C';
  return '#4B5563';
}

function statusDotClass(agent: Agent): string {
  if (agent.status === 'active') return 'dot-pulse-green';
  if (agent.status === 'error') return 'dot-pulse-red';
  if (agent.status === 'degraded') return 'dot-pulse-amber';
  return '';
}

function pipelineDotClass(status: string): string {
  if (status === 'active') return 'dot-pulse-green';
  if (status === 'error') return 'dot-pulse-red';
  if (status === 'degraded') return 'dot-pulse-amber';
  return '';
}

const severityVariant: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'default'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

// ─── Run status blocks (last 5 runs) ───────────────────────────────
function RunStatusBlocks({ activity }: { activity: number[] }) {
  const last5 = activity.slice(-5);
  while (last5.length < 5) last5.unshift(0);
  return (
    <div className="flex gap-1">
      {last5.map((val, i) => (
        <div
          key={i}
          className={cn(
            'w-5 h-2 rounded-sm',
            val > 0 ? 'bg-positive' : 'bg-white/10',
          )}
        />
      ))}
    </div>
  );
}

// ─── Agent Card ─────────────────────────────────────────────────────
function AgentCard({
  agent,
  isSelected,
  onSelect,
}: {
  agent: Agent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const meta = AGENT_REGISTRY[agent.name];
  const agentColor = meta?.color ?? agent.color;

  return (
    <div
      className={cn(
        'glass-card card-accent-top rounded-xl p-5 transition-all duration-200 cursor-pointer group',
        isSelected && 'border-white/25 scale-[1.01]',
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <span className="shrink-0 mt-0.5" style={{ color: agentColor }}>
          <AgentIcon agent={agent.name} size={32} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-sm font-bold text-parchment">
              {meta?.displayName ?? agent.display_name}
            </span>
            <span
              className={cn('w-2 h-2 rounded-full shrink-0', statusDotClass(agent))}
              style={!statusDotClass(agent) ? { backgroundColor: statusDotColor(agent) } : undefined}
            />
          </div>
          <div className="font-mono text-[10px] text-white/40 leading-relaxed line-clamp-2">
            {meta?.description ?? agent.description}
          </div>
        </div>
      </div>

      {/* 3-metric row */}
      <div className="flex gap-5 mb-4">
        <div>
          <div className="font-display text-lg font-bold text-parchment">{agent.jobs_24h}</div>
          <div className="font-mono text-[9px] text-white/40 uppercase tracking-wider">Jobs 24h</div>
        </div>
        <div>
          <div className="font-display text-lg font-bold text-parchment">{agent.outputs_24h}</div>
          <div className="font-mono text-[9px] text-white/40 uppercase tracking-wider">Outputs</div>
        </div>
        <div>
          <div className={cn(
            'font-display text-lg font-bold',
            agent.error_count_24h > 0 ? 'text-[#C83C3C]' : 'text-parchment',
          )}>
            {agent.error_count_24h}
          </div>
          <div className="font-mono text-[9px] text-white/40 uppercase tracking-wider">Errors</div>
        </div>
      </div>

      {/* Last output + status blocks */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-[9px] text-white/30">
          Last output: {relativeTime(agent.last_output_at)}
        </div>
        <RunStatusBlocks activity={agent.activity} />
      </div>
    </div>
  );
}

// ─── Flight Control Supervisor Card ─────────────────────────────────
function FlightControlCard({
  agent,
  allAgents,
  isSelected,
  onSelect,
}: {
  agent: Agent;
  allAgents: Agent[];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { data: apiUsage } = useApiUsage();
  const { data: dashStats } = useDashboardStats();

  const tokenBudget = 500_000;
  const tokensUsed = apiUsage?.tokens_24h ?? 0;
  const tokenPct = Math.min((tokensUsed / tokenBudget) * 100, 100);

  const tokenBarColor = tokenPct >= 90 ? '#C83C3C' : tokenPct >= 80 ? '#FB923C' : '#22D3EE';

  return (
    <div
      className={cn(
        'col-span-1 sm:col-span-2 lg:col-span-3 glass-card card-accent-top rounded-xl p-6 transition-all duration-200 cursor-pointer',
        isSelected && 'border-white/25',
      )}
      onClick={onSelect}
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: FC identity */}
        <div className="flex items-start gap-3 lg:w-64 shrink-0">
          <span className="shrink-0 mt-0.5" style={{ color: '#22D3EE' }}>
            <AgentIcon agent="flight_control" size={36} />
          </span>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-parchment">Flight Control</span>
              <span
                className={cn('w-2 h-2 rounded-full', statusDotClass(agent))}
                style={!statusDotClass(agent) ? { backgroundColor: statusDotColor(agent) } : undefined}
              />
              <Badge variant={statusVariant[agent.status] || 'default'}>{agent.status}</Badge>
            </div>
            <div className="font-mono text-[10px] text-white/40 leading-relaxed">
              Autonomous supervisor — parallel scaling, stall recovery, token budget enforcement
            </div>
          </div>
        </div>

        {/* Center: Agent mesh bubbles */}
        <div className="flex-1">
          <div className="font-mono text-[9px] text-white/40 uppercase tracking-widest mb-3">Agent Mesh</div>
          <div className="flex flex-wrap gap-2">
            {allAgents.filter(a => a.name !== 'flight_control').map(a => {
              const meta = AGENT_REGISTRY[a.name];
              return (
                <div
                  key={a.name}
                  className="flex items-center gap-1.5 glass-btn rounded-lg px-2.5 py-1.5"
                >
                  <span
                    className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDotClass(a))}
                    style={!statusDotClass(a) ? { backgroundColor: statusDotColor(a) } : undefined}
                  />
                  <span className="font-mono text-[10px] text-white/60" style={{ color: meta?.color ?? a.color }}>
                    {meta?.displayName ?? a.display_name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Token budget + backlogs */}
        <div className="lg:w-72 shrink-0 space-y-3">
          {/* Token budget bar */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">Token Budget</span>
              <span className="font-mono text-[10px] text-white/60">
                {tokensUsed.toLocaleString()} / {tokenBudget.toLocaleString()}
              </span>
            </div>
            <div className="progress-bar-track h-2">
              <div
                className={cn(
                  tokenPct >= 90 ? 'progress-bar-fill-red' : tokenPct >= 80 ? 'progress-bar-fill-amber' : 'progress-bar-fill-teal',
                )}
                style={{ width: `${tokenPct}%` }}
              />
            </div>
          </div>

          {/* Backlog counters */}
          <div className="flex gap-4">
            <div>
              <div className="font-display text-sm font-bold text-parchment">
                {dashStats?.agent_backlogs?.cartographer?.toLocaleString() ?? '—'}
              </div>
              <div className="font-mono text-[8px] text-white/30 uppercase">Cart backlog</div>
            </div>
            <div>
              <div className="font-display text-sm font-bold text-parchment">
                {dashStats?.agent_backlogs?.analyst?.toLocaleString() ?? '—'}
              </div>
              <div className="font-mono text-[8px] text-white/30 uppercase">Analyst backlog</div>
            </div>
            <div>
              <div className="font-display text-sm font-bold text-parchment">{agent.jobs_24h}</div>
              <div className="font-mono text-[8px] text-white/30 uppercase">FC Jobs 24h</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ───────────────────────────────────────────────────
function AgentDetailPanel({ agent }: { agent: Agent }) {
  const { data: detail } = useAgentDetail(agent.name);
  const { data: health } = useAgentHealth(agent.name);
  const { data: outputs } = useAgentOutputsByName(agent.name);
  const meta = AGENT_REGISTRY[agent.name];
  const agentColor = meta?.color ?? agent.color;

  const typedDetail = detail as AgentDetailResponse | null;
  const typedHealth = health as AgentHealthResponse | null;

  const successRate = useMemo(() => {
    if (!typedDetail?.stats) return null;
    const { successes, total_runs } = typedDetail.stats;
    if (total_runs === 0) return null;
    return ((successes / total_runs) * 100).toFixed(1);
  }, [typedDetail]);

  const chartData = useMemo(() => {
    if (!typedHealth) return [];
    return typedHealth.runs.map((duration, i) => ({
      hour: `${(new Date().getUTCHours() + i) % 24}:00`,
      duration,
      outputs: typedHealth.outputs[i] ?? 0,
    }));
  }, [typedHealth]);

  return (
    <div className="col-span-1 sm:col-span-2 lg:col-span-3 glass-card rounded-xl p-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Agent info */}
        <div className="lg:w-72 shrink-0 space-y-4">
          <div className="flex items-start gap-3">
            <span style={{ color: agentColor }}>
              <AgentIcon agent={agent.name} size={40} />
            </span>
            <div>
              <h3 className="font-mono text-lg font-bold text-parchment">
                {meta?.displayName ?? agent.display_name}
              </h3>
              <div className="font-mono text-[10px] text-white/40 mt-0.5">
                {meta?.description ?? agent.description}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <DetailRow label="Schedule" value={meta?.schedule ?? agent.schedule} />
            <DetailRow label="Avg Duration" value={formatDuration(agent.avg_duration_ms)} />
            <DetailRow
              label="Success Rate"
              value={successRate ? `${successRate}%` : '—'}
            />
            <DetailRow label="Status">
              <Badge variant={statusVariant[agent.status] || 'default'}>{agent.status}</Badge>
            </DetailRow>
          </div>
        </div>

        {/* Right: Health chart */}
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[9px] text-white/40 uppercase tracking-widest mb-3">
            24h Health — Duration (ms) & Outputs
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outputsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FB923C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FB923C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0D1520',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono',
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                />
                <Area
                  type="monotone"
                  dataKey="duration"
                  stroke="#22D3EE"
                  strokeWidth={1.5}
                  fill="url(#durationGrad)"
                  name="Duration (ms)"
                />
                <Area
                  type="monotone"
                  dataKey="outputs"
                  stroke="#FB923C"
                  strokeWidth={1.5}
                  fill="url(#outputsGrad)"
                  name="Outputs"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-white/20 font-mono text-xs">
              No health data available
            </div>
          )}
        </div>
      </div>

      {/* Recent outputs */}
      <div className="mt-6 pt-5 border-t border-white/[0.06]">
        <div className="font-mono text-[9px] text-white/40 uppercase tracking-widest mb-3">
          Recent Outputs
        </div>
        {outputs && outputs.length > 0 ? (
          <div className="space-y-2">
            {outputs.map((output: AgentOutput) => (
              <div
                key={output.id}
                className="flex items-start gap-3 bg-white/[0.02] rounded-lg px-3 py-2.5"
              >
                <Badge
                  variant={severityVariant[output.severity] || 'default'}
                  className="shrink-0 mt-0.5"
                >
                  {output.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-white/70 line-clamp-2">
                    {output.summary}
                  </div>
                </div>
                <div className="font-mono text-[9px] text-white/30 shrink-0">
                  {relativeTime(output.created_at)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-white/20 font-mono text-[11px]">No recent outputs</div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      {children ?? <span className="font-mono text-[11px] text-parchment">{value}</span>}
    </div>
  );
}

// ─── Pipeline Automation Strip ──────────────────────────────────────
function PipelineStrip({ agents }: { agents: Agent[] }) {
  const { data: dashStats } = useDashboardStats();

  const pipelines = [
    {
      label: 'Geo Enrichment',
      count: dashStats?.agent_backlogs?.cartographer ?? 0,
      suffix: 'remaining',
      schedule: 'auto',
      status: agents.find(a => a.name === 'cartographer')?.status ?? 'idle',
    },
    {
      label: 'Brand Matching',
      count: dashStats?.agent_backlogs?.analyst ?? 0,
      suffix: 'pending',
      schedule: 'auto',
      status: agents.find(a => a.name === 'analyst')?.status ?? 'idle',
    },
    {
      label: 'AI Attribution',
      count: dashStats?.ai_attribution_pending ?? 0,
      suffix: 'remaining',
      schedule: 'daily',
      status: 'active',
    },
    {
      label: 'Tranco Brands',
      count: dashStats?.tranco_brand_count ?? 0,
      suffix: 'brands',
      schedule: 'daily',
      status: 'active',
    },
    {
      label: 'Sentinel Queue',
      count: dashStats?.agent_backlogs?.sentinel ?? 0,
      suffix: 'remaining',
      schedule: 'auto',
      status: agents.find(a => a.name === 'sentinel')?.status ?? 'idle',
    },
  ];

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="section-label font-mono font-bold mb-3">
        Pipeline Automation
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {pipelines.map(p => (
          <div key={p.label} className="space-y-1">
            <div className="font-mono text-[10px] text-white/50">{p.label}</div>
            <div className="font-display text-sm font-bold text-parchment">
              {p.count.toLocaleString()} <span className="font-mono text-[9px] text-white/30 font-normal">{p.suffix}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[8px] text-white/30 uppercase">{p.schedule}</span>
              <span
                className={cn('w-1.5 h-1.5 rounded-full', pipelineDotClass(p.status))}
                style={!pipelineDotClass(p.status) ? {
                  backgroundColor: '#4B5563',
                } : undefined}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Monitor View (existing content, wrapped) ─────────────────
function MonitorView() {
  const { data: agents } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const flightControl = agents?.find(a => a.name === 'flight_control') ?? null;
  const gridAgents = useMemo(() => {
    if (!agents) return [];
    return AGENT_ORDER
      .map(name => agents.find(a => a.name === name))
      .filter((a): a is Agent => !!a)
      .concat(agents.filter(a => !AGENT_ORDER.includes(a.name) && a.name !== 'flight_control'));
  }, [agents]);

  const operational = agents?.filter(a => a.status !== 'error').length ?? 0;
  const total = agents?.length ?? 0;
  const totalJobs = agents?.reduce((sum, a) => sum + a.jobs_24h, 0) ?? 0;
  const totalOutputs = agents?.reduce((sum, a) => sum + a.outputs_24h, 0) ?? 0;
  const totalErrors = agents?.reduce((sum, a) => sum + a.error_count_24h, 0) ?? 0;

  const selectedAgentData = agents?.find(a => a.name === selectedAgent) ?? null;

  return (
    <div className="space-y-6">
      {/* TOP STATS BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Agents Operational" value={`${operational}/${total}`} accentColor="#4ADE80" />
        <StatCard label="Jobs (24h)" value={totalJobs.toLocaleString()} />
        <StatCard label="Outputs (24h)" value={totalOutputs.toLocaleString()} />
        <StatCard
          label="Errors (24h)"
          value={totalErrors}
          accentColor={totalErrors > 0 ? (totalErrors >= 5 ? '#C83C3C' : '#FB923C') : undefined}
        />
      </div>

      {/* AGENT CARDS GRID */}
      <div>
        <SectionLabel className="mb-3">Squadron Status</SectionLabel>

        {agents && agents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Flight Control — full width supervisor card */}
            {flightControl && (
              <FlightControlCard
                agent={flightControl}
                allAgents={agents}
                isSelected={selectedAgent === 'flight_control'}
                onSelect={() =>
                  setSelectedAgent(prev => prev === 'flight_control' ? null : 'flight_control')
                }
              />
            )}

            {/* Selected detail panel if FC selected */}
            {selectedAgent === 'flight_control' && selectedAgentData && (
              <AgentDetailPanel agent={selectedAgentData} />
            )}

            {/* Regular agent cards */}
            {gridAgents.map(agent => (
              <AgentCard
                key={agent.agent_id}
                agent={agent}
                isSelected={selectedAgent === agent.name}
                onSelect={() =>
                  setSelectedAgent(prev => prev === agent.name ? null : agent.name)
                }
              />
            ))}

            {/* Selected detail panel (below grid, full width) */}
            {selectedAgent && selectedAgent !== 'flight_control' && selectedAgentData && (
              <AgentDetailPanel agent={selectedAgentData} />
            )}
          </div>
        ) : (
          <EmptyState message="No agents available" />
        )}
      </div>

      {/* PIPELINE AUTOMATION STRIP */}
      {agents && agents.length > 0 && (
        <PipelineStrip agents={agents} />
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export function Agents() {
  const { data: agents = [], isLoading } = useAgents();
  const [activeTab, setActiveTab] = useState<AgentTab>('MONITOR');

  if (isLoading) return <CardGridLoader count={6} />;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header with LIVE badge */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-parchment truncate">AI Agent Operations</h1>
        <span className="live-indicator shrink-0">LIVE</span>
      </div>

      {/* Tab switcher — horizontal scroll on mobile */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {(['MONITOR', 'HISTORY', 'CONFIG'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 sm:flex-none rounded-lg px-4 min-h-[44px] text-[11px] font-mono font-semibold tracking-wider uppercase whitespace-nowrap',
              activeTab === tab ? 'glass-btn-active' : 'glass-btn',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === 'MONITOR' && <MonitorView />}
      {activeTab === 'HISTORY' && <HistoryView />}
      {activeTab === 'CONFIG' && <ConfigView />}
    </div>
  );
}
