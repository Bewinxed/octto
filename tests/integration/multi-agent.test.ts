// tests/integration/multi-agent.test.ts
import { describe, it, expect } from "bun:test";
import { buildProbeContext, formatAnswer, type QAPair } from "../../src/agents/context";

describe("Multi-Agent Integration", () => {
  describe("Bootstrapper JSON parsing", () => {
    it("should parse valid bootstrapper response", () => {
      const bootstrapperResponse = `[
        {
          "type": "pick_one",
          "config": {
            "question": "What's the primary goal?",
            "options": [
              {"id": "speed", "label": "Fast performance"},
              {"id": "simple", "label": "Simplicity"}
            ]
          }
        },
        {
          "type": "ask_text",
          "config": {
            "question": "Any constraints?",
            "placeholder": "e.g., must work offline..."
          }
        }
      ]`;

      const questions = JSON.parse(bootstrapperResponse);

      expect(questions).toHaveLength(2);
      expect(questions[0].type).toBe("pick_one");
      expect(questions[0].config.question).toBe("What's the primary goal?");
      expect(questions[1].type).toBe("ask_text");
    });

    it("should handle bootstrapper response with extra whitespace", () => {
      const bootstrapperResponse = `
      
      [{"type": "confirm", "config": {"question": "Ready?"}}]
      
      `;

      const questions = JSON.parse(bootstrapperResponse.trim());

      expect(questions).toHaveLength(1);
      expect(questions[0].type).toBe("confirm");
    });
  });

  describe("Probe JSON parsing", () => {
    it("should parse probe response with question", () => {
      const probeResponse = `{
        "done": false,
        "reason": "Need to understand scale requirements",
        "question": {
          "type": "slider",
          "config": {
            "question": "Expected number of users?",
            "min": 1,
            "max": 1000000,
            "defaultValue": 1000
          }
        }
      }`;

      const result = JSON.parse(probeResponse);

      expect(result.done).toBe(false);
      expect(result.reason).toBe("Need to understand scale requirements");
      expect(result.question.type).toBe("slider");
      expect(result.question.config.min).toBe(1);
    });

    it("should parse probe done response", () => {
      const probeResponse = `{
        "done": true,
        "reason": "All key decisions have been made"
      }`;

      const result = JSON.parse(probeResponse);

      expect(result.done).toBe(true);
      expect(result.reason).toBe("All key decisions have been made");
      expect(result.question).toBeUndefined();
    });
  });

  describe("Full context building flow", () => {
    it("should build context through multiple Q&A rounds", () => {
      const originalRequest = "Build a task management CLI";
      const qaPairs: QAPair[] = [];

      // Round 1: pick_one
      qaPairs.push({
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
      });

      let context = buildProbeContext(originalRequest, qaPairs);
      expect(context).toContain("Build a task management CLI");
      expect(context).toContain('A1: User selected "Simplicity"');

      // Round 2: ask_text
      qaPairs.push({
        questionNumber: 2,
        questionType: "ask_text",
        questionText: "Any specific constraints?",
        answer: { text: "Must work offline, no cloud sync" },
        config: {},
      });

      context = buildProbeContext(originalRequest, qaPairs);
      expect(context).toContain('A2: User wrote: "Must work offline, no cloud sync"');

      // Round 3: pick_many
      qaPairs.push({
        questionNumber: 3,
        questionType: "pick_many",
        questionText: "Which features are essential?",
        answer: { selected: ["tags", "due"] },
        config: {
          options: [
            { id: "tags", label: "Tags/Labels" },
            { id: "due", label: "Due dates" },
            { id: "priority", label: "Priority levels" },
          ],
        },
      });

      context = buildProbeContext(originalRequest, qaPairs);
      expect(context).toContain('A3: User selected: "Tags/Labels", "Due dates"');

      // Verify full context structure
      expect(context).toContain("ORIGINAL REQUEST:");
      expect(context).toContain("CONVERSATION:");
      expect(context).toContain("Q1 [pick_one]:");
      expect(context).toContain("Q2 [ask_text]:");
      expect(context).toContain("Q3 [pick_many]:");
    });
  });
});
