// tests/tools/branch.test.ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";

import { SessionManager } from "../../src/session/manager";
import { StateManager } from "../../src/state/manager";
import { createBranchTools } from "../../src/tools/branch";

const TEST_DIR = "/tmp/octto-branch-test";

describe("Branch Tools", () => {
  let stateManager: StateManager;
  let sessionManager: SessionManager;
  let tools: ReturnType<typeof createBranchTools>;

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    stateManager = new StateManager(TEST_DIR);
    sessionManager = new SessionManager({ skipBrowser: true });
    tools = createBranchTools(stateManager, sessionManager);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("create_brainstorm", () => {
    it("should create brainstorm session with branches", async () => {
      const result = await tools.create_brainstorm.execute(
        {
          request: "Add healthcheck",
          branches: [
            {
              id: "services",
              scope: "Which services to monitor",
              initial_question: {
                type: "ask_text",
                config: { question: "What services?" },
              },
            },
          ],
        },
        {} as any,
      );

      expect(result).toContain("ses_");
      expect(result).toContain("services");
    });
  });
});
