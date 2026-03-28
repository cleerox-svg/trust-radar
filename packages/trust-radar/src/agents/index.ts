/**
 * Agent registry — maps agent names to modules.
 *
 * Canonical agents:
 *   sentinel (5min/event), analyst (15min), cartographer (15min), strategist (6h),
 *   observer (daily), nexus (4h), prospector (weekly), sparrow (6h)
 */

import type { AgentModule } from "../lib/agentRunner";

import { sentinelAgent } from "./sentinel";
import { analystAgent } from "./analyst";
import { cartographerAgent } from "./cartographer";
import { strategistAgent } from "./strategist";
import { observerAgent } from "./observer";
import { prospectorAgent } from "./prospector";
import { sparrowAgent } from "./sparrow";
import { nexusAgent } from "./nexus";
import { flightControlAgent } from "./flightControl";
import { curatorAgent } from "./curator";

// TrustBot is a utility module for the /api/trustbot/chat endpoint — not a scheduled/event agent
export { trustbotAgent } from "./trustbot";

export const agentModules: Record<string, AgentModule> = {
  "sentinel": sentinelAgent,
  "analyst": analystAgent,
  "cartographer": cartographerAgent,
  "strategist": strategistAgent,
  "observer": observerAgent,
  "prospector": prospectorAgent,
  "sparrow": sparrowAgent,
  "nexus": nexusAgent,
  "flight_control": flightControlAgent,
  "curator": curatorAgent,
};
