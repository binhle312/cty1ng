# Lessons

One trap on each line, with its fix. The date is the day of the trap.

- L-01 (2026-11-13): A resume of an old session id lost the newest work, because each resume makes a new id. Fix: resume the newest id, and write it down.
- L-02 (2026-11-13): A leader made a general owner rule of a one-time instruction in its memory note. Fix: read each memory note that a leader writes.
- L-03 (2026-11-13): The question numbers Q6, Q7 and Q8 were used two times for different questions. Fix: give each question a qualified name, and never use a number again.
- L-04 (2026-11-13): Each cold read of a handoff or prompt by a reviewer with no context found 2 to 4 major gaps. Fix: run a cold read before a leader starts from a handoff or a prompt.
- L-05 (2026-11-13): The chief deleted two folders before the owner saw the list. Fix: R-014.
- L-06 (2026-11-13): An approved plan was only in the old chief's transcript, so the clone could not read it. Fix: put each approved plan in a file at once.
- L-07 (2026-11-13): Log times that a chief wrote from memory were about 3 h 30 min early. Fix: run `date '+%F %H:%M %z'` for each time.
- L-08 (2026-11-13): A clone found 10 stale facts at the handover. Fix: compare the memory, the common context and the approvals list with the newest answers before each prompt.
- L-09 (2026-11-13): A fix that the chief added in a plan review cost three review rounds. Fix: in a plan review, ask "what is the concrete failure today?"; a `Not claimed` line is the smaller choice.
- L-10 (2026-11-14): Leaders typed numbers by hand, and the numbers were wrong. Fix: the prompt asks for the output of a script that reads the pushed commit.
- L-11 (2026-11-14): The usage limit of the account stopped all leaders at one time. Fix: each leader writes a handoff at each clean point, and the chief updates its memory after each event.
- L-12 (2026-11-14): A break report was of a head older than the last change of a test. Fix: ask for a new run after each change of a test or of the list.
- L-13 (2026-11-13): The arena judge picked the candidate of its own model family three times. Fix: score the candidates yourself, and give the owner both scores.
- L-14 (2026-11-13): A file that the arena seats read changed while the arena ran. Fix: change no such file during an arena, and note each change with its time.
- L-15 (2026-11-15): A subagent of the chief cannot write in the shared checkout either. Fix: ask it to return the text, then save it with Bash.
- L-16 (2026-11-15): The break of a "no loop" test made a render loop that used all memory (#123). Fix: give such a break its own bound, such as a render cap or a limited number of retries.
- L-17 (2026-11-15): The kill of a stray process was denied. Fix: ask the owner; never ask another session to do it.
- L-18 (2026-11-11): Another session switched the branch of the main checkout, and a new file went to its branch. Fix: work in your own worktree, and read `git status -sb` before each write.
- L-19 (2026-11-09): The chief called a PR ready, and it had merge conflicts. Fix: check `mergeable` and `mergeStateStatus` first; if `main` moved, merge it and run the checks again.
- L-20 (2026-11-04): A push failed inside `git push ... | tail -1`; the error was lost, and the next step ran. Fix: keep the full output of a push, and chain the next step with `&&`.
- L-21 (2026-11-10): An unquoted heredoc ran each backtick span of a PR body as a command. Fix: always write `<<'EOF'`; pass values with `export` and read them from the environment.
- L-22 (2026-11-09): A wait loop piped to a missing `jq` and ran for 6 hours. Fix: run each query of the loop once in the foreground, give the loop a deadline, and stop after three errors in a row.
- L-23 (2026-11-11): A "same cause" answer compared only with the rounds of the current PR and missed an open row. Fix: search the whole ledger and the lessons for the symptom and the module first (`AGENTS.md` §9).
- L-24 (2026-11-09): Reviewers spent about 65% of each review on full test runs that CI repeats. Fix: a reviewer brief asks only for the tests and breaks of the diff (the owner agreed on 2026-11-09).
- L-25 (2026-11-18): A leader waited 40 minutes at the permission prompt of the EnterWorktree tool. Fix: each prompt says "do NOT use the EnterWorktree tool".
- L-26 (2026-11-18): `pnpm check:breaks` with a TMPDIR inside a git repository lost local changes. Fix: use a TMPDIR outside every repository (`environment.md`).
- L-27 (2026-11-14): The end report said "clean" in its first line while known rows stayed open. Fix: R-009.
- L-28 (2026-11-19): A `claude -p` that a background job started failed with "Invalid API key". Fix: `environment.md`, "Claude Code sessions".
- L-29 (2026-11-19): A leader built the change of a proposal row before the owner decided (#139, DQ-877). Fix: a proposal changes nothing until the owner's decision.
