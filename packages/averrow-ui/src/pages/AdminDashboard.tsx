import { useDashboardStats, useAgents, usePipelineStatus } from '@/hooks/useAgents';
import type { Agent } from '@/hooks/useAgents';
import { StatCard } from '@/components/ui/StatCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { AgentIcon } from '@/components/brand/AgentIcon';
import { ActivitySparkline } from '@/components/ui/ActivitySparkline';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/cn';

const statusDot: Record<string, string> = {
  active: 'bg-positive',
  degraded: 'bg-yellow-400',
  error: 'bg-accent',
  idle: 'bg-white/20',
};

function AgentCard({ agent }: { agent: Agent }) {
  const dotClass = statusDot[agent.status] || statusDot.idle;

  return (
    <div
      className="bg-instrument border border-white/[0.06] rounded-xl p-4 transition-all hover:border-accent/15 border-l-[3px]"
      style={{ borderLeftColor: agent.color }}
    >
      <div className="flex items-center gap-3 mb-3">
        <AgentIcon agent={agent.name} size={28} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-parchment truncate">{agent.display_name}</span>
            <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass, agent.status === 'active' && 'animate-pulse')} />
          </div>
          <div className="font-mono text-[9px] text-contrail/40 uppercase tracking-wider">{agent.description}</div>
        </div>
      </div>

      <div className="flex gap-4 mb-3">
        <div>
          <div className="font-display text-lg font-bold text-parchment">{agent.jobs_24h}</div>
          <div className="font-mono text-[9px] text-contrail/40 uppercase">Jobs</div>
        </div>
        <div>
          <div className="font-display text-lg font-bold text-parchment">{agent.outputs_24h}</div>
          <div className="font-mono text-[9px] text-contrail/40 uppercase">Outputs</div>
        </div>
        <div>
          <div className={cn('font-display text-lg font-bold', agent.error_count_24h > 0 ? 'text-accent' : 'text-parchment')}>
            {agent.error_count_24h}
          </div>
          <div className="font-mono text-[9px] text-contrail/40 uppercase">Errors</div>
        </div>
      </div>

      <ActivitySparkline data={agent.activity} color={agent.color} width={200} height={20} />

      <div className="font-mono text-[9px] text-contrail/30 mt-2">
        Last output: {relativeTime(agent.last_output_at)}
      </div>
    </div>
  );
}

function PipelinePill({ name, pending, status }: { name: string; pending: number; status: string }) {
  const dotClass = status === 'healthy' ? 'bg-positive' : status === 'degraded' ? 'bg-yellow-400' : 'bg-accent';

  return (
    <div className="flex items-center gap-2 bg-instrument border border-white/[0.06] rounded-lg px-4 py-2.5">
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClass)} />
      <span className="font-mono text-[11px] font-semibold text-parchment whitespace-nowrap">{name}</span>
      {pending > 0 && (
        <span className="font-mono text-[10px] text-contrail/50">{pending} pending</span>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelineStatus();

  const pathfinder = agents?.find((a) => a.name === 'prospector');
  const coreAgents = agents?.filter((a) => a.name !== 'prospector') || [];

  return (
    <div className="animate-fade-in space-y-8">
      <h1 className="font-display text-xl font-bold text-parchment">Admin Dashboard</h1>

      {/* System Stats */}
      <div>
        <SectionLabel className="mb-3">System Overview</SectionLabel>
        {statsLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total Brands" value={stats.total_brands} sublabel={`${stats.monitored_brands} monitored`} />
            <StatCard label="Active Threats" value={stats.active_threats} accentColor="#C83C3C" sublabel={`${stats.total_threats} total`} />
            <StatCard
              label="Agents Operational"
              value={`${stats.agents_operational}/${stats.agents_total}`}
              accentColor="#28A050"
              sublabel={`${stats.feeds_healthy}/${stats.feeds_total} feeds healthy`}
            />
            <StatCard label="Threats 24h" value={stats.threats_24h} accentColor="#E87040" sublabel={`${stats.takedowns_pending} takedowns pending`} />
          </div>
        ) : (
          <EmptyState message="No dashboard data available" />
        )}
      </div>

      {/* Agent Health */}
      <div>
        <SectionLabel className="mb-3">Agent Health</SectionLabel>
        {agentsLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : coreAgents.length > 0 ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {coreAgents.map((agent) => (
              <AgentCard key={agent.agent_id} agent={agent} />
            ))}
          </div>
        ) : (
          <EmptyState message="No agent data available" />
        )}
      </div>

      {/* Pipeline Automation */}
      <div>
        <SectionLabel className="mb-3">Pipeline Automation</SectionLabel>
        {pipelinesLoading ? (
          <div className="flex gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-44 rounded-lg" />)}
          </div>
        ) : pipelines && pipelines.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {pipelines.map((p) => (
              <PipelinePill key={p.name} name={p.name} pending={p.pending} status={p.status} />
            ))}
          </div>
        ) : (
          <EmptyState message="No pipeline data available" />
        )}
      </div>

      {/* Pathfinder */}
      {pathfinder && (
        <div>
          <SectionLabel className="mb-3">Pathfinder — Sales Agent</SectionLabel>
          <AgentCard agent={pathfinder} />
        </div>
      )}
    </div>
  );
}
