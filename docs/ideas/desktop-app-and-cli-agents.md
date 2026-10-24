# Idea: desktop app and coding agents from the app

Status: idea, saved by the owner on 2026-10-24. Not a decision. Not in scope for M0–M9.

## 1. Summary

Build the app as a local-first web app now (M0–M9). Later, package the same app as a desktop app
for Windows and Linux. Also let the owner send work to a coding agent on the CLI (Claude Code,
Codex) from the app, and watch that work in the app.

Goal: one desktop app where the owner works with role bots, manages coding agents, and monitors
their work.

## 2. Parts of the idea

| Part | What the owner wants |
| --- | --- |
| Desktop app | Package the React + Node app for Windows and Linux. Electron is the preferred option, Tauri is the alternative. Do not rewrite the core. |
| Send work to a coding agent | The owner sends an instruction to Claude Code or Codex from the app. |
| Live monitor | The app shows the agent's output, progress, errors and result. |
| Human control | The owner approves sensitive actions, stops a session, and reviews the changes. |
| Separation | Coding agents are separate from role bots. Workspace access and permissions are controlled. |
| Adapters | Replaceable adapters for the web and desktop environments (D35). |
| Timeline | Finish M0–M9 first. Desktop packaging and coding agents come after that. |

## 3. How the idea fits the current spec

| Spec item | Fit | Note |
| --- | --- | --- |
| D35 ports and adapters | Good | A coding agent is a new port with one adapter per CLI. The desktop shell is a new way to start the backend. `core/` does not change. |
| D23 external project folders | Good | D23 already says: "running builds or tests is handed to a coding agent (Claude Code, Codex), not grown inside the app". A coding agent works in an attached project folder, on its own branch (D52). |
| D48 plan first, D41 approval cards | Good | The approval card pattern can show the agent's permission requests. |
| D9 SSE event log, D26 Flow pane | Good | Agent output can become events and run steps, so the monitor reuses the stream and the Flow pane. |
| Product brief non-goal "A coding IDE" (Never) | **Tension** | The non-goal says bots never run commands. That rule can stay true for role bots. But the app itself starts a process that edits code and runs commands. The owner must decide if the non-goal changes. |
| `security.md` §1 threat model | **Tension** | Today the app runs no code. A coding agent runs commands on the owner's machine. That is a new threat class and needs a new section and an owner review. |
| D1 and `security.md` §2.1 (localhost, Host and Origin checks) | Check | A desktop shell loads the UI from a custom scheme or a local port. The Host and Origin checks must still block other websites and other local apps. |
| `AGENTS.md` rule 6 (keys only from environment variables) | Check | Each CLI uses its own login on the machine. The app must not read, copy or store CLI credentials. |
| D53 and the sandbox note | Check | The app container is parked to M9. A coding agent can need its own sandbox (for example a per-run sandbox behind a new port). Decide this in the slice plan. |

## 4. Rough design (for discussion only)

```text
Owner ──> App UI (web or desktop shell)
            │
            ▼
         core/ coding-agent service ── rules: allowed folder, branch, limits
            │  (port: CodingAgent)
            ├── adapter: Claude Code (headless mode or Agent SDK)
            └── adapter: Codex (non-interactive mode or SDK)
                    │
                    ▼
            CLI process in the attached project folder, on its own git branch or worktree
                    │
                    └── output, permission requests, result ──> events ──> SSE ──> UI
```

Rules to keep (proposals):

1. Role bots never call a coding agent directly. Only the owner starts a coding agent session.
   A bot can draft the instruction, and the owner sends it.
2. A session works only in one attached project folder (D23), on its own branch or worktree. It
   never writes to the owner's current branch.
3. Each permission request from the agent shows as an approval card. If the owner does not
   answer, the request times out and the agent gets "denied".
4. Stop ends the whole process tree, not only the parent process.
5. The session log keeps the instruction, the output, the approvals and the final diff.
6. Limits (session time, output size, sessions at the same time) are settings with defaults
   (`AGENTS.md` §10).

## 5. Desktop shell options

Check the current state of each option when the slice starts. Tools in this area change fast.

| Option | For this app | Against this app |
| --- | --- | --- |
| Electron (preferred) | Ships Node, so the Hono backend runs as it is. Mature on Windows and Linux. | Large install size and memory use. Security settings (context isolation, sandbox, no Node in the renderer) must be correct. |
| Tauri | Small install. Uses the system web view. | The shell is in Rust. The Node backend must run as a separate "sidecar" program. Web view behaviour is different on each OS. |
| No shell (browser + local service) | No new build. | Not a desktop app. |

## 6. Open questions for the owner

- Does the non-goal "A coding IDE" change, or does it stay true for role bots only?
- Windows and Linux only, or macOS too?
- Can a coding agent run commands without approval inside its worktree, or does every command
  need approval?
- Do coding agent sessions count toward the daily spending cap (D20)? A CLI with a subscription
  login can have no cost per token.
- Is a sandbox for the agent process necessary (see the sandbox note in D53)?

## 7. What must happen before work starts

1. M0–M9 are done.
2. A new decision (next free number at that time) for the coding agent port and its rules.
3. A new decision for the desktop shell.
4. `security.md`: a new section for coding agents and the desktop shell, with owner review.
5. A slice brief in `tasks/` and a row in `development-plan.md` that is not "later".
