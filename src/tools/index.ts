// src/tools/index.ts

import type { OpencodeClient } from "@opencode-ai/sdk";

import type { SessionStore } from "@/session";
import { createStateStore } from "@/state";

import { createBranchTools } from "./branch";
import { createPushQuestionTool } from "./factory";
import { createQuestionTools } from "./questions";
import { createResponseTools } from "./responses";
import { createSessionTools } from "./session";
import type { OcttoTools } from "./types";

export function createOcttoTools(sessions: SessionStore, _client?: OpencodeClient): OcttoTools {
  const stateStore = createStateStore();

  return {
    ...createSessionTools(sessions),
    ...createQuestionTools(sessions),
    ...createResponseTools(sessions),
    ...createPushQuestionTool(sessions),
    ...createBranchTools(stateStore, sessions),
  };
}
