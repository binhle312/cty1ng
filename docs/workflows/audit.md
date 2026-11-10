# Run an audit

Before a protected action, check [AGENTS.md §7](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr).

Use this workflow when you audit the repository or one area of it, for example the second audit
of the plan of 2026-11-04. It applies to each agent that takes part. An audit finds and records
issues. It fixes nothing: [bug-fix.md](bug-fix.md) owns the fixes.

The owner approved these steps on 2026-11-06, during audit PR 4
([#82](https://github.com/binhle312/cty1ng/pull/82)). The audit of 2026-11-03 passed the Esc bug
of the bot page with a jsdom test. The audit of 2026-11-05 found that bug, but it did not connect
the second Clone bug to DQ-003, and its file records no search and no coverage.

1. **Make a coverage table.** List each screen or flow in scope. For each one, list each case of
   [testing.md §3](../testing.md#3-what-must-be-tested), "Edge cases each slice tests" and
   "Request order and list states". Mark each cell `ran`, `read` or `not checked`. `read` means
   that you read the code and did not run it. A cell with no mark counts as `not checked`. Put the
   table in the audit file.
2. **Use a real browser for browser behaviour.** Check keys, focus, the cache and the order of
   events in a real browser with the real backend: Playwright with the fake model
   ([testing.md](../testing.md)). A jsdom run is not evidence for these, because it can pass when
   the browser fails. To reach an order, hold or fail requests with `page.route`.
3. **Give each finding a general rule, then search.** Write the rule that the finding breaks in
   one sentence. Do not name the one screen in it. Search all the code for the same rule, also in
   other mechanisms. Record in the finding where the search looked and what it found.
4. **Compare with old fixes.** Search [delivery-quality.md](../delivery-quality.md), its
   [archive](../delivery-quality-archive.md) and
   [lessons-learned](../lessons-learned/README.md) for rows with the same rule. If one exists,
   answer "Same cause as an earlier fix?" with yes. Then
   [AGENTS.md §9](../../AGENTS.md#9-definition-of-done-every-pr) applies to the fix. This step is
   weak for now. Many old rows, for example DQ-003, have the state `unknown`. They also record no
   general rule. When a comparison rests on such a row, say so in the audit file.
5. **Run normal and bad conditions.** Run each flow in normal conditions. Then run it in these bad
   conditions:
   - a second visit with no reload, so that the cache holds old data;
   - an `offline` event in the browser;
   - a failed read, and a read that answers late.

   List each form that copies its first values into `useState` and keeps them. Run a second visit
   on each of these forms.

**Not part of this workflow** (owner, 2026-11-06): more review agents, bugs added on purpose to
test the audit, and a script for these checks.

**Done:** the audit file has the coverage table. Each finding has its severity
([merge-bar.md](merge-bar.md)), its general rule, its search scope and the result of the
comparison with old fixes.
