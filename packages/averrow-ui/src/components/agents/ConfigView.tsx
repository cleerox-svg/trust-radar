import { useState } from 'react';
import { useAgents, useResetAgentCircuit, useUpdateAgentThreshold } from '@/hooks/useAgents';
import type { Agent } from '@/hooks/useAgents';
import { AgentIcon } from '@/components/brand/AgentIcon';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/cn';
import { Badge } from '@/design-system/components';

// ─── Agent config definitions ──────────────────────────────────
interface AgentConfigDef {
  name: string;
  description: string;
  schedule: string;
  model: string;
  scope: string;
  outputs: string[];
  icon: string;
  color: string;
}

const AGENT_CONFIGS: Record<string, AgentConfigDef> = {
  sentinel: {
    name: 'Sentinel',
    description: 'Certificate & Domain Surveillance',
    schedule: 'Every hour via Flight Control',
    model: 'claude-haiku-4-5',
    scope: 'Monitors active brands via CT logs (crt.sh)',
    outputs: ['agent_outputs (classification)', 'threats', 'notifications'],
    icon: 'Target',
    color: '#f87171',
  },
  analyst: {
    name: 'Analyst / ASTRA',
    description: 'Threat Classification & Brand Matching',
    schedule: 'Every hour via Flight Control',
    model: 'claude-haiku-4-5',
    scope: 'Classifies unprocessed threats, matches to brands',
    outputs: ['agent_outputs (classification)', 'threats (enriched)', 'notifications'],
    icon: 'Diamond',
    color: '#00D4FF',
  },
  cartographer: {
    name: 'Cartographer / Navigator',
    description: 'Geo Enrichment & Infrastructure Mapping',
    schedule: 'Every hour via Flight Control, scaled by backlog',
    model: 'claude-haiku-4-5',
    scope: 'Enriches threats with geo/ASN/provider data',
    outputs: ['threats (geo enriched)', 'hosting_providers', 'infrastructure_clusters'],
    icon: 'Map',
    color: '#fb923c',
  },
  observer: {
    name: 'Observer',
    description: 'Strategic Intel & Daily Briefings',
    schedule: 'Every hour via Flight Control',
    model: 'claude-sonnet-4-20250514',
    scope: 'Generates daily threat briefings and trend analysis',
    outputs: ['agent_outputs (briefing)', 'notifications (intel_digest)'],
    icon: 'Eye',
    color: '#4ADE80',
  },
  nexus: {
    name: 'NEXUS',
    description: 'Infrastructure Correlation & Clustering',
    schedule: 'On-demand via NexusWorkflow Durable Object',
    model: 'none (algorithmic)',
    scope: 'Clusters threats by ASN/subnet/temporal patterns',
    outputs: ['infrastructure_clusters', 'campaigns'],
    icon: 'Network',
    color: '#A78BFA',
  },
  flight_control: {
    name: 'Flight Control',
    description: 'Autonomous Supervisor & Orchestrator',
    schedule: 'Every hour (Cloudflare Cron)',
    model: 'none (orchestration only)',
    scope: 'Schedules all agents, manages token budgets, recovers stalled runs',
    outputs: ['agent_events', 'agent_activity_log'],
    icon: 'Cpu',
    color: '#00D4FF',
  },
  sparrow: {
    name: 'Sparrow',
    description: 'Automated Takedown Agent',
    schedule: 'Triggered by Flight Control on new threats',
    model: 'claude-haiku-4-5',
    scope: 'Generates takedown requests with evidence for active threats',
    outputs: ['takedown_requests', 'takedown_evidence'],
    icon: 'Feather',
    color: '#f87171',
  },
  strategist: {
    name: 'Strategist',
    description: 'Campaign Correlation & Clustering Intelligence',
    schedule: 'Periodic via Flight Control',
    model: 'claude-haiku-4-5',
    scope: 'Correlates campaigns, identifies attack patterns',
    outputs: ['campaigns', 'agent_outputs (campaign_analysis)'],
    icon: 'GitMerge',
    color: '#fb923c',
  },
  prospector: {
    name: 'Pathfinder',
    description: 'Sales Intelligence & Lead Generation',
    schedule: 'On-demand',
    model: 'claude-haiku-4-5',
    scope: 'Mines threat data for sales prospects',
    outputs: ['leads', 'agent_outputs (prospect)'],
    icon: 'Compass',
    color: '#fbbf24',
  },
  curator: {
    name: 'Curator',
    description: 'Platform Hygiene & Data Quality',
    schedule: 'Weekly (Sunday, FC-triggered)',
    model: 'none (algorithmic)',
    scope: 'Email security scanning, safe domain cleanup, social discovery',
    outputs: [
      'brands (email_security_grade)',
      'threats (false_positive removal)',
      'social_profiles',
      'agent_outputs (hygiene_report)',
    ],
    icon: 'Sparkles',
    color: '#4ADE80',
  },
};

