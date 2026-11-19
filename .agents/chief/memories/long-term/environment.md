# Environment

Facts of this repository and of the owner's tools. A command that failed here has its fix next
to it. Check a version fact before you trust it.

## Repository

- `main` is protected: a PR merges only with its required checks green. PRs open as drafts and
  stay drafts until right before the merge (`AGENTS.md` §10).
- Node 26 (`.nvmrc`). pnpm comes from npm, not from corepack. A branch from before #94 needs
  Node 24: merge `main` into it first.
- Each PR branch has its own worktree next to the main checkout, `../cty1ng-<slug>`. Other
  sessions switch the branch of the main checkout, so read `git status -sb` before each write
  there (L-18).
- Git ignores the `tmp/` folder. The method files are in the `tmp/` folder of the main checkout;
  give leaders absolute paths into it. The chief writes its notes in its own worktree
  (git-ignored `tmp/` or `short-term/`), never in the shared checkout (owner, 2026-11-19, #139
  fixes page Q4 A).
- The e2e servers use the fixed ports 8100 and 8101, so only one e2e run works at a time.
- `pnpm check:breaks` needs a TMPDIR outside every git repository: `../cty1ng-breaks-tmp/<slug>`.
- The CI job `e2e` can fail at "Install Chromium for Playwright" with a DNS error in the runner.
  `gh run rerun <id> --failed` runs only the failed job. Such a failure says nothing about the PR.

## GitHub CLI

- `gh pr edit` fails (gh 2.46, classic Projects). Edit a PR body with
  `gh api -X PATCH repos/{owner}/{repo}/pulls/<n> -F body=@<file>`, then read it back with
  `--jq .body`.
- `jq` is not installed. Use `gh ... --jq '<expr>'`, and build strings with `+`, not `\( )`.
- Before you call a PR ready: `gh pr view <n> --json mergeable,mergeStateStatus,statusCheckRollup`.
- A merge by the chief: `gh pr ready <n>`, then `gh pr merge <n> --merge`, then
  `gh pr view <n> --json state,mergedAt,mergeCommit`.

## Claude Code sessions

- Start a leader from its worktree:
  `cd <worktree> && claude --bg --permission-mode auto --model <model> --effort <effort> -n "<name>" "<prompt>"`.
  Never use `-w`.
- Resume: `claude --bg --permission-mode auto --resume <newest session id> '<prompt>'`. Each
  resume makes a new id, so always resume the newest one. A resume keeps the model.
- `claude agents --json` shows the state; `blocked` means that it waits for a person, so tell the
  owner. `claude stop <id>` stops one. The owner opens one with `claude attach <id>`. Read a
  screen prompt with `claude logs <id>`.
- Send a message with `SendMessage` (load it with `ToolSearch`, query `select:SendMessage`). Your
  own session name is the first line of `ListAgents`.
- A background session that enters a worktree outside `.claude/worktrees/` stops at the screen
  prompt "permission-root relocation", and only the owner can answer it. Tell each leader: "you
  are started inside your worktree; do NOT use the EnterWorktree tool".
- The Write and Edit tools are blocked in the main checkout for a background job and its
  subagents. If a tool or the harness blocks a write, do not route around it: work in your own
  worktree, or ask the owner.
- The folder of a background job is deleted with the job. Keep nothing there that must stay.
- A `claude -p` that a background job starts fails with "Invalid API key". Run it with
  `env -u ANTHROPIC_API_KEY`, so that it uses the normal login. Copy no credentials.
- Never `pkill -f` or `pgrep -f` a pattern that is also in your own command line: it kills your
  shell (exit 144).

## Reviews

- Codex (GPT-6.2 Astra; owner, 2026-11-19): `codex exec -m gpt-6.2-astra -c model_reasoning_effort="high" -c service_tier="default" "<message>"`. Codex leaves
  files and worktrees in `/tmp`. Do not remove them; list them for the owner.
- Each reviewer writes its report to a file, never only to a transcript.

## Tools that are not in the repository

- `ste-writing` (a user-level skill): without it, use the short rules in `identity.md`.
- `handoff` (a user-level skill): without it, a handoff has the goal, the state with heads and
  times, what is done, the next steps, the open questions with your view, what you could not
  check, and the files.
- `consultants` (`.agents/skills/consultants/`, from #141): models grill a recommendation on
  decisions. `arena` (`.agents/skills/arena/`): build candidates, pick a base and graft. Only the
  owner starts each one; otherwise run its method by hand (R-015).
- The context meter, the clone prompt and the PR watch script stay in the `tmp/` folder until the
  `chief` skill PR. Without them, read the context level of the session, write the clone prompt
  from `restore.md`, and watch CI with a bounded loop (L-22).
