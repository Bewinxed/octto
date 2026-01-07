# octto

OpenCode plugin that turns rough ideas into designs through parallel branch exploration with an interactive browser UI.

## The Problem

Traditional AI brainstorming is **slow and tedious**:
- Agent asks question → you wait → type answer → agent thinks → asks next question
- Sequential, one at a time
- 10+ minutes of back-and-forth

## The Solution

Octto flips the model: **parallel exploration with an interactive browser UI**.

```
         ┌─ Branch 1: Q1 → Answer → Q2 → Finding
Request ─┼─ Branch 2: Q1 → Answer → Finding
         └─ Branch 3: Q1 → Answer → Q2 → Q3 → Finding
                    ↑
           All visible at once in browser
```

**What changes:**
- All questions visible immediately in a browser window
- Answer in any order, at your pace
- Probe agents evaluate branches in parallel (async)
- Each branch gets exactly the depth it needs
- **2-3 minutes** instead of 10+

## Quick Start

Add to `~/.config/opencode/opencode.json`:

```json
{ "plugin": ["/path/to/octto"] }
```

Select the **octto** agent, then describe your idea:

```
I want to add a caching layer to the API
```

A browser window opens. Answer the questions. Get a design document.

## The Interactive Browser UI

This is the key innovation. Instead of terminal back-and-forth:

- **Visual question cards** with rich input types (dropdowns, sliders, code editors)
- **Live queue** showing remaining questions and completed answers
- **Parallel answering** - see all branches, answer in any order
- **Instant feedback** - new follow-up questions appear as you answer
- **Final review** - approve the consolidated plan before saving

### 14 Question Types

| Type | Use Case |
|------|----------|
| `pick_one` | Single choice with options |
| `pick_many` | Multiple selection |
| `confirm` | Yes/No decisions |
| `ask_text` | Free-form text |
| `slider` | Numeric range |
| `rank` | Order items by priority |
| `rate` | Score items (stars) |
| `thumbs` | Quick up/down feedback |
| `show_options` | Options with pros/cons |
| `show_diff` | Code diff review |
| `ask_code` | Code input with syntax highlighting |
| `ask_image` | Image upload |
| `ask_file` | File upload |
| `emoji_react` | Emoji selection |

## How It Works

### 3 Specialized Agents

| Agent | Role |
|-------|------|
| **octto** | Orchestrator - runs the session |
| **bootstrapper** | Analyzes request, creates 2-4 exploration branches |
| **probe** | Evaluates each branch, decides depth adaptively |

### The Flow

1. **Decomposition**: Bootstrapper analyzes your request, creates 2-4 branches. Each explores ONE aspect (e.g., "security", "data format", "dependencies").

2. **Initial Questions**: Each branch gets an initial question. All appear in the browser simultaneously.

3. **Parallel Answering**: Answer at your own pace, any order. No blocking.

4. **Adaptive Depth**: When you answer, a probe agent evaluates:
   - Need more info? → Generates follow-up question
   - Understood? → Synthesizes finding, completes branch

5. **Intelligent Completion**: Each branch continues until the probe feels confident. Some need 2 questions, others 4.

6. **Final Review**: All findings consolidated into a plan. Approve or request changes.

7. **Output**: Design saved to `docs/plans/YYYY-MM-DD-{topic}-design.md`

## Architecture

### Dual Session System

| Session | Purpose | Storage |
|---------|---------|---------|
| **State Session** | Branch state, Q&A history, findings | `.octto/{id}.json` |
| **Browser Session** | WebSocket, pending questions, live UI | In-memory |

### Tools

| Tool | Description |
|------|-------------|
| `create_brainstorm` | Create session with branches, open browser |
| `await_brainstorm_complete` | Process answers until all branches done |
| `end_brainstorm` | Close session, return findings |

## Configuration

Optionally configure in `~/.config/opencode/octto.json`:

```json
{
  "agents": {
    "octto": { "model": "anthropic/claude-opus-4" },
    "bootstrapper": { "model": "anthropic/claude-sonnet-4" },
    "probe": { "model": "anthropic/claude-sonnet-4" }
  }
}
```

## Development

```bash
bun install
bun run build
bun test
```

## Why Branches?

| Sequential (old) | Parallel (octto) |
|------------------|------------------|
| One question at a time | All questions visible at once |
| Wait for agent between each | Async processing, no waiting |
| Fixed depth | Adaptive depth per branch |
| 10+ minutes | 2-3 minutes |
| Terminal typing | Visual browser UI |

## License

MIT
