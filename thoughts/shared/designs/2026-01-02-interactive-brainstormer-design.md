---
date: 2026-01-02
topic: "Interactive Brainstormer UI"
status: validated
---

# Interactive Brainstormer UI Design

## Problem Statement

The brainstormer agent needs to gather information from users through structured questions during design sessions. Currently, interactions happen through the terminal which is limiting for:
- Complex multi-option selections
- Visual feedback and progress tracking
- Rich input types (images, code, files)
- Reviewing previous answers

We need a browser-based UI that provides a persistent, interactive session for the brainstormer agent to ask questions and collect responses.

## Constraints

- Must work as a standalone OpenCode plugin (reusable by others)
- Must integrate cleanly with micode's brainstormer workflow
- No external dependencies at runtime (self-contained)
- Must handle browser tab close/reopen gracefully
- Agent controls session lifecycle (not user)

## Approach

Build a persistent WebSocket-based UI that:
1. Agent starts session explicitly, browser opens automatically
2. Agent pushes questions (can batch multiple)
3. User answers one at a time, responses return immediately
4. Agent retrieves responses asynchronously (like background tasks)
5. Agent ends session explicitly when done

This mirrors the `background_task` / `background_output` pattern already in micode.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenCode Plugin                          │
├─────────────────────────────────────────────────────────────────┤
│  Tools                                                          │
│  ├── start_session() → session_id, url                         │
│  ├── end_session(session_id)                                   │
│  ├── pick_one/pick_many/confirm/... → question_id              │
│  ├── get_answer(question_id, block?) → response                │
│  ├── list_questions() → status of all questions                │
│  └── cancel_question(question_id)                              │
├─────────────────────────────────────────────────────────────────┤
│  Session Manager                                                │
│  ├── Tracks active sessions per OpenCode session               │
│  ├── Manages question queue per session                        │
│  └── Stores responses until retrieved                          │
├─────────────────────────────────────────────────────────────────┤
│  HTTP Server (Bun.serve)                                        │
│  ├── GET / → Bundled React app (pre-built, embedded)           │
│  ├── WebSocket /ws → Real-time question push, response receive │
│  └── Lifecycle tied to session                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Browser UI                               │
├─────────────────────────────────────────────────────────────────┤
│  React + Tailwind (nof1 styling)                               │
│  ├── Card stack layout                                         │
│  │   ├── Answered questions (collapsed, expandable)            │
│  │   ├── Current question (expanded, interactive)              │
│  │   └── Queue indicator (N more questions)                    │
│  ├── Question components (16 types)                            │
│  └── WebSocket client for real-time updates                    │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Session Manager
- Creates/destroys sessions
- Maps session_id to server instance
- Tracks question queue and responses
- Handles OpenCode session cleanup (via event hook)

### HTTP Server
- Starts on random port (port: 0)
- Serves pre-built React bundle
- WebSocket endpoint for bidirectional communication
- One server per session

### WebSocket Protocol
```
Server → Client:
  { type: "question", id: "q_xxx", questionType: "pick_one", config: {...} }
  { type: "cancel", id: "q_xxx" }
  { type: "end" }

Client → Server:
  { type: "response", id: "q_xxx", answer: {...} }
  { type: "connected" }
```

### Browser Opener
- Detects platform (macOS/Linux/Windows)
- Uses Bun spawn to open default browser
- Re-opens if WebSocket disconnected and new question pushed

### Question Components (16 types)

**Decision/Choice:**
- `PickOne` - Radio buttons with optional "other"
- `PickMany` - Checkboxes with min/max constraints
- `Confirm` - Yes/No/Cancel buttons
- `Rank` - Drag-to-reorder list
- `Rate` - Star rating or numeric scale per item

**Input:**
- `AskText` - Single/multi-line text input
- `AskImage` - Drag/drop, paste, or file picker
- `AskFile` - Generic file upload
- `AskCode` - Syntax-highlighted code editor

**Presentation/Feedback:**
- `ShowDiff` - Before/after with approve/reject/edit
- `ShowPlan` - Markdown sections with annotations
- `ShowOptions` - Pros/cons table with selection
- `ReviewSection` - Content review with inline feedback