const AGENT_ORDER = [
  'flight_control', 'sentinel', 'analyst', 'cartographer',
  'observer', 'nexus', 'sparrow', 'strategist', 'prospector', 'curator',
];

// ─── Config Card (accordion item) ──────────────────────────────
function ConfigCard({
  agentId,
  config,
  agentData,
  isOpen,
  onToggle,
}: {
  agentId: string;
  config: AgentConfigDef;
  agentData: Agent | undefined;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isActive = agentData?.status === 'active' || agentData?.status === 'degraded';
  const totalRuns = agentData?.jobs_24h ?? 0;
  const successCount = totalRuns - (agentData?.error_count_24h ?? 0);

  // Derive all-time stats from agent data
  const statusLabel = agentData?.status ?? 'unknown';

  return (
    <div className="rounded-xl overflow-hidden" style={{ background:'rgba(15,23,42,0.50)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0.75rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="shrink-0" style={{ color: config.color }}>
          <AgentIcon agent={agentId} size={28} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {config.name}
          </span>
          <span className="block font-mono text-[10px] text-white/40 mt-0.5">
            {config.description}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isActive
            ? <Badge status="active"   label={statusLabel} size="xs" pulse />
            : <Badge status="inactive" label={statusLabel} size="xs" />}
          <svg
            className={cn('w-4 h-4 text-white/30 transition-transform', isOpen && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-5 pb-5 pt-1 border-t border-white/[0.06] space-y-4 animate-fade-in">
          <ConfigSection label="Schedule">
            <span className="font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>{config.schedule}</span>
          </ConfigSection>

          <ConfigSection label="Model">
            <span className="font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>{config.model}</span>
          </ConfigSection>

          <ConfigSection label="Scope">
            <span className="font-mono text-[11px] text-white/70 leading-relaxed">{config.scope}</span>
          </ConfigSection>

          <ConfigSection label="Outputs">
            <div className="flex flex-wrap gap-1.5">
              {config.outputs.map((output) => (
                <span
                  key={output}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] font-mono text-[10px] text-white/60"
                >
                  <span style={{ color: 'var(--amber)' }}>&rarr;</span> {output}
                </span>
              ))}
            </div>
          </ConfigSection>

          <ConfigSection label="Performance (24h)">
            <div className="flex gap-6">
              <div>
                <span className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{successCount}</span>
                <span className="font-mono text-[9px] text-white/40 ml-1">successful</span>
              </div>
              <div>
                <span className="font-display text-sm font-bold" style={{ color: (agentData?.error_count_24h ?? 0) > 0 ? '#f87171' : '#F0EDE8' }}>
                  {agentData?.error_count_24h ?? 0}
                </span>
                <span className="font-mono text-[9px] text-white/40 ml-1">failures</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-white/40">Last run: </span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>
                  {relativeTime(agentData?.last_run_at ?? null)}
                </span>
              </div>
            </div>
          </ConfigSection>

          {agentData && (
            <CircuitBreakerSection agentId={agentId} agent={agentData} />
          )}
        </div>
      )}
    </div>
  );
}

// Protected agents that cannot be auto-tripped
const PROTECTED_AGENTS = new Set(['flight_control', 'architect']);

function CircuitBreakerSection({ agentId, agent }: { agentId: string; agent: Agent }) {
  const resetMutation = useResetAgentCircuit();
  const thresholdMutation = useUpdateAgentThreshold();
  const [thresholdInput, setThresholdInput] = useState('');
  const [editing, setEditing] = useState(false);

  const isProtected = PROTECTED_AGENTS.has(agentId);
  const isTripped = agent.circuit_state === 'tripped';
  const isManualPause = agent.circuit_state === 'manual_pause';

  const handleReset = () => {
    resetMutation.mutate(agentId);
  };

  const handleThresholdSave = () => {
    const val = thresholdInput.trim();
    const threshold = val === '' ? null : parseInt(val, 10);
    if (threshold !== null && (isNaN(threshold) || threshold < 1)) return;
    thresholdMutation.mutate({ agentId, threshold });
    setEditing(false);
  };

  return (
    <ConfigSection label="Circuit Breaker">
      <div className="space-y-3">
        {/* State row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-white/40">State:</span>
            {isTripped ? (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                TRIPPED{agent.paused_after_n_failures ? ` \u00B7 ${agent.paused_after_n_failures}\u2717` : ''}
              </span>
            ) : isManualPause ? (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Paused &middot; manual
              </span>
            ) : (
              <span className="font-mono text-[11px]" style={{ color: '#4ade80' }}>Closed</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-white/40">Consecutive failures:</span>
            <span
              className="font-mono text-[11px] font-bold"
              style={{ color: agent.consecutive_failures > 0 ? '#f87171' : 'var(--text-primary)' }}
            >
              {agent.consecutive_failures}
            </span>
          </div>
        </div>

        {/* Threshold row */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-white/40">Threshold:</span>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                placeholder="global"
                className="w-16 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] font-mono text-[11px] text-white/80 outline-none focus:border-amber-500/50"
              />
              <button
                onClick={handleThresholdSave}
                disabled={thresholdMutation.isPending}
                className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] font-mono text-[9px] text-green-400 hover:bg-white/[0.1]"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] font-mono text-[9px] text-white/40 hover:bg-white/[0.1]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>
                {agent.consecutive_failure_threshold ?? '—'}
              </span>
              <span className="font-mono text-[9px] text-white/30">
                {agent.consecutive_failure_threshold == null ? '(global default)' : '(override)'}
              </span>
              <button
                onClick={() => {
                  setThresholdInput(agent.consecutive_failure_threshold?.toString() ?? '');
                  setEditing(true);
                }}
                className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] font-mono text-[9px] text-white/40 hover:bg-white/[0.08] hover:text-white/60"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Paused-at info */}
        {agent.paused_at && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-white/40">Paused at:</span>
            <span className="font-mono text-[11px] text-white/60">{relativeTime(agent.paused_at)}</span>
          </div>
        )}

        {/* Reset button */}
        {(isTripped || isManualPause) && (
          <div className="pt-1">
            {isProtected ? (
              <span
                className="inline-flex items-center gap-1 font-mono text-[9px] text-white/30"
                title="Protected from auto-trip — manually disable from settings instead"
              >
                Protected from auto-trip
              </span>
            ) : (
              <button
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className={cn(
                  'px-3 py-1.5 rounded font-mono text-[10px] font-bold uppercase tracking-wide transition-colors',
                  resetMutation.isPending
                    ? 'bg-white/[0.04] text-white/30 cursor-wait'
                    : resetMutation.isSuccess
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20',
                )}
              >
                {resetMutation.isPending ? 'Resetting...' : resetMutation.isSuccess ? 'Reset!' : 'Reset Circuit'}
              </button>
            )}
          </div>
        )}
      </div>
    </ConfigSection>
  );
}

function ConfigSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[9px] text-white/40 uppercase tracking-widest mb-1.5">{label}</div>
      {children}
    </div>
  );
}

// ─── Main Config View ──────────────────────────────────────────
export function ConfigView() {
  const { data: agents } = useAgents();
  const [openAgent, setOpenAgent] = useState<string | null>('flight_control');

  const agentMap = new Map(agents?.map((a) => [a.name, a]) ?? []);

  return (
    <div className="animate-fade-in space-y-3">
      <div className="font-mono text-[9px] text-white/40 uppercase tracking-widest mb-2">
        Agent Configuration (Read-Only)
      </div>
      {AGENT_ORDER.map((agentId) => {
        const config = AGENT_CONFIGS[agentId];
        if (!config) return null;
        return (
          <ConfigCard
            key={agentId}
            agentId={agentId}
            config={config}
            agentData={agentMap.get(agentId)}
            isOpen={openAgent === agentId}
            onToggle={() => setOpenAgent(openAgent === agentId ? null : agentId)}
          />
        );
      })}
    </div>
  );
}
