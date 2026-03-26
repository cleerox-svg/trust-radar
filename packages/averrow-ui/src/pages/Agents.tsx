import { useState } from 'react';
import { useAgents } from '@/hooks/useAgents';
import type { Agent } from '@/hooks/useAgents';
import { StatCard } from '@/components/ui/StatCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardGridLoader } from '@/components/ui/PageLoader';
import { Badge } from '@/components/ui/Badge';
import { AgentIcon } from '@/components/brand/AgentIcon';
import { ActivitySparkline } from '@/components/ui/ActivitySparkline';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/cn';

const statusVariant: Record<string, 'success' | 'critical' | 'high' | 'default'> = {
  active: 'success',
  error: 'critical',
  degraded: 'high',
  idle: 'default',
};

function AgentOperationCard({ agent }: { agent: Agent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-instrument border border-white/[0.06] rounded-xl p-5 transition-all hover:border-accent/15 cursor-pointer border-l-[3px]"
      style={{ borderLeftColor: agent.color }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3 mb-3">
        <AgentIcon agent={agent.name} size={32} className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-sm font-bold text-parchment">{agent.display_name}</span>
            <Badge variant={statusVariant[agent.status] || 'default'}>{agent.status}</Badge>
          </div>
          <div className="font-mono text-[10px] text-contrail/40 leading-relaxed">{agent.description}</div>
        </div>
      </div>

      <div className="flex gap-5 mb-3">
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

      <div className="mb-2">
        <ActivitySparkline data={agent.activity} color={agent.color} width={220} height={22} />
      </div>

      <div className="font-mono text-[9px] text-contrail/30">
        Last output: {relativeTime(agent.last_output_at)}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <div className="font-mono text-[10px] text-contrail/40 uppercase tracking-wider mb-2">Recent Activity</div>
          {agent.last_run_status && (
            <div className="flex items-center gap-2 font-mono text-[11px] text-contrail/60">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full',
                agent.last_run_status === 'success' ? 'bg-positive' : 'bg-accent',
              )} />
              Last run: {agent.last_run_status} ({relativeTime(agent.last_run_at)})
            </div>
          )}
          {agent.last_run_error && (
            <div className="mt-2 font-mono text-[10px] text-accent/70 bg-accent/5 rounded p-2 break-all">
              {agent.last_run_error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Agents() {
  const { data: agents, isLoading } = useAgents();

  const operational = agents?.filter((a) => a.status === 'active').length || 0;
  const total = agents?.length || 0;
  const totalOutputs = agents?.reduce((sum, a) => sum + a.outputs_24h, 0) || 0;
  const totalErrors = agents?.reduce((sum, a) => sum + a.error_count_24h, 0) || 0;

  if (isLoading) return <CardGridLoader count={6} />;

  return (
    <div className="animate-fade-in space-y-8">
      <h1 className="font-display text-xl font-bold text-parchment">AI Agent Operations</h1>

      {/* Stats Row */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Agents Operational" value={`${operational}/${total}`} accentColor="#28A050" />
          <StatCard label="Outputs 24h" value={totalOutputs} />
          <StatCard label="Total Agents" value={total} />
          <StatCard label="Errors 24h" value={totalErrors} accentColor={totalErrors > 0 ? '#C83C3C' : undefined} />
        </div>
      )}

      {/* Agent Cards Grid */}
      <div>
        <SectionLabel className="mb-3">Squadron Status</SectionLabel>
        {isLoading ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : agents && agents.length > 0 ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentOperationCard key={agent.agent_id} agent={agent} />
            ))}
          </div>
        ) : (
          <EmptyState message="No agents available" />
        )}
      </div>
    </div>
  );
}
