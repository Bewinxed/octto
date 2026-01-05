// tests/tools/brainstorm/orchestrator.test.ts
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { BrainstormOrchestrator } from "../../../src/tools/brainstorm/orchestrator";
import { SessionManager } from "../../../src/session/manager";
import type { BrainstormInput } from "../../../src/tools/brainstorm/types";

describe("BrainstormOrchestrator", () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager({ skipBrowser: true });
  });

  afterEach(async () => {
    await sessionManager.cleanup();
  });

  describe("constructor", () => {
    it("should create orchestrator with required dependencies", () => {
      const mockClient = {} as any;
      const orchestrator = new BrainstormOrchestrator(sessionManager, mockClient, "test-session");

      expect(orchestrator).toBeDefined();
    });
  });

  describe("extractQuestionText", () => {
    it("should extract question text from config", () => {
      const orchestrator = new BrainstormOrchestrator(sessionManager, {} as any, "test-session");

      const config = { question: "What is your goal?" };
      expect(orchestrator.extractQuestionText(config)).toBe("What is your goal?");
    });

    it("should return empty string for missing question", () => {
      const orchestrator = new BrainstormOrchestrator(sessionManager, {} as any, "test-session");

      expect(orchestrator.extractQuestionText({})).toBe("");
    });
  });

  describe("run", () => {
    it("should fail with empty initial questions", async () => {
      const mockClient = {} as any;
      const orchestrator = new BrainstormOrchestrator(sessionManager, mockClient, "test-session");

      const input: BrainstormInput = {
        context: "Test context",
        request: "Test request",
        initial_questions: [],
      };

      await expect(orchestrator.run(input)).rejects.toThrow("At least one initial question is required");
    });
  });
});
