# Delivery quality register

This file holds the milestone view, the PR register, and historical evidence snapshots.
The [ledger rules](delivery-quality.md) apply.
Section numbers outside §§2–4, such as §7, refer to the [ledger](delivery-quality.md).

## 2. Milestone view

The PR population below comes from the local slice register at baseline.
It includes documentation PRs because they can also have quality findings.
Reconcile the population when a milestone closes or another PR is assigned to it.
`unknown` means the complete issue ledger has not been reconstructed.

| Milestone | PRs in baseline population | Lesson source coverage | Unique issues | Open issues | Escaped issues | Review rounds |
| --- | --- | --- | --- | --- | --- | --- |
| M0 | #46, #48, #49, #50 | 6 lessons for #49; other PRs unmeasured | 2 itemized (DQ-310 from #113); total unknown | unknown | unknown | unknown |
| M1 | #51, #52, #53, #54, #55 | 5 lessons for #54; other PRs unmeasured | 6 itemized; total unknown | unknown | unknown | unknown |
| M2 | #20, #56, #57, #58, #59, #66 | 1 lesson for #57; 5 for #59; other PRs unmeasured | 28 itemized; total unknown | 7 known (6 `partial`, 1 `open`); 5 rows `unknown`; total unknown | 11 in the 23 rows that record it; 5 rows `unknown`; total unknown | 7 logged; total unknown |
| Audit 2026-11-05 | #73, #78, #82, #84, #86, #91, #92, #96, #105, #106, #108, #109, #110, #111, #112, #113, #114, #115, #116, #117, #118, #119, #120, #121, #122, #123, #124, #125, #127, #128, #129, #130, #131, #132, #133, #134, #135, #136, #137, #138 (the register rows of this milestone) | no lesson source; written by `pnpm records:counts` | 654 itemized | 55 (42 `open`, 13 `partial`) | 20 in the 627 rows that record it; 27 rows do not record it | 194 logged |

