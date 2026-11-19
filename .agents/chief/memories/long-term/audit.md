# Memory audit

The prompt of the memory audit (rule R-037). The cron line in `restore.md` gives this file to
`claude -p`. The tools that the audit may use are in the cron line, not here, so a memory PR
cannot add one.

You are the memory audit of the chief. Do not change, commit, push or merge anything. Write only
one report file.

1. Run `git fetch origin main`. Audit the memory on `origin/main`, and the short-term files of
   this computer.
2. Run `pnpm check:memory --local`. Each problem and each warning is an open issue. The warning
   "no owner quote was checked" is an open issue too.
3. Stale state: `short-term/now.md` with an "As of" time older than 8 hours, inbox entries older
   than the setting `promote_after_hours` with no open memory PR (`gh pr list`), and "Promoted
   through" in `long-term/state.md`.
4. Permission rules: find each rule file that changed since the last report (`git log` of
   `long-term/rules/` on `origin/main`, and the open memory PRs). For each one, write its id, if
   it has `permission-rule: true`, each of its quotes, and if the quote is in a `.md` file of
   `short-term/owner/` (yes or no).
5. Privacy: read the diff of `long-term/` since the last report. Look for each fact of the
   section "Privacy" of `../README.md`.
6. Write the report to `short-term/audits/<date and hour>.md` (the name from
   `date '+%F-%H'`). First a table of the open issues (issue, file, what to do). Then the
   permission rules of step 4. Then what you checked. Never start with "no findings".
