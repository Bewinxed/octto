// src/tools/brainstorm/validation.ts
// Runtime validation for LLM responses

import type { QuestionType } from "../../session/types";
import type { ProbeResponse, ProbeResponseDone, ProbeResponseContinue } from "./types";

/** All valid question types */
const VALID_QUESTION_TYPES: readonly string[] = [
  "pick_one",
  "pick_many",
  "confirm",
  "rank",
  "rate",
  "ask_text",
  "ask_image",
  "ask_file",
  "ask_code",
  "show_diff",
  "show_plan",
  "show_options",
  "review_section",
  "thumbs",
  "emoji_react",
  "slider",
] as const;

/**
 * Type guard to check if a value is a valid QuestionType
 */
export function isValidQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && VALID_QUESTION_TYPES.includes(value);
}

/**
 * Type guard for ProbeResponseDone
 */
export function isProbeResponseDone(value: unknown): value is ProbeResponseDone {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return obj.done === true && typeof obj.reason === "string";
}

/**
 * Type guard for ProbeResponseContinue
 */
export function isProbeResponseContinue(value: unknown): value is ProbeResponseContinue {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;

  if (obj.done !== false || typeof obj.reason !== "string") {
    return false;
  }

  if (obj.question === null || typeof obj.question !== "object") {
    return false;
  }

  const question = obj.question as Record<string, unknown>;
  if (!isValidQuestionType(question.type)) {
    return false;
  }

  if (question.config === null || typeof question.config !== "object") {
    return false;
  }

  return true;
}

/**
 * Type guard for ProbeResponse (either done or continue)
 */
export function isProbeResponse(value: unknown): value is ProbeResponse {
  return isProbeResponseDone(value) || isProbeResponseContinue(value);
}
