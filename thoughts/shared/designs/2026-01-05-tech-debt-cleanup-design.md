---
date: 2026-01-05
topic: "Brainstormer Tech Debt Cleanup"
status: validated
---

# Brainstormer Tech Debt Cleanup

## Problem Statement

The brainstormer plugin has accumulated technical debt across four areas:

1. **Type Safety**: Unsafe casts throughout, `any` usage at critical integration points, no runtime validation of LLM responses
2. **Test Coverage**: Core paths untested - `orchestrator.run()` happy path, `callProbe()`, WebSocket lifecycle, plugin initialization
3. **Code Quality**: Long methods (95+ lines), DRY violations in waiter pattern, magic numbers
4. **Race Conditions**: Waiter arrays mutated during concurrent access

This cleanup addresses all four areas in a single coordinated effort.

## Constraints

- No breaking changes to public API (tool signatures, agent configs)
- Must maintain backward compatibility with existing sessions
- Use immutable approach for race condition fix (not queue-based)
- Follow existing patterns (BrainstormError, factory functions, bun:test)

## Approach

**Single-pass refactoring with TDD**: Write tests first for untested paths, then refactor with confidence. Address all four areas together since they're interconnected - type safety improvements enable better tests, tests enable safe refactoring.

**Why this approach**: 
- Avoids multiple refactoring passes over same code
- Tests written against current behavior catch regressions during refactor
- Type improvements surface hidden bugs before they reach production

## Architecture

No architectural changes. This is internal cleanup - same module boundaries, same public interfaces.

## Components

### 1. Type Validation Layer (New)

**Location**: `src/tools/brainstorm/validation.ts`

**Responsibility**: Runtime validation of LLM responses before casting. Provides type guards that narrow types safely.

**Key type guards needed**:
- `isProbeResponse(unknown): response is ProbeResponse` - validates probe LLM output
- `isQuestionConfig(type, unknown): config is QuestionConfig` - validates question configs by type
- `isAnswerResponse(type, unknown): response is AnswerResponse` - validates answer structure by question type

**Integration points**:
- `parseProbeResponse()` uses `isProbeResponse()` before returning
- `formatAnswer()` uses `isAnswerResponse()` in each switch case

### 2. Immutable Waiter Management (Refactor)

**Location**: `src/session/manager.ts`

**Current problem**: 
```typescript
// Mutates array that may be accessed concurrently
sessionWaiters.shift()!;
this.sessionWaiters.set(sessionId, sessionWaiters);
```

**New approach**: Never mutate - always create new arrays:
```
- When adding waiter: create new array with waiter appended
- When removing waiter: create new array without that waiter
- When resolving waiter: get first, set map to tail of array
```

**Key principle**: The Map always contains the source of truth. Each operation reads current state, computes new state, writes new state. No in-place mutation.

### 3. Extracted Waiter Helper (New)

**Location**: `src/session/waiter.ts`

**Responsibility**: Encapsulate the waiter registration pattern used in both `getAnswer()` and `getNextAnswer()`.

**Interface concept**:
- Takes: timeout duration, waiter map, key, response validator
- Returns: Promise that resolves with validated response or rejects on timeout
- Handles: timeout cleanup, waiter registration, immutable map updates

**Benefits**:
- DRY: Single implementation of timeout + waiter pattern
- Testable: Can unit test waiter logic in isolation
- Type-safe: Generic over response type with validator

### 4. Plugin Entry Point Types (Fix)

**Location**: `src/index.ts`

**Current problem**:
```typescript
execute: async (args: any, toolCtx: any) => {
```

**Fix**: Import proper types from OpenCode plugin SDK. The `toolCtx` should have a defined interface with `sessionID` property. The `args` type should match the wrapped tool's args type.

### 5. Constants Module (New)

**Location**: `src/constants.ts`

**Responsibility**: Central location for magic numbers currently scattered in code.

**Values to extract**:
- `DEFAULT_ANSWER_TIMEOUT_MS = 300000` (5 minutes)
- `DEFAULT_MAX_QUESTIONS = 15`
- `DEFAULT_PROBE_MODEL = "anthropic/claude-sonnet-4"`
- `DEFAULT_AGENT_MODEL = "anthropic/claude-opus-4-5"`
- `DEFAULT_AGENT_TEMPERATURE = 0.7`

## Data Flow

No changes to data flow. Internal implementation changes only.

## Error Handling Strategy

### Validation Errors

When LLM response fails validation:
1. Throw `BrainstormError` with type `"invalid_response"`
2. Include the actual response in error for debugging
3. Include which validation failed (e.g., "missing 'done' field", "invalid question type 'foo'")

### Waiter Timeout Errors

Current behavior preserved - return status object with `status: "timeout"` rather than throwing.

### Cleanup Errors

Current silent swallowing is acceptable for cleanup - add logging instead of throwing:
```
Log warning with session ID and error, but don't propagate
```

## Testing Strategy

### New Unit Tests

**`tests/tools/brainstorm/validation.test.ts`**:
- Test each type guard with valid input
- Test each type guard with various invalid inputs
- Test edge cases (null, undefined, wrong types)

**`tests/session/waiter.test.ts`**:
- Test successful waiter resolution
- Test timeout behavior
- Test multiple concurrent waiters
- Test immutability (original map unchanged)

**`tests/index.test.ts`**:
- Test plugin initialization
- Test session tracking on start_session
- Test cleanup on session.deleted event
- Test cleanup when no sessions exist

### New Integration Tests

**`tests/integration/orchestrator-flow.test.ts`**:
- Test complete happy path: start -> answer -> probe -> follow-up -> done -> summary
- Test max questions limit reached
- Test timeout during answer collection
- Test probe returning done immediately

### Existing Test Updates

**`tests/tools/brainstorm/probe.test.ts`**:
- Add tests for `callProbe()` with mocked client
- Add tests for all question types in `formatAnswer()`
- Add tests for markdown code block stripping

**`tests/session/manager.test.ts`**:
- Add tests for `handleWsConnect()`
- Add tests for `handleWsDisconnect()`
- Add tests for concurrent waiter scenarios

## Open Questions

None - design is complete pending validation.
