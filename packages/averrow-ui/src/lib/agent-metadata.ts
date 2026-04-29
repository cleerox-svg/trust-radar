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
  | 'watchdog'
  | 'cube_healer'
  | 'narrator'
  | 'social_discovery'
  | 'social_monitor'
  | 'app_store_monitor'
  | 'dark_web_monitor'
  | 'auto_seeder'
  | 'seed_strategist'
  | 'enricher'
  | 'public_trust_check';

export interface AgentMetadata {
  id: AgentId;
  displayName: string;
  codename: string | null;
  subtitle: string;
  color: string;
  category: 'orchestration' | 'intelligence' | 'response' | 'ops' | 'meta' | 'sync';
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
    subtitle: 'Email security scanning + false-positive cleanup + social profile discovery — weekly hygiene + data quality',
    color: '#2DD4BF',
    category: 'ops',
    pipelinePosition: 10,
  },
  // architect — RETIRED 2026-04-29 (Phase 2.2 of agent audit, no runs since 2026-04-11).
  watchdog: {
    id: 'watchdog',
    displayName: 'Watchdog',
    codename: null,
    subtitle: 'Social-mention threat classifier — Haiku-classifies unclassified mentions, escalates high/critical findings to threats',
    color: '#60A5FA',
    category: 'intelligence',
    pipelinePosition: 12,
  },
  cube_healer: {
    id: 'cube_healer',
    displayName: 'Cube Healer',
    codename: null,
    subtitle: 'OLAP cube maintenance — periodic 30-day rebuild + brand summaries',
    color: '#0EA5E9',
    category: 'ops',
    pipelinePosition: 13,
  },
  narrator: {
    id: 'narrator',
    displayName: 'Narrator',
    codename: null,
    subtitle: 'Threat narrative generation — AI-written briefings for active brands',
    color: '#A855F7',
    category: 'intelligence',
    pipelinePosition: 14,
  },
  social_discovery: {
    id: 'social_discovery',
    displayName: 'Social Discovery',
    codename: null,
    subtitle: 'Discovers brand-owned social handles before monitoring them',
    color: '#EC4899',
    category: 'intelligence',
    pipelinePosition: 15,
  },
  social_monitor: {
    id: 'social_monitor',
    displayName: 'Mockingbird',
    codename: 'social_monitor',
    subtitle: 'Catches social impersonators by their mimicry — Twitter/LinkedIn/Instagram/TikTok/GitHub/YouTube',
    color: '#3CB878',
    category: 'intelligence',
    pipelinePosition: 16,
  },
  app_store_monitor: {
    id: 'app_store_monitor',
    displayName: 'App Store Monitor',
    codename: null,
    subtitle: 'iOS App Store impersonation scanner — bundle ID + name similarity',
    color: '#FBBF24',
    category: 'intelligence',
    pipelinePosition: 17,
  },
  dark_web_monitor: {
    id: 'dark_web_monitor',
    displayName: 'Dark Web Monitor',
    codename: null,
    subtitle: 'Pastebin and breach archive monitoring for brand mentions',
    color: '#94A3B8',
    category: 'intelligence',
    pipelinePosition: 18,
  },
  auto_seeder: {
    id: 'auto_seeder',
    displayName: 'Recon',
    codename: 'auto_seeder',
    subtitle: 'Spam-trap seeding agent — plants honeypot addresses into harvester channels and tracks per-location yield',
    color: '#10B981',
    category: 'intelligence',
    pipelinePosition: 19,
  },
  seed_strategist: {
    id: 'seed_strategist',
    displayName: 'Seed Strategist',
    codename: 'seed_strategist',
    subtitle: 'AI plans spam-trap seeding strategy — coverage gaps, channel expansion, retire low-yield addresses',
    color: '#06B6D4',
    category: 'intelligence',
    pipelinePosition: 20,
  },
  enricher: {
    id: 'enricher',
    displayName: 'Enricher',
    codename: 'enricher',
    subtitle: 'Domain geo, brand logo/HQ, and brand sector/RDAP enrichment — runs every hourly tick',
    color: '#22D3EE',
    category: 'ops',
    pipelinePosition: 21,
  },
  public_trust_check: {
    id: 'public_trust_check',
    displayName: 'Public Trust Check',
    codename: 'public_trust_check',
    subtitle: 'Synchronous AI — anonymous /api/v1/public/assess homepage trust-score lookups (Haiku, prompt-injection-hardened)',
    color: '#A855F7',
    category: 'sync',
    pipelinePosition: 22,
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
