# Decision pages: read the counts and the text files from the built page

Brief: no brief file. This is the redesign that `AGENTS.md` §9 asks for in draft PR #152, after
review round 2 found the same two faults that round 1 had fixed.
Checkpoint: plan. The owner approves a redesign under `AGENTS.md` §9.
Approval: waiting for the owner. The owner chose the direction on 2026-11-24 (decision page r7,
Q2: "B Read the built page").

## Why

The kit of the `decision-pages` skill has three readers of one content file: the HTML renderer,
the word counts of the lint, and the text files (`page.txt`, `page.q1.txt`, ...). Each reads the
markup on its own, so they differ:

| Fault | Round 1 | Round 2 (same cause) |
| --- | --- | --- |
| The 160-word option count misses words that the page shows | R1-1: the row labels Does, Gets, Costs, Risk | R2-5: the "My pick" badge, a closed option summary |
| A text file differs from the page | R1-2: `**` inside a code span | R2-9: `**` across two table cells |

The owner chose to measure what the page shows, so that a fourth reader of the markup is not
needed.

## Design

1. **One measure step in the browser.** A new script, `scripts/measure.mjs`, opens the built
   page with Playwright (the browser library that `verify.mjs` already uses). For each question
   screen it reads the text that the screen shows (`innerText`, so a closed Details is left out):
   - the context words: the question screen without its option list;
   - the option words: the option list, with each label, badge and chip that it shows;
   - the bold share: the bold words of the context, divided by the context words.
   It writes the text files from the same text: `page.qN.txt` from each screen, and `page.txt` from
   the overview, each screen and each Details opened.
2. **`gen.mjs` runs the measure step after it writes the HTML.** The limits of 220 context words,
   160 option words and 10% bold apply to the measured numbers. If Playwright is not there, the
   build stops with an error that names the missing library. It does not skip the check.
3. **What stays in `lib.mjs`.** The field rules that need no page (required fields, the limits of
   one field, sentence length, bold leads) stay in `lint`. The code that only counted totals or
   wrote text files (`pageText`, `questionText`, the text writer, the total counts) goes away.
4. **`verify.mjs`** checks that each text file equals the text of its screen in the browser.
5. **Out of scope:** the copied answers (`copyLines` and the copy button). They are not part of the
   two faults. Each change of the HTML layout. The P3 findings R2-2, R2-3 and R2-7 (Follow-ups).

A Codex worker (GPT-6.2 Sol, effort high) builds it from a brief. Its first turn gives back the plan
in its own words. The lead agent changes no kit code.

## Test strategy

Each new test fails on `8a66c9c` (the head before this redesign) or on a scratch copy without the
change, before the build makes it pass. The report gives the failing run of each one.

| # | Behaviour | Test | Fails before the change because |
| --- | --- | --- | --- |
| 1 | The option count includes the "My pick" badge | A page with 4 cards at 158 counted words plus the badge: the measure gives the shown total, and 161 shown words stop the build | The old count leaves out the badge |
| 2 | A closed option summary counts | A card with a closed "What this plan covers" summary: its words are in the option count | The old count leaves it out |
| 3 | Table cells keep their literal text | Two cells `x ** 2` and `y ** 3`: `page.q1.txt` and `page.txt` hold both, as the page shows | The old export pairs the two `**` |
| 4 | Code spans keep their text (R1-2 again) | `x ** 2` in a code span, and a code span that holds only `**` | Regression test of the round 1 fix |
| 5 | The row labels count (R1-1 again) | 160 and 161 shown option words at the limit | Regression test of the round 1 fix |
| 6 | A question file leaves out a closed Details | The Details text is in `page.txt`, not in `page.q1.txt` | Regression test |
| 7 | Each text file equals its screen | For the sample page and the r7 page: each file line by line equals the screen's `innerText` | New check in `verify.mjs` |
| 8 | No browser, no build | `gen.mjs` with Playwright not found exits 1 and names the library | New behaviour |
| 9 | The field rules still work with no browser | The self-test keeps the required-field and per-field tests | Regression |

Checks: `selftest.mjs`, `verify.mjs` on the sample and on the r7 page, `pnpm lint`,
`pnpm check:index`. Then review rounds 1 and 2 of the redesign commits
(`docs/workflows/merge-bar.md`), each split so that it ends under the 35% context limit.

## Open questions

None.