**Quick:**
- `Thumbs` - Thumbs up/down
- `EmojiReact` - Emoji picker
- `Slider` - Numeric range slider

## Data Flow

### Starting a Session
```
Agent calls start_session({ title: "Feature Design" })
    ↓
SessionManager creates session, starts server on port 0
    ↓
Browser opens http://localhost:{port}?session={id}
    ↓
React app connects WebSocket
    ↓
Tool returns { session_id: "ses_xxx", url: "http://..." }
```

### Pushing Questions
```
Agent calls pick_one({ question: "...", options: [...] })
    ↓
SessionManager queues question, assigns question_id
    ↓
If WebSocket connected: push immediately
If not connected: queue until reconnect
    ↓
Tool returns { question_id: "q_xxx" } immediately
```

### Receiving Responses
```
User answers question in UI
    ↓
WebSocket sends response to server
    ↓
SessionManager stores response, marks question answered
    ↓
Agent calls get_answer("q_xxx", block=true)
    ↓
Returns response (or waits if not yet answered)
```

### Ending Session
```
Agent calls end_session(session_id)
    ↓
WebSocket sends "end" message
    ↓
Server shuts down
    ↓
Browser shows "Session ended" and closes
```

## Error Handling

### Browser Closed Mid-Session
- Server detects WebSocket disconnect
- Questions continue to queue
- On next `pick_*` call, if no WebSocket: re-open browser
- Browser reconnects, receives queued questions

### Agent Crashes / OpenCode Session Ends
- Plugin hooks into `session.deleted` event
- Cleans up any active brainstormer sessions
- Server shuts down gracefully

### Question Timeout
- Optional timeout per question
- If user doesn't respond within timeout, question marked as timed out
- `get_answer` returns `{ completed: false, reason: "timeout" }`

## Testing Strategy

### Unit Tests
- Session manager lifecycle
- Question queue management
- WebSocket message serialization
- Response storage/retrieval

### Integration Tests
- Full flow: start → push questions → get answers → end
- Browser reconnection handling
- Multiple concurrent sessions

### Manual Testing
- UI component rendering for all 16 question types
- Keyboard navigation
- Mobile responsiveness

## Tools Summary

### Session Management
| Tool | Args | Returns |
|------|------|---------|
| `start_session` | `{ title? }` | `{ session_id, url }` |
| `end_session` | `{ session_id }` | `{ ok: true }` |

### Question Tools (return immediately)
| Tool | Key Args | Returns |
|------|----------|---------|
| `pick_one` | `question, options, recommended?` | `{ question_id }` |
| `pick_many` | `question, options, min?, max?` | `{ question_id }` |
| `confirm` | `question, context?` | `{ question_id }` |
| `rank` | `question, options` | `{ question_id }` |
| `rate` | `question, options, min?, max?` | `{ question_id }` |
| `ask_text` | `question, multiline?, placeholder?` | `{ question_id }` |
| `ask_image` | `question, multiple?` | `{ question_id }` |
| `ask_file` | `question, accept?, multiple?` | `{ question_id }` |
| `ask_code` | `question, language?` | `{ question_id }` |
| `show_diff` | `question, before, after` | `{ question_id }` |
| `show_plan` | `question, sections OR markdown` | `{ question_id }` |
| `show_options` | `question, options (with pros/cons)` | `{ question_id }` |
| `review_section` | `question, content` | `{ question_id }` |
| `thumbs` | `question, context?` | `{ question_id }` |
| `emoji_react` | `question, emojis?` | `{ question_id }` |
| `slider` | `question, min, max, step?` | `{ question_id }` |

### Response Tools
| Tool | Args | Returns |
|------|------|---------|
| `get_answer` | `question_id, block?, timeout?` | Response or status |
| `list_questions` | `{ session_id? }` | All questions with status |
| `cancel_question` | `question_id` | `{ ok: true }` |

## Open Questions

None - all design decisions validated.

## Next Steps

1. Set up project structure (package.json, tsconfig, etc.) ✓
2. Implement session manager
3. Implement HTTP server with WebSocket
4. Build React UI shell with card stack
5. Implement question components one by one
6. Add tool definitions
7. Integration testing
8. Integrate into micode
