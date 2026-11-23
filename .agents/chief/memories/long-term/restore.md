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
5. The memory audit runs only when the owner asks (rule R-037). There is no cron line (owner, 2026-11-23, order 179).
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

## Audit input

Run this block from the chief's checkout. It writes `$R-input.txt` in `short-term/audits/`.
The chief runs one audit at a time. Use the newest report at or before this audit's timestamp.
Its first line must match the input file's `Main:` line and contain a 40-digit hex SHA.
The report must have the three headings in step 6 of `audit.md`.
Each section must have at least one non-empty line before the next heading or the footer.
The line can say `none`. The report must end with `End of report.`.
If none qualify, start at `fe44c64` (the merge of #139). To fix a bad first line, copy the
`Main:` line from the report's input file. You can also remove a bad report after the owner gives the OK.

The block publishes the input only after all required commands finish. It keeps the `check:memory`
output for exit codes 0 and 1. If the section has no `check:memory: ok` or
`check:memory: <n> problem(s)` summary line, record "check:memory could not run" as an open issue.
If the block fails, check its error and any `$R-input.part` file before you retry.
If the file name is in use, wait until the next minute.

```sh
A=.agents/chief/memories/short-term/audits
R="$A/$(date +%F-%H%M)" &&
mkdir -p "$A" &&
test ! -e "$R-input.txt" &&
test ! -e "$R-report.md" &&
git fetch -q origin main &&
(
  main=$(git rev-parse origin/main) || exit
  reports=$(find "$A" -maxdepth 1 -type f -name '????-??-??-????-report.md') || exit
  reports=$(LC_ALL=C sort -r <<EOF
$reports
EOF
  ) || exit
  report=
  previous_main=fe44c64
  while IFS= read -r candidate; do
    LC_ALL=C expr "$candidate" '>' "$R-report.md" >/dev/null && continue
    candidate_input=${candidate%-report.md}-input.txt
    test -f "$candidate_input" || continue
    last=$(tail -n 1 "$candidate") || exit
    test "$last" = 'End of report.' || continue
    awk '
      NR == 1 || $0 == "End of report." { next }
      /^[ ]{0,3}#+([[:space:]]|$)/ { section = $0; next }
      /[^[:space:]]/ { content[section] = 1 }
      END {
        exit !(content["## Open issues"] &&
               content["## Permission rules"] &&
               content["## What I checked"])
      }
    ' "$candidate" || continue
    first=$(head -n 1 "$candidate") || exit
    input_first=$(head -n 1 "$candidate_input") || exit
    test "$first" = "$input_first" || continue
    printf '%s\n' "$first" | grep -Eq '^Main: [0-9A-Fa-f]{40}$' || continue
    report=$candidate
    previous_main=${first#Main: }
    break
  done <<EOF
$reports
EOF
  git merge-base --is-ancestor "$previous_main" "$main" || {
    printf 'Audit checkpoint %s from %s is not an ancestor of %s.\n' \
      "$previous_main" "${report:-the first-audit default}" "$main" >&2
    exit 1
  }
  printf 'Main: %s\n' "$main" &&
  echo "## check:memory --local" || exit
  memory_exit=0
  pnpm -s check:memory --local 2>&1 || memory_exit=$?
  printf 'check:memory exit %s\n' "$memory_exit" &&
  test "$memory_exit" -le 1 &&
  echo "## differences from origin/main" &&
  git status -sb &&
  git diff "$main" -- .agents/chief/memories/ &&
  echo "## long-term changes since the last audit" &&
  git log -p --full-history --diff-merges=first-parent "$previous_main..$main" -- .agents/chief/memories/long-term/ &&
  git diff "$previous_main" "$main" -- .agents/chief/memories/long-term/ &&
  echo "## open PRs and their files" &&
  gh pr list --state open --json number,files --jq '.[] | "#\(.number) \([.files[].path] | join(" "))"'
) > "$R-input.part" &&
mv "$R-input.part" "$R-input.txt"
```

## Audit start

Replace `<audit_timeout_minutes>` with the timeout in `settings.md`. Replace `<model>` with the
model ID in `chief_model`. The start command requires a non-empty `audit.md` checklist.
Run "Audit input" and "Audit start" in one shell call. Add `&&` to the last line of "Audit input"
so "Audit start" runs only after the input is ready. Use the tool's background mode and check the
call's exit status.
The auditor has no command tool and can write only in `$A`.
After the call, use the printed stem as `R` to read `$R-report.md`.

```sh
: "${A:?}" "${R:?}" && test -s "$R-input.txt" && test ! -e "$R-report.md" && \
test -s .agents/chief/memories/long-term/audit.md && \
printf 'Audit stem: %s\n' "$R" && \
timeout <audit_timeout_minutes>m env -u ANTHROPIC_API_KEY claude -p --restricted --strict-mcp-config \
  --model <model> --effort high --no-session-persistence \
  --tools "Read,Grep,Glob,Write" --allowedTools "Read" "Grep" "Glob" "Write($A/**)" -- \
  "$(cat .agents/chief/memories/long-term/audit.md) The input file: $R-input.txt. The report file: $R-report.md."
```

## Not claimed

- The method (how to start leaders, review their work and clone the chief) and its tools are not
  in the repository yet. They move in with the `chief` skill PR (owner, 2026-11-19, arena Q5 A).
  Until then, a new computer restores the identity, the rules, the settings, the lessons and the
  state, but not the method.
- Short-term memory has no backup (arena Q4 A). The facts after the last promotion, the running
  leaders and the private notes are lost with the computer.
- User-level skills such as `ste-writing` are not in the repository. `environment.md` says what
  to do without them.
