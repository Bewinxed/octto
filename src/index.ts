// src/index.ts

import { agents } from "@agents";
import { loadCustomConfig } from "@config";
import type { Plugin } from "@opencode-ai/plugin";
import type { ToolContext } from "@opencode-ai/plugin/tool";
import { createSessionStore } from "@session";
import { createOcttoTools } from "@tools";

const Octto: Plugin = async (ctx) => {
  const customConfig = await loadCustomConfig(agents);

  const sessions = createSessionStore();
  const sessionsByOpenCodeSession = new Map<string, Set<string>>();

  const baseTools = createOcttoTools(sessions, ctx.client);

  // Wrap start_session to track for cleanup
  const originalStartSession = baseTools.start_session;
  const wrappedStartSession = {
    ...originalStartSession,
    execute: async (args: Record<string, unknown>, toolCtx: ToolContext) => {
      type StartSessionArgs = Parameters<typeof originalStartSession.execute>[0];
      const result = await originalStartSession.execute(args as StartSessionArgs, toolCtx);

      const sessionIdMatch = result.match(/ses_[a-z0-9]+/);
      if (sessionIdMatch && toolCtx.sessionID) {
        const octtoSessionId = sessionIdMatch[0];
        const openCodeSessionId = toolCtx.sessionID;

        if (!sessionsByOpenCodeSession.has(openCodeSessionId)) {
          sessionsByOpenCodeSession.set(openCodeSessionId, new Set());
        }
        sessionsByOpenCodeSession.get(openCodeSessionId)!.add(octtoSessionId);
      }

      return result;
    },
  };

  return {
    tool: {
      ...baseTools,
      start_session: wrappedStartSession,
    },

    config: async (config) => {
      config.agent = {
        ...config.agent,
        ...customConfig,
      };
    },

    event: async ({ event }) => {
      if (event.type === "session.deleted") {
        const props = event.properties as { info?: { id?: string } } | undefined;
        const openCodeSessionId = props?.info?.id;

        if (openCodeSessionId) {
          const octtoSessions = sessionsByOpenCodeSession.get(openCodeSessionId);
          if (octtoSessions) {
            for (const sessionId of octtoSessions) {
              await sessions.endSession(sessionId);
            }
            sessionsByOpenCodeSession.delete(openCodeSessionId);
          }
        }
      }
    },
  };
};

export default Octto;

export type * from "./types";
