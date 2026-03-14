/**
 * Agent registry — maps agent names to modules.
 *
 * v2 AI agents (Haiku-powered): sentinel, analyst, cartographer, strategist, observer
 * Legacy rule-based agents: triage, threat-hunt, impersonation-detector, etc.
 */

import type { AgentModule } from "../lib/agentRunner";

// v2 AI agents
import { sentinelAgent } from "./sentinel";
import { analystAgent } from "./analyst";
import { cartographerAgent } from "./cartographer";
import { strategistAgent } from "./strategist";
import { observerAgent } from "./observer";

// Legacy rule-based agents
import { triageAgent } from "./triage";
import { threatHuntAgent } from "./threatHunt";
import { impersonationDetectorAgent } from "./impersonationDetector";
import { takedownOrchestratorAgent } from "./takedownOrchestrator";
import { evidencePreservationAgent } from "./evidencePreservation";
import { abuseMailboxAgent } from "./abuseMailbox";
import { campaignCorrelatorAgent } from "./campaignCorrelator";
import { trustScoreMonitorAgent } from "./trustScoreMonitor";
import { executiveIntelAgent } from "./executiveIntel";
import { trustbotAgent } from "./trustbot";
import { hostingProviderAnalysisAgent } from "./hostingProviderAnalysis";

export const agentModules: Record<string, AgentModule> = {
  // v2 AI agents
  "sentinel": sentinelAgent,
  "analyst": analystAgent,
  "cartographer": cartographerAgent,
  "strategist": strategistAgent,
  "observer": observerAgent,
  // Legacy rule-based agents
  "triage": triageAgent,
  "threat-hunt": threatHuntAgent,
  "impersonation-detector": impersonationDetectorAgent,
  "takedown-orchestrator": takedownOrchestratorAgent,
  "evidence-preservation": evidencePreservationAgent,
  "abuse-mailbox": abuseMailboxAgent,
  "campaign-correlator": campaignCorrelatorAgent,
  "trust-score-monitor": trustScoreMonitorAgent,
  "executive-intel": executiveIntelAgent,
  "trustbot": trustbotAgent,
  "hosting-provider-analysis": hostingProviderAnalysisAgent,
};
