// tests/tools/brainstorm/validation.test.ts
import { describe, it, expect } from "bun:test";
import {
  isProbeResponse,
  isProbeResponseDone,
  isProbeResponseContinue,
  isValidQuestionType,
} from "../../../src/tools/brainstorm/validation";

describe("validation", () => {
  describe("isValidQuestionType", () => {
    it("should return true for valid question types", () => {
      expect(isValidQuestionType("pick_one")).toBe(true);
      expect(isValidQuestionType("pick_many")).toBe(true);
      expect(isValidQuestionType("confirm")).toBe(true);
      expect(isValidQuestionType("ask_text")).toBe(true);
      expect(isValidQuestionType("slider")).toBe(true);
    });

    it("should return false for invalid question types", () => {
      expect(isValidQuestionType("invalid")).toBe(false);
      expect(isValidQuestionType("")).toBe(false);
      expect(isValidQuestionType(null)).toBe(false);
      expect(isValidQuestionType(undefined)).toBe(false);
      expect(isValidQuestionType(123)).toBe(false);
    });
  });

  describe("isProbeResponseDone", () => {
    it("should return true for valid done response", () => {
      const response = { done: true, reason: "Design complete" };
      expect(isProbeResponseDone(response)).toBe(true);
    });

    it("should return false when done is false", () => {
      const response = { done: false, reason: "Need more info" };
      expect(isProbeResponseDone(response)).toBe(false);
    });

    it("should return false for non-objects", () => {
      expect(isProbeResponseDone(null)).toBe(false);
      expect(isProbeResponseDone(undefined)).toBe(false);
      expect(isProbeResponseDone("string")).toBe(false);
      expect(isProbeResponseDone(123)).toBe(false);
    });

    it("should return false when done is not boolean", () => {
      expect(isProbeResponseDone({ done: "true", reason: "test" })).toBe(false);
      expect(isProbeResponseDone({ done: 1, reason: "test" })).toBe(false);
    });

    it("should return false when reason is missing", () => {
      expect(isProbeResponseDone({ done: true })).toBe(false);
    });
  });

  describe("isProbeResponseContinue", () => {
    it("should return true for valid continue response", () => {
      const response = {
        done: false,
        reason: "Need more info",
        question: {
          type: "pick_one",
          config: { question: "Test?", options: [] },
        },
      };
      expect(isProbeResponseContinue(response)).toBe(true);
    });

    it("should return false when done is true", () => {
      const response = {
        done: true,
        reason: "Complete",
        question: { type: "pick_one", config: {} },
      };
      expect(isProbeResponseContinue(response)).toBe(false);
    });

    it("should return false when question is missing", () => {
      const response = { done: false, reason: "Need more" };
      expect(isProbeResponseContinue(response)).toBe(false);
    });

    it("should return false when question.type is invalid", () => {
      const response = {
        done: false,
        reason: "Need more",
        question: { type: "invalid_type", config: {} },
      };
      expect(isProbeResponseContinue(response)).toBe(false);
    });

    it("should return false when question.config is not an object", () => {
      const response = {
        done: false,
        reason: "Need more",
        question: { type: "pick_one", config: "not an object" },
      };
      expect(isProbeResponseContinue(response)).toBe(false);
    });
  });

  describe("isProbeResponse", () => {
    it("should return true for valid done response", () => {
      const response = { done: true, reason: "Complete" };
      expect(isProbeResponse(response)).toBe(true);
    });

    it("should return true for valid continue response", () => {
      const response = {
        done: false,
        reason: "Need more",
        question: { type: "confirm", config: { question: "Sure?" } },
      };
      expect(isProbeResponse(response)).toBe(true);
    });

    it("should return false for invalid responses", () => {
      expect(isProbeResponse(null)).toBe(false);
      expect(isProbeResponse({})).toBe(false);
      expect(isProbeResponse({ done: "maybe" })).toBe(false);
    });
  });
});
