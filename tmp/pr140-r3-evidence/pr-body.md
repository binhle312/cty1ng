## Plan delta r3

Order 160 approved the r3 build and the exact night Ready rule in AGENTS.md §10. Order 153 keeps the redesign and cleanup in draft #140. Round 1 reviewed `808e4fe`. The owner starts Option B round 2 on a clean checkout after the build gate.

```text
chief dispatch -> sync leader init
chief grant -> check current review, exact head and main, CI, and automation
leader merge -> lock, sync claim, Ready, sync Ready result, final read, pinned PUT
chief confirm -> exact live merge and required checks on main
leader clean -> exact worktree, local ref, and remote deletion or verified absence
```

The [r3 build evidence](https://github.com/binhle312/cty1ng/blob/skill-overnight/tmp/pr140-r3-evidence/plan-lines.md) lists the proofs and gaps. Earlier BRIEF-8 and BRIEF-9b results below describe their recorded revisions.

## Plan for Option B and chief-led review

Orders 136 to 141 approve Option B and its rule text. Orders 143 to 145 put review with the chief, set the cap per PR, and define the P3 path. Order 148 sets the scope when main moves.

## What

The chief checks the leader's plan and test strategy, then starts the assigned pair on a clean checkout. The chief keeps the original reports and rulings. The grant command takes two report paths and checks live GitHub evidence.

```text
leader requests a round for one pushed head
  chief checks the plan and prepares the review brief
  chief starts the pair and records the verdicts
  leader fixes open findings while rounds remain
  chief checks and issues one eligible grant
  leader uses the grant
  chief confirms the same reviewed head and green main
```

## Why

Keep the chief's permission tied to the reviewed PR and head. Apply the review cap to each PR. Keep the grant reserved until the merge is confirmed or live evidence permits withdrawal.

Order 149 adds ordered cleanup after a recorded merge. Order 150 puts each leader journal in a fixed folder outside the worktree. See the [approved cleanup plan](https://github.com/binhle312/cty1ng/blob/skill-overnight/docs/plans/pr-140-overnight-cleanup.md).

## Acceptance criteria

| AC | Evidence |
| --- | --- |
| Remove the hook and command-text gate. Use typed merge targets. | `test_retired_gate_and_typed_consumers`, tracked removal |
| Treat earlier journal layouts explicitly. | `test_format_boundary`, `ignore-format-version` |
| Record the chief's plan check and require the assigned review pair. | `test_unchecked_plan_cannot_start`, `test_started_round_requires_current_assignments`, `test_assignment_refuses_unapproved_role` |
| Have the chief start each reviewed head. Keep the original reports in its folder. | `test_chief_starts_review`, `test_checkout_and_report_verdict`, `ignore-report-digests` |
| Count rounds per PR. Freeze 5 rounds and a bonus of 3 per merge of main by default. | `test_merge_bonus_is_frozen_per_pr`, `test_review_cap_stops_at_eight_for_one_main_merge` |
| Fix P3s below the cap. Require recorded advice if only P3s remain at the cap. | `test_p3_needs_fix_then_advisor_at_cap`, `skip-advisor-at-cap`, `skip-consultants-at-cap` |
| Review every new head. Scope the diff to the PR and check its merge resolutions and interfaces with main. | `test_new_head_needs_full_round`, `test_review_brief_shows_main_intersection_and_resolution`, `test_clean_round_cannot_reuse_reports_for_a_new_head` |
| Keep owner tasks out of grants and keep rulings with the chief. | `test_section_seven_has_no_grant`, `test_only_chief_rules_on_findings` |
| Check the live head, CI and owned files from the grant. | `test_grant_refuses_legacy_fields`, `test_grant_reads_live_head_ci_and_scope`, `accept-old-reviewed-head` |
| Confirm the granted SHA and green main before another grant. | `test_grant_waits_for_merge_and_green_main`, `allow-parallel-grants`, `accept-wrong-merge-head`, `skip-main-ci` |
| Record old writer release before a replacement can start. | `test_replacement_needs_release`, `test_replacement_rejects_outdated_leader` |
| State the night review rule from the merge bar. | `test_merge_bar_links_night_rule`, `drop-night-merge-bar-link` |
| Clean the leftovers of a recorded squash merge in order. Keep the journal. | `test_squash_merge_cleans_in_order` |
| Stop before the first removal when the worktree has an uncommitted file. | `test_uncommitted_file_stops_first_removal`, `cleanup-ignore-dirty` |
| Keep a moved remote head and report the refusal. | `test_moved_remote_head_stops_remote_delete`, `cleanup-skip-remote-sha` |
| Keep all items when the exact PR is open. | `test_open_pr_keeps_every_item`, `cleanup-allow-open` |
| Keep unrecorded temp files and files outside the assigned roots. | `test_unrecorded_temp_file_stays`, `cleanup-glob-temp` |
| Keep the default branch. | `test_default_branch_keeps_every_item`, `cleanup-allow-default` |
| Show recorded deletions and refusals after the worktree is gone. | `test_morning_report_lists_deletions_and_refusals`, `cleanup-omit-deletions` |

## Evidence

### Plan delta r3

- The red logs record 23 failing assertions before their fixes.
- The break runner reported `70 of 286 breaks caught, 216 invalid`. The records check separately caught the stale #140 count in A34.

### BRIEF-8

The standalone Python skill suite, repository proof tests and named breaks passed. The CLI tests use local Git repositories and fake GitHub data.

```text
Ran 194 tests
OK

51 of 51 named CLI, replay and merge-bar breaks caught
5 of 5 runner and evaluator evidence breaks caught

Tests  2829 passed (2829)
104 passed (Playwright)
```

### BRIEF-9b

The red run on `e7f28b9` failed at the missing dispatch fields. Each named break ran the same CLI test on a green control and in a source copy with one mutation. Git operations that delete files or refs use disposable fixtures. GitHub replies are fake.

```text
FAILED (failures=7)
6 of 6 breaks caught
Ran 211 tests in 249.690s
OK
Tests  2829 passed (2829)
104 passed (7.9m)
```

The frozen offline install passed in a disposable checkout. Lint, typecheck, folder indexes, events, database check, production build, bundle budget, API generation, records, status and the static break gate passed. The generated client has no diff. The repository proof suite passed.

The first Vitest run failed a server-start timing assertion. The focused test and the full rerun passed. The first skill suite found a missing sample for the new journal field. The fuzz test and full rerun passed. The standalone validator still rejects the existing Claude invocation fields. Registry audit and hosted checks are outside this local run.

## Edge cases

| Case | Evidence |
| --- | --- |
| GitHub changes the head after the check. | `test_head_moves_after_check` on fake GitHub |
| Two callers use the same grant. | `test_merge_argv_and_one_attempt` |
| The grant append returns a sync error. | `test_grant_readback_after_failed_sync`, `test_write_recovery_at_append_boundaries` |
| A check and repair overlap. | `test_check_snapshot_orders_with_repair` |
| The morning audit sees an unlisted merge or a missing page. | `test_audit_includes_unlisted_owner_and_uses_half_open_window`, `test_audit_reports_a_missing_page` |
| GitHub reads the same head, then the remote moves before the push. | `test_remote_lease_stops_head_move_after_the_read` |
| Git removes the worktree but the result cannot be confirmed. | `test_interrupted_worktree_result_stays_open` |
| The fixed folder overlaps the chief folder or the recorded merge is missing. | `test_dispatch_and_merge_evidence_refusals` |
| A replacement checkout uses the ref after partial cleanup. | `test_local_ref_rechecks_after_a_partial_cleanup` |

## Differences from the plan

- [Plan-line table](https://github.com/binhle312/cty1ng/blob/skill-overnight/tmp/pr140-r3-evidence/plan-lines.md) records the open cases.
- [Removal record](https://github.com/binhle312/cty1ng/blob/skill-overnight/tmp/pr140-r3-evidence/removals.md) records the approved cuts.

- BRIEF-8 uses format 3 for the changed journal layout. Use the earlier tool revision for a historical journal.
- The chief records the plan check, reviewer dispatch and the old writer's release. Harness controls supply the access boundaries.
- The executed break list covers the tested CLI and replay paths. The daytime harness trace and the older retained mutation inventory are pending.

- BRIEF-9b adds fixture cases for lease races, interrupted results, temp identity and dispatch scope. The approved cleanup order stays the same.

## Needs human review

- **Orders 153–160.** R3 stays in this draft with the round 1 evidence and cap reset. Review the exact Ready sentence added to AGENTS.md §10 under order 160.
- The break gate remains open. The pinned scanner returned partial Tier 1 analysis. Tier 2 requires an embedding provider.
- Order 155 places the live pull request exercise after the owner's round 2. The owner starts review.

- DQ-977. See the ledger for the evaluator result and the missing scanner and embedding support.
- DQ-917, DQ-975 and DQ-997. See the ledger for the remaining proof and owner decisions.
- The chief starts the assigned review pair on the pushed head. The PR stays draft.
- The installed standalone skill validator rejects the existing Claude fields `argument-hint` and `disable-model-invocation`. The skill keeps those fields for Claude invocation.

- Review the cleanup exception and the fixed-folder handoff. The Codex launcher must apply the writable root at dispatch.

### Not claimed

- Orders 141 and 159. The CLI checks ordinary run, path, grant and head mistakes. A dishonest Claude or Codex leader can bypass these local rules. GitHub write access is outside the guarantee. Audit covers observed merges in its recorded window and names gaps.
- A restore to the valid prefix before a claim can permit another PUT for the same grant and head. GitHub refuses an already merged PR. A still-open PR is eligible only at the pinned SHA. Known loss needs reconciliation.
- Order 158. The three GitHub-managed entries compare by ID, path and state. The comparison does not prove their contents or effects. Tags and transitive inputs can change. The hook list covers visible repository hooks. Only the head SHA is pinned at PUT. Policy, CI, and inventory evidence describes the reads.
- Orders 149 and 154. A dependent PR can open after the last read and before auto-delete or the leased delete. The lease checks the ref SHA. A branch recreated at the same name and SHA can be removed.
- Order 155. Live squash and stale-head refusal evidence is pending. The private scratch policy would not copy cty1ng's review, code-scanning, or code-quality rules.

- Atomic head pinning on a live disposable PR.
- Actor authentication, Claude writer denial, merge-credential denial, and audit coverage beyond the tested window.
- A complete evaluator pass, daytime harness trace, or coverage of the whole historical mutation inventory.

- Live GitHub branch deletion, live Codex sandbox dispatch, or safety against unrelated writers that race the local checks.

## Docs updated

- Overnight skill, night card, rehearsal, morning report and merge bar.
- BRIEF-9b plan approval and status.
- Guide: not changed. The workflow runs outside the app.

## Folder indexes

- The project skill index lists the overnight skill. The Claude symlink points to the same source.

## Records

See DQ-900 to DQ-934, DQ-960 to DQ-999, and DQ-1001 to DQ-1032 in [delivery quality](https://github.com/binhle312/cty1ng/blob/skill-overnight/docs/delivery-quality.md). The ledger keeps historical review rounds at their original heads.

## Defect and review fixes

| Row | Finding |
| --- | --- |
| DQ-978 to DQ-986, DQ-995 and DQ-997 | Hook and command-text gate |
| DQ-987 and DQ-992 | Journal format and typed rows |
| DQ-988 to DQ-991 and DQ-994 | Write recovery, repair, coherent reads and break evidence |
| DQ-977 and DQ-993 | Evaluator evidence and invalid stop offsets |
| DQ-998 and DQ-999 | Merged PR cleanup and fixed leader folders |
| DQ-1001 to DQ-1032 | Option B round 1 findings R01 to R32. The ledger owns the dispositions and evidence. |

## Follow-ups

- The ledger exceeds its size threshold. Move eligible closed rows in the separate records PR specified in §7.

- Move eligible closed ledger rows in a records-only PR. The live ledger exceeds its archive limit.
- Keep the live disposable-PR experiment behind its own owner approval.

## Removal list at the merge (outside the repository; the chief deletes them after the owner's OK)

| File or part | Where its content lives after this PR |
| --- | --- |
| `tmp/super-agent/PLAYBOOK.md` §8b (lines 176-218) | the generic procedure: this skill. The project values: see the map below. The page rules: the decision-pages skill (#139). |
| User memory `overnight-mode.md`, paragraph 1 (the mode exists; the procedure is PLAYBOOK §8b) | this skill; the pointer line of the chief skill (the chief skill PR) |
| `overnight-mode.md`, paragraph 2 (HTML reports, option cards, "Copy my answers"; charts only for the night's status) | the decision-pages skill (#139): `SKILL.md` and `scripts/lib.mjs`; the chart rule: `references/morning-report.md` §2 part 4 |
| `overnight-mode.md`, "Why" (the owner likes numbers) | `references/morning-report.md` §2 part 4 (each number names its source) |
| `overnight-mode.md`, "How to apply" (start, delegate the page build, headless check) | the start: `SKILL.md` §1; the delegation: a chief rule (the chief skill); the headless check: decision-pages `scripts/verify.mjs` |
| `overnight-mode.md`, "Quiz layout" and "Two-pane layout" | decision-pages (#139): one question per step, 12 columns (facts 7, answers 5), Back and Next, the answered and remaining counts in `lib.mjs`; the user memory `owner-pages-page-kit.md` says that it supersedes these notes |
| `overnight-mode.md`, "Real options per question" | decision-pages (#139) rule R3.3; `references/morning-report.md` §3 |
| The `MEMORY.md` index line of `overnight-mode.md` | removed with the note |

## Project values: where they stay (not in the skill)

| Value (PLAYBOOK §8b and §8) | Home |
| --- | --- |
| Work only on the project's files | project memory (the chief's standing rules) |
| P3 questions go to consultants as one list | project memory |
| The review limit ("5 rounds" in §8b; one fix commit and bounded checks in §8a rule 3) | one home: the project's review rule (`docs/workflows/merge-bar.md`), not this skill |
| At most 2 leaders, one heavy command, the memory watch | project memory (the chief) |
| The bound of a "no loop" break test | `docs/testing.md` |
| The merge bar and 2 consultants before each chief merge | the standing permission rule of `AGENTS.md` §7 (W3, #139) and the rule file in `.agents/memories/long-term/rules/` |
| Who the consultants are (models, commands) | project memory |
| A passed rehearsal of this skill (date, skill version) | project memory, after the rehearsal |
| `NIGHT_MAX_GAP_MIN`, if the project wants a maximum gap alarm other than 60 minutes | the project's environment (the default is `DEFAULT_MAX_GAP_MIN` in night.py) |
