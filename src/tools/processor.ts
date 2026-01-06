// src/tools/processor.ts

import type { QuestionConfig, QuestionType, SessionStore } from "@/session";
import type { StateStore } from "@/state";

import { evaluateBranch } from "./probe-logic";

export async function processAnswer(
  stateStore: StateStore,
  sessions: SessionStore,
  sessionId: string,
  browserSessionId: string,
  questionId: string,
  answer: unknown,
): Promise<void> {
  const state = await stateStore.getSession(sessionId);
  if (!state) return;

  // Find which branch this question belongs to
  let branchId: string | null = null;
  for (const [id, branch] of Object.entries(state.branches)) {
    if (branch.questions.some((q) => q.id === questionId)) {
      branchId = id;
      break;
    }
  }

  if (!branchId) return;
  if (state.branches[branchId].status === "done") return;

  // Record the answer
  try {
    await stateStore.recordAnswer(sessionId, questionId, answer);
  } catch (error) {
    console.error(`[octto] Failed to record answer for ${questionId}:`, error);
    throw error;
  }

  // Get fresh state after recording
  const updatedState = await stateStore.getSession(sessionId);
  if (!updatedState) return;

  const branch = updatedState.branches[branchId];
  if (!branch || branch.status === "done") return;

  // Evaluate and act
  const result = evaluateBranch(branch);

  if (result.done) {
    await stateStore.completeBranch(sessionId, branchId, result.finding || "No finding");
    return;
  }

  if (result.question) {
    const questionText =
      typeof result.question.config === "object" && "question" in result.question.config
        ? String((result.question.config as { question: string }).question)
        : "Follow-up question";

    const originalConfig = result.question.config as unknown as Record<string, unknown>;
    const configWithContext = {
      ...originalConfig,
      context: `[${branch.scope}] ${originalConfig.context || ""}`.trim(),
    };

    const { question_id: newQuestionId } = sessions.pushQuestion(
      browserSessionId,
      result.question.type as QuestionType,
      configWithContext as QuestionConfig,
    );

    await stateStore.addQuestionToBranch(sessionId, branchId, {
      id: newQuestionId,
      type: result.question.type as QuestionType,
      text: questionText,
      config: configWithContext as QuestionConfig,
    });
  }
}
