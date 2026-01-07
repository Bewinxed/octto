// src/agents/index.ts
import type { AgentConfig } from "@opencode-ai/sdk";

import { agent as bootstrapper } from "./bootstrapper";
import { agent as octto } from "./octto";
import { agent as probe } from "./probe";

export enum AGENTS {
  octto = "octto",
  bootstrapper = "bootstrapper",
  probe = "probe",
}

export const agents: Record<AGENTS, AgentConfig> = {
  [AGENTS.octto]: octto,
  [AGENTS.bootstrapper]: bootstrapper,
  [AGENTS.probe]: probe,
};

export { octto, bootstrapper, probe };
