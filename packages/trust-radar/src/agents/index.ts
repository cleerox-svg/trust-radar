/**
 * Agent registry — maps agent names to modules.
 *
 * Section 6.9 canonical agents:
 *   sentinel (5min), analyst (15min), cartographer (6h), strategist (6h), observer (daily)
 */

import type { AgentModule } from "../lib/agentRunner";

import { sentinelAgent } from "./sentinel";
import { analystAgent } from "./analyst";
import { cartographerAgent } from "./cartographer";
import { strategistAgent } from "./strategist";
import { observerAgent } from "./observer";
import { prospectorAgent } from "./prospector";

// TrustBot is a utility module for the /api/trustbot/chat endpoint — not a scheduled/event agent
export { trustbotAgent } from "./trustbot";

export const agentModules: Record<string, AgentModule> = {
  "sentinel": sentinelAgent,
  "analyst": analystAgent,
  "cartographer": cartographerAgent,
  "strategist": strategistAgent,
  "observer": observerAgent,
  "prospector": prospectorAgent,
};
