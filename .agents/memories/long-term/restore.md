# Restore

How the chief comes back when the old chief is gone. The drill that proves it is in
`restore-drill.md`.

## On a new computer

1. Clone the repository and run `pnpm install`. Then run `pnpm check:memory --local --fix`: it
   adds the ignore lines of `short-term/` to `.git/info/exclude`.
2. Read `../README.md` and follow its read order. `short-term/` is empty, so long-term memory is
   the state of the last promotion.
3. Make `short-term/private-words.txt` again: ask the owner for the words. The name of the chat
   platform of the earlier prototype is one of them.
4. Find the live state yourself: `docs/status.md` ("Next", "Waiting on the owner"),
   `gh pr list`, the CI of each open PR, `git worktree list`. Add the facts of `state.md`, and
   write `short-term/now.md`.
5. Tell the owner what you restored and what is missing (section "Not claimed"). Ask before any
   work.

## Same computer, a new conversation (a clone)

1. The old chief updates `short-term/now.md` and writes a handoff in `short-term/handoffs/`.
2. The old chief starts the clone on `chief_model`, or on the model of the owner's newest order.
3. The clone reads the memory and the handoff, then sends the old chief a state summary.
4. The old chief answers each gap and sends "handover confirmed".
5. The old chief tells the owner the session name of the clone, starts no more work, and asks the
   owner to stop the old session.

## Crash: the old chief is gone with no handoff

1. Do not do an outward action again (a merge, a push, a PR comment) before you check its state:
   `gh pr view`, `git log origin/<branch>`, `claude agents --json`.
2. Find the running leaders. Read their last reports and handoffs before you send new work.
3. If two chiefs can run at one time, ask the owner which one stays.

## Not claimed

- The method (how to start leaders, review their work and clone the chief) and its tools are not
  in the repository yet. They move in with the `chief` skill PR (owner, 2026-11-19, arena Q5 A).
  Until then, a new computer restores the identity, the rules, the settings, the lessons and the
  state, but not the method.
- Short-term memory has no backup (arena Q4 A). The facts after the last promotion, the running
  leaders and the private notes are lost with the computer.
- User-level skills such as `ste-writing` are not in the repository. `environment.md` says what
  to do without them.
