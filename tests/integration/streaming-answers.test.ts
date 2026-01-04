// tests/integration/streaming-answers.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SessionManager } from "../../src/session/manager";
import { buildProbeContext, type QAPair, type PendingQuestion } from "../../src/agents/context";

describe("Streaming Answer Processing", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager({ skipBrowser: true });
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe("Context building with partial answers", () => {
    it("should build context after first answer with pending questions", () => {
      const originalRequest = "Build a task manager CLI";

      // Simulate: 3 initial questions, user answered Q1 only
      const answeredQAs: QAPair[] = [
        {
          questionNumber: 1,
          questionType: "pick_one",
          questionText: "What's the primary goal?",
          answer: { selected: "simple" },
          config: {
            options: [
              { id: "speed", label: "Fast performance" },
              { id: "simple", label: "Simplicity" },
            ],
          },
        },
      ];

      const pendingQuestions: PendingQuestion[] = [
        { questionNumber: 2, questionType: "ask_text", questionText: "Any constraints?" },
        { questionNumber: 3, questionType: "pick_many", questionText: "Which features?" },
      ];

      const context = buildProbeContext(originalRequest, answeredQAs, pendingQuestions);

      // Verify context structure
      expect(context).toContain("ORIGINAL REQUEST:");
      expect(context).toContain("Build a task manager CLI");
      expect(context).toContain("CONVERSATION:");
      expect(context).toContain("Q1 [pick_one]: What's the primary goal?");
      expect(context).toContain('A1: User selected "Simplicity"');
      expect(context).toContain("PENDING QUESTIONS:");
      expect(context).toContain("Q2 [ask_text]: Any constraints?");
      expect(context).toContain("Q3 [pick_many]: Which features?");
    });

    it("should update context as more answers come in", () => {
      const originalRequest = "Build a task manager CLI";

      // Round 1: Q1 answered, Q2 and Q3 pending
      let answeredQAs: QAPair[] = [
        {
          questionNumber: 1,
          questionType: "pick_one",
          questionText: "What's the primary goal?",
          answer: { selected: "simple" },
          config: { options: [{ id: "simple", label: "Simplicity" }] },
        },
      ];
      let pendingQuestions: PendingQuestion[] = [
        { questionNumber: 2, questionType: "ask_text", questionText: "Any constraints?" },
        { questionNumber: 3, questionType: "pick_many", questionText: "Which features?" },
      ];

      let context = buildProbeContext(originalRequest, answeredQAs, pendingQuestions);
      expect(context).toContain("Q1 [pick_one]");
      expect(context).toContain("PENDING QUESTIONS:");
      expect(context).toContain("Q2 [ask_text]");

      // Round 2: Q1 and Q2 answered, Q3 pending
      answeredQAs = [
        ...answeredQAs,
        {
          questionNumber: 2,
          questionType: "ask_text",
          questionText: "Any constraints?",
          answer: { text: "Must work offline" },
          config: {},
        },
      ];
      pendingQuestions = [{ questionNumber: 3, questionType: "pick_many", questionText: "Which features?" }];

      context = buildProbeContext(originalRequest, answeredQAs, pendingQuestions);
      expect(context).toContain("Q1 [pick_one]");
      expect(context).toContain("Q2 [ask_text]");
      expect(context).toContain('A2: User wrote: "Must work offline"');
      expect(context).toContain("PENDING QUESTIONS:");
      expect(context).toContain("Q3 [pick_many]");

      // Round 3: All answered, no pending
      answeredQAs = [
        ...answeredQAs,
        {
          questionNumber: 3,
          questionType: "pick_many",
          questionText: "Which features?",
          answer: { selected: ["tags", "due"] },
          config: {
            options: [
              { id: "tags", label: "Tags" },
              { id: "due", label: "Due dates" },
            ],
          },
        },
      ];
      pendingQuestions = [];

      context = buildProbeContext(originalRequest, answeredQAs, pendingQuestions);
      expect(context).toContain("Q3 [pick_many]");
      expect(context).toContain('A3: User selected: "Tags", "Due dates"');
      expect(context).not.toContain("PENDING QUESTIONS:");
    });
  });

  describe("Session flow with streaming answers", () => {
    it("should allow probe to be spawned after each answer", async () => {
      const { session_id } = await manager.startSession({ title: "Streaming Test" });

      // Push 3 initial questions (simulating bootstrapper output)
      const q1 = manager.pushQuestion(session_id, "pick_one", {
        question: "What's the primary goal?",
        options: [
          { id: "speed", label: "Fast" },
          { id: "simple", label: "Simple" },
        ],
      });
      const q2 = manager.pushQuestion(session_id, "ask_text", {
        question: "Any constraints?",
      });
      const q3 = manager.pushQuestion(session_id, "pick_many", {
        question: "Which features?",
        options: [
          { id: "tags", label: "Tags" },
          { id: "due", label: "Due dates" },
        ],
      });

      // User answers Q1 first
      manager.handleWsMessage(session_id, {
        type: "response",
        id: q1.question_id,
        answer: { selected: "simple" },
      });

      // get_next_answer should return Q1 immediately
      const r1 = await manager.getNextAnswer({ session_id, block: false });
      expect(r1.completed).toBe(true);
      expect(r1.question_id).toBe(q1.question_id);
      expect(r1.response).toEqual({ selected: "simple" });

      // At this point, brainstormer would spawn probe with partial context
      // Q2 and Q3 are still pending

      // User answers Q3 (out of order)
      manager.handleWsMessage(session_id, {
        type: "response",
        id: q3.question_id,
        answer: { selected: ["tags"] },
      });

      // get_next_answer should return Q3
      const r3 = await manager.getNextAnswer({ session_id, block: false });
      expect(r3.completed).toBe(true);
      expect(r3.question_id).toBe(q3.question_id);

      // Q2 still pending
      const r2check = await manager.getNextAnswer({ session_id, block: false });
      expect(r2check.completed).toBe(false);
      expect(r2check.status).toBe("pending");
    });

    it("should handle probe adding new question while others pending", async () => {
      const { session_id } = await manager.startSession({ title: "Dynamic Questions" });

      // Initial questions
      const q1 = manager.pushQuestion(session_id, "confirm", { question: "Ready?" });
      const q2 = manager.pushQuestion(session_id, "ask_text", { question: "Details?" });

      // Answer Q1
      manager.handleWsMessage(session_id, {
        type: "response",
        id: q1.question_id,
        answer: { choice: "yes" },
      });

      await manager.getNextAnswer({ session_id, block: false });

      // Probe adds a new question (Q3) while Q2 still pending
      const q3 = manager.pushQuestion(session_id, "pick_one", {
        question: "Follow-up from probe?",
        options: [{ id: "a", label: "Option A" }],
      });

      // List should show Q2 (pending) and Q3 (pending)
      const list = manager.listQuestions(session_id);
      const pendingQuestions = list.questions.filter((q) => q.status === "pending");
      expect(pendingQuestions.length).toBe(2);

      // User can answer either Q2 or Q3 next
      manager.handleWsMessage(session_id, {
        type: "response",
        id: q3.question_id,
        answer: { selected: "a" },
      });

      const r3 = await manager.getNextAnswer({ session_id, block: false });
      expect(r3.completed).toBe(true);
      expect(r3.question_id).toBe(q3.question_id);
    });
  });
});
