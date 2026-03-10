/**
 * Agent registry — maps agent names to modules.
 */

import type { AgentModule } from "../lib/agentRunner";
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

export const agentModules: Record<string, AgentModule> = {
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
};
