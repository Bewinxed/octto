// tests/integration/branch-flow.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { rmSync } from "fs";
import { StateManager } from "../../src/state/manager";
import { SessionManager } from "../../src/session/manager";
import { createBranchTools } from "../../src/tools/branch";

const TEST_DIR = "/tmp/brainstorm-integration-test";

describe("Branch-Based Brainstorm Flow", () => {
  let stateManager: StateManager;
  let sessionManager: SessionManager;
  let tools: ReturnType<typeof createBranchTools>;

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    stateManager = new StateManager(TEST_DIR);
    sessionManager = new SessionManager({ skipBrowser: true });
    tools = createBranchTools(stateManager, sessionManager);
  });

  afterEach(async () => {
    await sessionManager.cleanup();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should run complete brainstorm flow with multiple branches", async () => {
    // 1. Create brainstorm with two branches
    const createResult = await tools.create_brainstorm.execute({
      request: "Add healthcheck endpoints",
      branches: [
        {
          id: "services",
          scope: "Which services need monitoring",
          initial_question: {
            type: "pick_many",
            config: {
              question: "Which services?",
              options: [
                { id: "db", label: "Database" },
                { id: "cache", label: "Cache" },
              ],
            },
          },
        },
        {
          id: "format",
          scope: "Response format for healthcheck",
          initial_question: {
            type: "pick_one",
            config: {
              question: "What format?",
              options: [
                { id: "simple", label: "Simple" },
                { id: "detailed", label: "Detailed" },
              ],
            },
          },
        },
      ],
    }, {} as any);

    expect(createResult).toContain("ses_");
    expect(createResult).toContain("services");
    expect(createResult).toContain("format");

    // Extract session ID
    const sessionIdMatch = createResult.match(/\*\*Session ID:\*\* (ses_[a-z0-9]+)/);
    expect(sessionIdMatch).not.toBeNull();
    const sessionId = sessionIdMatch![1];

    // 2. Check initial status
    const status1 = await tools.get_branch_status.execute({
      session_id: sessionId,
      branch_id: "services",
    }, {} as any);
    expect(status1).toContain("exploring");
    expect(status1).toContain("Which services need monitoring");

    // 3. Complete first branch
    await tools.complete_branch.execute({
      session_id: sessionId,
      branch_id: "services",
      finding: "Monitor PostgreSQL and Redis",
    }, {} as any);

    // 4. Push follow-up question to second branch
    await tools.push_branch_question.execute({
      session_id: sessionId,
      branch_id: "format",
      question: {
        type: "confirm",
        config: { question: "Include response times?" },
      },
    }, {} as any);

    // 5. Complete second branch
    await tools.complete_branch.execute({
      session_id: sessionId,
      branch_id: "format",
      finding: "Use detailed format with response times",
    }, {} as any);

    // 6. Get summary
    const summary = await tools.get_session_summary.execute({
      session_id: sessionId,
    }, {} as any);
    expect(summary).toContain("COMPLETE");
    expect(summary).toContain("Monitor PostgreSQL and Redis");
    expect(summary).toContain("detailed format");

    // 7. End session
    const endResult = await tools.end_brainstorm.execute({
      session_id: sessionId,
    }, {} as any);
    expect(endResult).toContain("Brainstorm Complete");
    expect(endResult).toContain("Monitor PostgreSQL and Redis");

    // 8. Verify cleanup
    const state = await stateManager.getSession(sessionId);
    expect(state).toBeNull();
  });
});
