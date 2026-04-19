// ─── Canonical Agent Metadata ──────────────────────────────────────────
//
// Single source of truth for agent presentation across all views:
// Monitor, Config, History, Flight Control mesh badges.
//
// Status data (job counts, last run, errors) still comes from the
// useAgents() hook — only PRESENTATION lives here.

export type AgentId =
  | 'flight_control'
  | 'sentinel'
  | 'navigator'
  | 'analyst'
  | 'cartographer'
  | 'observer'
  | 'nexus'
  | 'sparrow'
  | 'strategist'
  | 'pathfinder'
  | 'curator'
  | 'architect'
  | 'watchdog';

export interface AgentMetadata {
  id: AgentId;
  displayName: string;
  codename: string | null;
  subtitle: string;
  color: string;
  category: 'orchestration' | 'intelligence' | 'response' | 'ops' | 'meta';
  pipelinePosition: number;
}

export const AGENT_METADATA: Record<AgentId, AgentMetadata> = {
  flight_control: {
    id: 'flight_control',
    displayName: 'Flight Control',
    codename: null,
    subtitle: 'Autonomous supervisor — parallel scaling, stall recovery, token budget enforcement',
    color: '#22D3EE',
    category: 'orchestration',
    pipelinePosition: 0,
  },
  sentinel: {
    id: 'sentinel',
    displayName: 'Sentinel',
    codename: null,
    subtitle: 'Certificate & Domain Surveillance',
    color: '#C83C3C',
    category: 'intelligence',
    pipelinePosition: 1,
  },
  navigator: {
    id: 'navigator',
    displayName: 'Navigator',
    codename: null,
    subtitle: 'DNS resolution — independent 5-min cron',
    color: '#38BDF8',
    category: 'intelligence',
    pipelinePosition: 2,
  },
  cartographer: {
    id: 'cartographer',
    displayName: 'Cartographer',
    codename: null,
    subtitle: 'Geo Enrichment & Infrastructure Mapping',
    color: '#78A0C8',
    category: 'intelligence',
    pipelinePosition: 3,
  },
  nexus: {
    id: 'nexus',
    displayName: 'NEXUS',
    codename: null,
    subtitle: 'Infrastructure correlation — clusters threats by ASN, subnet, and temporal patterns',
    color: '#00D4FF',
    category: 'intelligence',
    pipelinePosition: 4,
  },
  analyst: {
    id: 'analyst',
    displayName: 'Analyst',
    codename: 'ASTRA',
    subtitle: 'Threat Classification & Brand Matching',
    color: '#FB923C',
    category: 'intelligence',
    pipelinePosition: 5,
  },
  observer: {
    id: 'observer',
    displayName: 'Observer',
    codename: null,
    subtitle: 'Strategic Intel & Daily Briefings',
    color: '#A78BFA',
    category: 'intelligence',
    pipelinePosition: 6,
  },
  sparrow: {
    id: 'sparrow',
    displayName: 'Sparrow',
    codename: null,
    subtitle: 'Automated Takedown Agent',
    color: '#4ADE80',
    category: 'response',
    pipelinePosition: 7,
  },
  strategist: {
    id: 'strategist',
    displayName: 'Strategist',
    codename: null,
    subtitle: 'Campaign Correlation & Clustering Intelligence',
    color: '#FB7185',
    category: 'intelligence',
    pipelinePosition: 8,
  },
  pathfinder: {
    id: 'pathfinder',
    displayName: 'Pathfinder',
    codename: null,
    subtitle: 'Sales Intelligence & Lead Generation',
    color: '#F97316',
    category: 'ops',
    pipelinePosition: 9,
  },
  curator: {
    id: 'curator',
    displayName: 'Curator',
    codename: null,
    subtitle: 'Platform Hygiene & Data Quality',
    color: '#2DD4BF',
    category: 'ops',
    pipelinePosition: 10,
  },
  architect: {
    id: 'architect',
    displayName: 'Architect',
    codename: null,
    subtitle: 'Meta-agent — audits agents, feeds, and the data layer',
    color: '#E5A832',
    category: 'meta',
    pipelinePosition: 11,
  },
  watchdog: {
    id: 'watchdog',
    displayName: 'Watchdog',
    codename: null,
    subtitle: 'Uptime Monitoring & Alert Escalation',
    color: '#60A5FA',
    category: 'ops',
    pipelinePosition: 12,
  },
};

/** All agents sorted by pipelinePosition. */
export const AGENT_LIST: AgentMetadata[] = Object.values(AGENT_METADATA).sort(
  (a, b) => a.pipelinePosition - b.pipelinePosition,
);

/** All agent ids sorted by pipelinePosition (convenience for loops/filters). */
export const AGENT_IDS: AgentId[] = AGENT_LIST.map((a) => a.id);

/** Lookup by string id — returns null for unknown agents. */
export function getAgentMetadata(id: string): AgentMetadata | null {
  return AGENT_METADATA[id as AgentId] ?? null;
}
