import { useState } from 'react';
import { useAgents } from '@/hooks/useAgents';
import type { Agent } from '@/hooks/useAgents';
import { AgentIcon } from '@/components/brand/AgentIcon';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/cn';

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
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="shrink-0" style={{ color: config.color }}>
          <AgentIcon agent={agentId} size={28} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-mono text-sm font-bold text-parchment">
            {config.name}
          </span>
          <span className="block font-mono text-[10px] text-white/40 mt-0.5">
            {config.description}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono font-semibold tracking-wider',
            isActive ? 'badge-active' : 'badge-dormant',
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              isActive ? 'dot-pulse-green' : 'dot-pulse-gray',
            )} />
            {statusLabel.toUpperCase()}
          </span>
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
            <span className="font-mono text-[11px] text-parchment">{config.schedule}</span>
          </ConfigSection>

          <ConfigSection label="Model">
            <span className="font-mono text-[11px] text-parchment">{config.model}</span>
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
                  <span className="text-afterburner">&rarr;</span> {output}
                </span>
              ))}
            </div>
          </ConfigSection>

          <ConfigSection label="Performance (24h)">
            <div className="flex gap-6">
              <div>
                <span className="font-display text-sm font-bold text-parchment">{successCount}</span>
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
                <span className="font-mono text-[11px] text-parchment">
                  {relativeTime(agentData?.last_run_at ?? null)}
                </span>
              </div>
            </div>
          </ConfigSection>
        </div>
      )}
    </div>
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
