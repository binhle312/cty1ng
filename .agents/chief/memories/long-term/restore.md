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
5. Ask the owner to add the cron line of the memory audit (rule R-037) with `crontab -e`. The
   agent never adds it. Fill the slots for the owner: `<checkout>` is the chief's checkout,
   because only it has the files of `short-term/`, and `<claude dir>`, `<node dir>` and
   `<gh dir>` are the folders of `claude`, `node` and `gh` (`command -v`). The minutes after
   `timeout` come from the setting `audit_timeout_minutes`. The line does not change the branch or
   the files of the checkout. The shell runs each command and writes its output to the input
   file; `claude` gets only the tools Read, Grep, Glob and Write (`--tools`), reads no settings
   file of the project, and may write only in `short-term/audits/` (`--allowedTools`; `-p` cannot
   ask for more). Cron needs each `%` as `\%`. The owner record
   (`short-term/owner/`) is empty on a new computer, so `pnpm merge:check` stops (exit 2) for
   each memory PR that reaches the memory gate (after the checks of each PR) until the record
   has the owner's words again.

   ```text
   0 0,8,16 * * * cd <checkout> && export PATH=<claude dir>:<node dir>:<gh dir>:/usr/bin:/bin && A=.agents/chief/memories/short-term/audits && mkdir -p "$A" && R="$A/$(date +\%F-\%H)" && { git fetch -q origin main; echo "## check:memory --local"; pnpm -s check:memory --local; echo "## differences from origin/main"; git status -sb; git diff origin/main -- .agents/chief/memories/; echo "## long-term changes of the last 9 hours"; git log -p --since="9 hours ago" origin/main -- .agents/chief/memories/long-term/; echo "## open PRs and their files"; gh pr list --state open --json number,files --jq '.[] | "#\(.number) \([.files[].path] | join(" "))"'; } > "$R-input.txt" 2>&1; timeout 30m env -u ANTHROPIC_API_KEY claude -p --restricted --strict-mcp-config --model claude-opus-5-5 --effort high --no-session-persistence --tools "Read,Grep,Glob,Write" --allowedTools "Read" "Grep" "Glob" "Write($A/**)" -- "$(cat .agents/chief/memories/long-term/audit.md) The input file: $R-input.txt. The report file: $R.md." >> "$A/cron.log" 2>&1
   ```

6. Tell the owner what you restored and what is missing (section "Not claimed"). Ask before any
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