For a milestone total, count each issue ID assigned to that milestone once.
Count review rounds by distinct PR and round ID.
If any PR lacks full coverage, show the known subtotal with its coverage, or keep the total `unknown`.
Add a row for each later milestone when its first PR enters the record.
`pnpm records:counts --write` writes the Audit row from the rows of the ledger files, and CI
fails when the row is stale (§7, step 5). The notes on the count of each PR that this section held
before #135 are in git history: `git show 5605954:docs/delivery-quality.md`, lines 59 to 84. The
notes that later merges of `main` brought (#128, #129, #132, #134) are in the commits that this
command lists: `git log --oneline -G '^#[0-9]+ added ' origin/main -- docs/delivery-quality.md`.

**M2 close check (2026-11-04).** Population: all five baseline PRs are merged, and #66 is the sixth.
#60, #61, #62, #63 and #64 have no milestone in the slice register, so they are outside it.
M2 has 17 issue IDs, DQ-006 to DQ-021 and DQ-024: 5 `unknown` (DQ-006 to DQ-010), 6 `partial` (DQ-011 to DQ-013, DQ-015 to DQ-017), 3 `fixed` (DQ-014, DQ-020, DQ-024) and 3 `dropped` (DQ-018, DQ-019, DQ-021).
The exact totals stay `unknown`: #20, #56 and #58 are unmeasured, #57 and #59 are partial, the 5 `unknown` rows have no closure evidence, and S4 to S7 are not reconciled.
The numbers in the M2 row are known subtotals. This check did not change the state of a row without new evidence.

**Check of the `partial` rows (2026-11-12).** The owner asked why DQ-011, DQ-012, DQ-013, DQ-015, DQ-016 and DQ-017 are `partial`.
No record states the reason. The builder searched the ledger at `9b0daf7` and at `b32d4c6`, the follow-up rows of `status.md` at `9b0daf7`, and the body and the comments of #59. **Not claimed:** that no reason exists.
What the record shows: `9b0daf7`, the last commit of #59, wrote DQ-011 to DQ-021 as `partial`. This includes DQ-018, which its own row called open.
The [archive](delivery-quality-archive.md#review-rounds-of-merged-prs) has four rounds of #59. Three of them read the working tree after `ec8faa7`. #59 has two commits after `ec8faa7`: `3dc4f58` (skills and docs) and `9b0daf7` (the fixes). No round lists a fixed ID, and the final gate opened DQ-011 again. So no round confirms the fix of any of the six rows.
The builder checks of #66 are the round that lists DQ-014 and DQ-020 as fixed, and the M2 close check above changed those rows.
`pnpm test` passes on `c276665` (2026-11-12). A test that passes is not a round that confirms a fix. So the six rows stay `partial` (owner, 2026-11-12).

## 3. PR register

`Partial` means there is local source evidence but no complete, reconciled issue ledger.
`Unmeasured` means no review counts were backfilled for that PR.
`Ledger` means each finding of the PR has a ledger row. `pnpm records:counts --write` writes its
four count cells from the rows: the rows found by the PR (its discovery PR; any milestone, not
`withdrawn`), those that are `open` or `partial`, those with `escaped: yes` (an issue that the PR
found after an earlier merge let it in), and its rows in the two round tables. CI fails when a cell is stale. Nobody types these cells.
The historical snapshot column gives evidence for a specific review period.

| PR | Milestone / slice | Coverage | Unique issues | Open issues | Escaped issues | Review rounds | Historical snapshot |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [#46](https://github.com/binhle312/cty1ng/pull/46) | M0 / M0a | Unmeasured | unknown | unknown | unknown | unknown | — |
| [#48](https://github.com/binhle312/cty1ng/pull/48) | M0 / M0b | Unmeasured | unknown | unknown | unknown | unknown | — |
| [#49](https://github.com/binhle312/cty1ng/pull/49) | M0 / M0c | Partial | unknown | unknown | unknown | unknown | Six process lessons; startup delay remains open in S1 |
| [#50](https://github.com/binhle312/cty1ng/pull/50) | M0 / design snapshot | Unmeasured | unknown | unknown | unknown | unknown | — |
| [#51](https://github.com/binhle312/cty1ng/pull/51) | M1 / spec gaps | Unmeasured | unknown | unknown | unknown | unknown | — |
| [#52](https://github.com/binhle312/cty1ng/pull/52) | M1 / M1a and plan | Unmeasured | unknown | unknown | unknown | unknown | — |
| [#54](https://github.com/binhle312/cty1ng/pull/54) | M1 / M1b | Partial | 5 itemized; total unknown | unknown | unknown | unknown | S2: one cross-review found 5 bugs: 1 P1, 4 P2 |
| [#55](https://github.com/binhle312/cty1ng/pull/55) | M1 / M1c | Unmeasured | unknown | unknown | unknown | unknown | — |
| [#20](https://github.com/binhle312/cty1ng/pull/20) | M2 / spec | Unmeasured | unknown | unknown | unknown | unknown | — |
| [#56](https://github.com/binhle312/cty1ng/pull/56) | M2 / spec gaps | Unmeasured | unknown | unknown | unknown | unknown | — |
| [#57](https://github.com/binhle312/cty1ng/pull/57) | M2 / M2a and plan | Partial | 1 itemized; total unknown | unknown | unknown | unknown | S3: one documented compliance omission; total unknown |
| [#58](https://github.com/binhle312/cty1ng/pull/58) | M2 / M2b | Unmeasured | unknown | unknown | unknown | unknown | — |
| [#59](https://github.com/binhle312/cty1ng/pull/59) | M2 / M2c | Partial | 15 itemized; total unknown | unknown | unknown | unknown | S4: about 32 problems in 7 rounds; S5–S7 overlap is unresolved |
| [#66](https://github.com/binhle312/cty1ng/pull/66) | M2 / close fixes | Partial | 1 itemized (DQ-024); total unknown | 0 known; total unknown | unknown | 2 builder rounds, 1 owner-pasted review of `30fa61f` | — |
| [#73](https://github.com/binhle312/cty1ng/pull/73) | Audit 2026-11-05 / PR 2, security | Partial | 35 itemized (DQ-025 to DQ-059); audit findings of other rows are not in this ledger | 1 (DQ-037) | 2 (DQ-025, DQ-026) | 9 independent reviews (`955ebe2`, `eb8f601`, `1e1cf76`, `fe63f7f`, `1b70296` twice, `9a4cca4`, `fb5c975`, `d008b65`), 1 owner review (`eb8f601`), 1 paid security review (`1490400`) | — |
| [#78](https://github.com/binhle312/cty1ng/pull/78) | Audit 2026-11-05 / PR 3, Skills page | Partial | 24 itemized (DQ-060 to DQ-083) | 6 (DQ-070 to DQ-073, DQ-077, DQ-081) | 14 (DQ-060 to DQ-063, DQ-065, DQ-069 to DQ-077) | 4 independent reviews (`274f118`, `9767da6`, `1193582`, `708a566`), 2 owner reports (`a80186f`, `267bd83`) | Merged on 2026-11-06 (`f656251`), with its 6 P3 open |
| [#79](https://github.com/binhle312/cty1ng/pull/79) | No milestone / principle skill | Unmeasured | unknown | unknown | unknown | unknown | Merged on 2026-11-06 (`8c2278f`) |
| [#82](https://github.com/binhle312/cty1ng/pull/82) | Audit 2026-11-05 / PR 4, Bots page | Partial | 33 itemized (DQ-084 to DQ-116) | 1 (DQ-107); #116 fixed DQ-089 and DQ-095, #117 fixed DQ-090, #119 fixed DQ-115 | 13 (DQ-084 to DQ-086, DQ-088 to DQ-091, DQ-095, DQ-096, DQ-101, DQ-106 to DQ-108) | 6 | — |
| [#84](https://github.com/binhle312/cty1ng/pull/84) | Audit 2026-11-05 / DQ-088 | Partial | 23 itemized (DQ-088, DQ-117 to DQ-138) | 0 | 1 (DQ-088) | 6 independent reviews (`35ea872`, `d5f5d6e`, `78d01fb`, `0dc734c`, `25cb287`, `d6265ae`) and the owner's review of `25cb287` | — |
| [#86](https://github.com/binhle312/cty1ng/pull/86) | Audit 2026-11-05 / PR 5, tests only | Partial | 41 itemized (DQ-139 to DQ-179) | 8 (DQ-161, DQ-162, DQ-166, DQ-174 to DQ-176, DQ-178, DQ-179) | 0 | 8 independent reviews (`41df63a`, `1965703`, `c46712f`, `af3bf5b`, `991f5b0`, `7baae5a`, `8c0eb15`, `3db62f7`), a text check (`2f9a385`), an owner review (`4dba2f5`) and CodeQL (`629f347`) | — |
| [#91](https://github.com/binhle312/cty1ng/pull/91) | Audit 2026-11-05 / PR 6, six tabs | Partial | 7 itemized (DQ-180 to DQ-184, DQ-197, DQ-198) | 0 | 2 (DQ-197 for the `reset` path, DQ-198) | 1 independent review (`a51816a`), an owner-pasted review (`6136561`), and a later check by the owner's reviewer (one finding quoted) | — |
| [#92](https://github.com/binhle312/cty1ng/pull/92) | Audit 2026-11-05 / DQ-180, the Clone draft | Partial | 13 itemized (DQ-180, DQ-185 to DQ-196; DQ-181 to DQ-184 are in #91) | 0 (the owner dropped DQ-193 on 2026-11-10) | 1 (DQ-180) | 3 independent reviews (`c38b698`, `60beb51`, `6ab9430`), an owner-pasted review (`279500b`), and a review that the owner asked for (`abaaac1`, no finding) | — |
| [#96](https://github.com/binhle312/cty1ng/pull/96) | Audit 2026-11-05 / DQ-198, a closed dialog and the read of all data | Partial | 5 itemized (DQ-198 from #91, DQ-199 to DQ-202) | 1 (DQ-200) | 2 (DQ-198, DQ-200) | 2 independent reviews (`8953c0a`, `04cad60`) | — |
| [#98](https://github.com/binhle312/cty1ng/pull/98) | No milestone / one home for each settings default | Partial | 4 itemized (DQ-203 to DQ-206) | 0 | 0 | 3 reviews that the owner gave to the session (`7f791c5`, `44fa8cf`, `c5a8049`) | — |
| [#105](https://github.com/binhle312/cty1ng/pull/105) | Audit 2026-11-05 / P3 PR 1, records only | Ledger | 15 (DQ-207 to DQ-221) | 1 (DQ-216) | 0 | 3 | — |
| [#106](https://github.com/binhle312/cty1ng/pull/106) | Audit 2026-11-05 / P3 PR 2, react-query 5.107.1 | Ledger | 15 (DQ-235 to DQ-249) | 1 (DQ-249) | 0 | 5 | — |
| [#108](https://github.com/binhle312/cty1ng/pull/108) | Audit 2026-11-05 / P3 PR 4, security tests | Ledger | 15 (DQ-265 to DQ-279) | 0 | 0 | 8 | — |
| [#109](https://github.com/binhle312/cty1ng/pull/109) | Audit 2026-11-05 / the review end rule, and two texts from the owner | Ledger | 16 (DQ-222 to DQ-234, DQ-335, DQ-336, DQ-339) | 0 | 0 | 5 | — |
| [#110](https://github.com/binhle312/cty1ng/pull/110) | Audit 2026-11-05 / P3 PR 5, an id that is no UUID | Ledger | 8 (DQ-280 to DQ-284, DQ-348 to DQ-350) | 0 | 0 | 6 | — |
| [#111](https://github.com/binhle312/cty1ng/pull/111) | Audit 2026-11-05 / P3 PR 8, a busy port and the CLI stack traces | Ledger | 15 (DQ-285 to DQ-294, DQ-345 to DQ-347, DQ-355, DQ-356) | 0 | 2 (DQ-292, DQ-293) | 6 | — |
| [#112](https://github.com/binhle312/cty1ng/pull/112) | Audit 2026-11-05 / the exception for a claim bigger than its proof in round 2; merged into the branch of #109 on 2026-11-14 (`e74d683`), not into `main` | Ledger | 9 (DQ-295 to DQ-299, DQ-337, DQ-338, DQ-340, DQ-341) | 0 | 0 | 4 | — |
| [#113](https://github.com/binhle312/cty1ng/pull/113) | Audit 2026-11-05 / P3 PR 6, the migration runner (item 22) | Ledger | 10 (DQ-311 to DQ-319, DQ-492) | 0 | 0 | 5 | — |
| [#114](https://github.com/binhle312/cty1ng/pull/114) | Audit 2026-11-05 / P3 PR 9, backend data and purge | Ledger | 18 (DQ-320 to DQ-334, DQ-541 to DQ-543) | 0 | 0 | 5 | — |
| [#116](https://github.com/binhle312/cty1ng/pull/116) | Audit 2026-11-05 / P3 PR E, Bots pages (items 40 to 46) and the bot page Esc | Ledger | 11 (DQ-402 to DQ-412) | 0 | 0 | 3 | — |
| [#117](https://github.com/binhle312/cty1ng/pull/117) | Audit 2026-11-05 / P3 PR 15, Skills pages small fixes (items 57 to 64) | Ledger | 12 (DQ-432 to DQ-443) | 1 (DQ-443) | 1 (DQ-442) | 3 | — |
| [#122](https://github.com/binhle312/cty1ng/pull/122) | Audit 2026-11-05 / P3 PR K (list PR 21), the frontend cleanup (item 68) | Ledger | 10 (DQ-477 to DQ-486) | 0 | 2 (DQ-480, DQ-485) | 5 | — |
| [#119](https://github.com/binhle312/cty1ng/pull/119) | Audit 2026-11-05 / P3 PR 18, tests only (items 70, 71, 72) | Ledger | 10 (DQ-447 to DQ-456) | 0 | 0 | 2 | — |
| [#120](https://github.com/binhle312/cty1ng/pull/120) | Audit 2026-11-05 / P3 PR 19, tooling gates (items 73 to 76) | Ledger | 12 (DQ-462 to DQ-473) | 4 (DQ-470 to DQ-473) | 0 | 3 | — |
| [#121](https://github.com/binhle312/cty1ng/pull/121) | Audit 2026-11-05 / P3 PR 11, security headers (items 35, 36) | Ledger | 9 (DQ-387 to DQ-395) | 0 | 0 | 3 | — |
| [#118](https://github.com/binhle312/cty1ng/pull/118) | Audit 2026-11-05 / P3 PR 20, Guide skill and `AGENTS.md` (items 3, 4) and the M3 brief line for DQ-249 | Ledger | 13 (DQ-417 to DQ-429) | 4 (DQ-424, DQ-427 to DQ-429) | 4 (DQ-426 to DQ-429) | 2 | — |
| [#123](https://github.com/binhle312/cty1ng/pull/123) | Audit 2026-11-05 / P3 PR 16, shell error boundary (items 65, 66) | Ledger | 14 (DQ-493 to DQ-506) | 0 | 0 | 4 | — |
| [#124](https://github.com/binhle312/cty1ng/pull/124) | Audit 2026-11-05 / P3 PR 14, Skills page orders (items 51 to 56) | Ledger | 10 (DQ-508 to DQ-517) | 0 | 1 (DQ-508) | 4 | — |
| [#125](https://github.com/binhle312/cty1ng/pull/125) | Audit 2026-11-05 / P3 PR 17, relative times (item 67) | Ledger | 18 (DQ-523 to DQ-540) | 0 | 0 | 3 | — |
| [#115](https://github.com/binhle312/cty1ng/pull/115) | Audit 2026-11-05 / P3 PR C, list PR 7 and list PR 10 (items 23, 24, 31 to 34) | Ledger | 15 (DQ-372 to DQ-386) | 3 (DQ-374, DQ-381, DQ-386) | 0 | 3 | — |
| [#130](https://github.com/binhle312/cty1ng/pull/130) | Audit 2026-11-05 / the break runner keeps the local changes when TMPDIR is inside a git repository (owner, 2026-11-18, q3 Q1 A) | Ledger | 20 (DQ-651 to DQ-670) | 2 (DQ-663, DQ-664) | 3 (DQ-651, DQ-663, DQ-664) | 3 | — |
| [#131](https://github.com/binhle312/cty1ng/pull/131) | Audit 2026-11-05 / the `check:status` CI check (owner, 2026-11-18, q2 Q2 A; the home of DQ-571 on #127's branch) | Ledger | 12 (DQ-681 to DQ-692) | 0 | 0 | 3 | — |
| [#133](https://github.com/binhle312/cty1ng/pull/133) | Audit 2026-11-05 / plans hold the design and the owner's decisions; build facts only in the PR description (owner, 2026-11-18, q2 Q1 A) | Ledger | 13 (DQ-701 to DQ-713) | 0 | 0 | 3 | — |
| [#128](https://github.com/binhle312/cty1ng/pull/128) | Audit 2026-11-05 / the CI check of the break list rules (owner, 2026-11-18: DQ-517 D, DQ-448 B) | Ledger | 19 (DQ-611 to DQ-617, DQ-619 to DQ-630) | 0 | 0 | 4 | — |
| [#129](https://github.com/binhle312/cty1ng/pull/129) | Audit 2026-11-05 / P3 small fixes from the owner's answers of 2026-11-18 (DQ-442, DQ-500, DQ-485, DQ-411, DQ-426, item 61, #123, the after-save cards) | Ledger | 25 (DQ-591 to DQ-595, DQ-631 to DQ-650) | 0 | 0 | 5 | — |
| [#132](https://github.com/binhle312/cty1ng/pull/132) | Audit 2026-11-05 / the flaky e2e test of the pinned card drop line (lead agent's task, 2026-11-18; owner rule: fix a flaky test at its cause) | Ledger | 18 (DQ-671 to DQ-680, DQ-721 to DQ-728) | 1 (DQ-677) | 1 (DQ-671) | 3 | — |
| [#134](https://github.com/binhle312/cty1ng/pull/134) | Audit 2026-11-05 / DQ-385, a real `field` for unknown keys in a body (owner, 2026-11-18, q4 Q4 A) | Ledger | 13 (DQ-731 to DQ-743) | 1 (DQ-743) | 0 | 4 | — |
| [#135](https://github.com/binhle312/cty1ng/pull/135) | Audit 2026-11-05 / the records redesign | Ledger | 44 (DQ-751, DQ-753 to DQ-777, DQ-853 to DQ-870) | 11 (DQ-772, DQ-857 to DQ-862, DQ-864 to DQ-866, DQ-869) | 3 (DQ-751, DQ-763, DQ-866) | 5 | — |
| [#136](https://github.com/binhle312/cty1ng/pull/136) | Audit 2026-11-05 / the pnpm links test of #128 times out in the full suite (DQ-781); the redesign of DQ-782 (owner, q5 Q1 A) | Ledger | 27 (DQ-781 to DQ-800, DQ-841 to DQ-847) | 3 (DQ-794, DQ-795, DQ-841) | 4 (DQ-781, DQ-786, DQ-794, DQ-795) | 6 | — |
| [#127](https://github.com/binhle312/cty1ng/pull/127) | Audit 2026-11-05 / rule words (owner answer Q5, 2026-11-15): W9 in `AGENTS.md` §7 | Ledger | 23 (DQ-561 to DQ-583) | 1 (DQ-578) | 0 | 4 | — |
| [#138](https://github.com/binhle312/cty1ng/pull/138) | Audit 2026-11-05 / DQ-537, a check that the app keeps one clock timer (owner, q5 Q4 A), and `setInterval` outside `lib/now.ts` (owner, 2026-11-19, morning Q2 B) | Ledger | 23 (DQ-821 to DQ-840, DQ-873 to DQ-875) | 3 (DQ-873 to DQ-875) | 0 | 5 | — |
| [#137](https://github.com/binhle312/cty1ng/pull/137) | Audit 2026-11-05 / DQ-455, the 1 MB line test of the guard on the fastest of 3 runs; the redesign of the timed tests (owner, q5 Q5 A) | Ledger | 25 (DQ-801 to DQ-820, DQ-848 to DQ-852) | 10 (DQ-809 to DQ-811, DQ-816, DQ-818 to DQ-820, DQ-848, DQ-851, DQ-852) | 0 | 6 | — |

## 4. Historical evidence snapshots

These rows preserve the scope and precision of the source.
They do not add issues to the live ledger.
Source dates refer to the incident record, unless a reviewed revision is given.

| ID | PR / source date or revision | Reported evidence | Counting limit | Source |
| --- | --- | --- | --- | --- |
| S1 | #49 / 2026-10-30 | Build exceeded one hour; about 4 minutes before the first e2e test; about 2 minutes per closed-port probe | Reported timing, not a benchmark; sandbox delay remains open | [Startup delay](lessons-learned/e2e-server-reuse.md) |
| S2 | #54 / 2026-10-31 | One cross-review: 5 bugs, comprising 1 P1 and 4 P2 | Exact for this review; later fixes and process issues are outside this count | [Spec omissions](lessons-learned/self-review-against-the-spec.md) |
| S3 | #57 / `0eb6b42` | Review missed the staged-cleanup contract difference; owner raised it | One documented omission; no source total or severity | [Contract review](lessons-learned/review-contract-boundaries.md) |
| S4 | #59 / 2026-11-03 | About 32 problems in 7 rounds; about 18 order/timing cases; 5 further spec contradictions; PR reached 59 files | Approximate snapshot; categories and later rounds are not an additive total | [State complexity](lessons-learned/state-table-before-stateful-code.md) |
| S5 | #59 / 2026-11-03 | Three more review rounds reported 1, 3, and 3 P2 findings | Round IDs and overlap with S4 are not reconciled | [Order checks, Observed](lessons-learned/check-every-order-before-the-push.md) |
| S6 | #59 / audit recorded 2026-11-03 | Audit found 8 defects: 3 from tables, then 3 and 2 from fresh review passes; source reports failing tests first | May overlap S4, S5, or S7; not a separate lifetime total | [Order checks, Audit result](lessons-learned/check-every-order-before-the-push.md) |
| S7 | #59 / `571375a` | 3 P2 and 1 P3: overlapping requests and missing list states | Exact for this review; relationship to other snapshots unresolved | [Overlapping requests](lessons-learned/two-of-my-requests-at-once.md) |

