// src/tools/index.ts

import type { AgentConfig } from "@opencode-ai/sdk";

import type { AGENTS } from "@/agents";
import type { SessionStore } from "@/session";

import { createBrainstormTools } from "./brainstorm";
import { createPushQuestionTool } from "./factory";
import { createQuestionTools } from "./questions";
import { createResponseTools } from "./responses";
import { createSessionTools } from "./session";
import type { OcttoTools, OpencodeClient } from "./types";

export function createOcttoTools(
  sessions: SessionStore,
  client: OpencodeClient,
  agentConfigs: Record<AGENTS, AgentConfig>,
): OcttoTools {
  return {
    ...createSessionTools(sessions),
    ...createQuestionTools(sessions),
    ...createResponseTools(sessions),
    ...createPushQuestionTool(sessions),
    ...createBrainstormTools(sessions, client, agentConfigs.probe),
  };
}
