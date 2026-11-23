# PR #140 r3 build evidence

The [approved plan](../plan-b/plan-delta-r2.md) is the source for the line numbers. Each range includes its headings, table syntax, and blank lines. A gap names the specific proof or implementation that remains. Code paths refer to the local candidate.

| r3 lines | Code or test | Gap and reason |
| --- | --- | --- |
| 1–13 | `1fd51f6`, [round 1 analysis](../review-r1/analysis.md), AGENTS.md §10 | The approved text still records that approval was pending when written. Order 160 supplies that approval. |
| 14–19 | `night.py:cmd_new/cmd_go`, `night_review.py:automation_valid`; `test_grant_same_minute` | A new night may have no targets yet. The missing-baseline refusal is at `go` when targets become known. Separate A08/A12 break variants remain. |
| 20–21 | `night_chief.py:review_command/grant_fields`, `night_review.py:current_review_allows`; tests `test_same_head_reports_cannot_cross_prs`, `test_new_review_blocks_an_unused_same_head_grant` | The full cap, disposition, and both-order proof remains. |
| 22–24 | `night_files.py:LeaderLock/bound_night`, `night_leader.py:init_leader/leader_events`, `night_rules.py:check_grant` | Separate rehearsal, lock-order, and missing-after-send mutations remain. |
| 25–28 | `night_merge_policy.py:merge_policy/require_night_paths`, `night_review_io.py:changed_paths`; [G08a evidence](brief17.md) | The workflow and file checks have focused proofs. Other drift and fork variants remain. |
| 29–31 | `night_merge_policy.py:branch_deletable/exact_dependencies`, `night_review.py:check_statuses`, `night_review_io.py:reviewed_head_matches` | Latest CI and automation have focused controls. No complete page, native status, and green-main move matrix. |
| 32–34 | `night_merge.py:command/claimed_merge/final_read`, `night_chief.py:merge_resolution`; A13 red cases and current tests | Timeout, lost reply, sync boundaries and final eligibility need separate proofs. |
| 35–39 | `night_cleanup.py:worktree_state/clean/remote_delete`; `test_output_mount_or_other_device_refuses_before_any_delete`, `test_verified_remote_absence_succeeds_without_push`, `test_cleanup_cannot_run_inside_its_worktree`, `test_remote_lease_stops_head_move_after_the_read` | Later-page dependencies, protection variants, prior-writer release effects and late-dependency trace remain. |
| 40–75 | [Read probes](../review-r1/gh-probes.md), `test_approved_active_inventory_and_auto_delete_are_eligible`, `test_draft_grant_claims_then_marks_ready_before_pinned_put`, `test_allowed_ignored_outputs_keep_external_link_targets` | The plan walk is hypothetical. The same end-to-end case and exact fresh-main trace have no collected proof. |
| 76–86 | `night_files.py:bound_night`, `night_leader.py:checked_leader_folder`, `night_review_io.py:load_report/reports_at`, `night_review.py:report_binding` | Each exact binding field, report digest, and replay mutation needs its own proof. |
| 87–88 | `test_merge_refuses_replaced_lock_inode`, `test_same_head_reports_cannot_cross_prs`, `test_report_verdict_refuses_wrong_target_alone` | Same-substitute and deliberate tamper limits apply. Both lock orders and all report fields remain unproved. |
| 89–97 | `night_leader.py:init_leader/repair_leader`, `night_files.py:staged_repair`, `night_review.py:action_problem` | The chief and leader stages share repair logic. Full interruption, stale-marker, and gap-reconciliation paths remain unproved. |
| 98–111 | `night_merge.py:command/claimed_merge/final_read/remaining`, `night_leader.py:leader_prefix`; A03, A05, and A13 focused tests | Sync, definite eligibility, and reread variants remain. Valid-prefix restoration can erase a claim. |
| 112–120 | `AGENTS.md` §10 and `night_format.py:FORMAT` | Historical readers require their matching revisions. |
| 121–131 | A03, A04, A05, A07 and A13 named tests in `test_option_b_merge.py`; older fault tests in `test_races.py` and `test_option_b_recovery.py` | There is no exact break for each listed fault. A06 path-specific proof and after-claim process exit are incomplete. |
| 132–155 | `night_review.py:automation_valid`, `night_merge_policy.py:merge_policy/exact_dependencies`; [live settings read](../review-r1/gh-probes.md) | The checked-in read values are evidence. The chief supplies the approved JSON at `new`. Most single-field breaks remain. |
| 156–165 | `test_approved_active_inventory_and_auto_delete_are_eligible`, `test_unknown_policy_and_write_effects_hold` | A12 baseline and PR file mutations, green-main move, and A13 same-repo, late dependency, and write-trace matrix remain. |
| 166–188 | `night_merge_policy.py:merge_policy`; [ruleset probe](../plan-b/plan-delta-r2.md#ruleset-probe) | The fake fixture does not yet exercise every live-shaped ruleset clause or every PUT outcome. |
| 189–196 | `night_cleanup.py:dispatch/temp_location/stage_temp/restore_link`; `test_replaced_temp_is_restored_after_staging` | The occupied-name and interrupted restore proofs remain. Full prior-writer evidence still needs the runtime trace. |
| 197–201 | `night_cleanup.py:worktree_state/verify_outputs/mounted_paths`; A16 controls in `test_cleanup.py` | Simulated mount and device checks passed. Individual output-name and symlink-root breaks remain. |
| 202–209 | `night_cleanup.py:remote_guard/live_merge/remote_delete`; `test_verified_remote_absence_succeeds_without_push`, `test_remote_protection_and_url_rewrite_keep_the_ref` | Auto-delete-on absence, denied-ref read, and live scope need separate cases. The lease cannot prevent an open PR from appearing after the final read. |
| 210–220 | `test_cleanup.py` A14–A16 controls | The table's individual dependency, ownership, interruption, and ignored-path breaks remain. |
| 221–223 | `test_output_mount_or_other_device_refuses_before_any_delete`, `test_interrupted_worktree_result_resumes_from_verified_absence` | Separate conflict-state proof for registration and path evidence remains. |
| 224–237 | `night_rules.py:apply/review_kind`, `night_chief.py:release_unused`, `night_review_io.py:main_merges`; A07, cap and earlier P3 tests | The old-tip sync witness, disposition text, both-order claim contention, and complete case matrix remain. |
| 238–249 | `night.py:check_policy`, `night_review.py:check_statuses`, `night_chief.py:grant_fields/merge_resolution`; A17 newest-run control | Exact status and check pagination, classic 404 variants, and provenance evidence need separate proof. |
| 250–258 | `night.py:audit_facts/cmd_audit`, `night_report.py:audit_pr/render`; A19 early and later cutoff test, A21 historical P3 test | Exact clock skew, late results, all finding dispositions and cap handoffs still need proof. |
| 259–269 | `scripts/overnight/cases.py`, `mutant_verdict.py`, `test_mutant_verdict.py` and [brief 17](brief17.md) | The break list gives each historical name a runnable edit or a retirement reason. See the run for exact results. |
| 270–275 | A13 pinned sequence and A30 exact argv tests | The stop, actor and harness traces remain. Order 155 defers the live trial until after round 2. Tier 1 did not complete the security scan. Tier 2 requires an embedding provider. |
| 276–282 | `night_format.py:FORMAT`, `night_chief.py:grant_fields`; `test_format_boundary`, `test_unknown_outcome_never_reissues` | Full historical layout, retry-class, and A32/A33 breaks remain. |
| 283–284 | `docs/delivery-quality.md` register, rows DQ-1001 to DQ-1032, and Option B round 1 row. | A34 changes only the #140 register count in a disposable copy. The check rejects the stale cell. |
| 285–303 | Gap | Order 155 defers the live private-repo trial and its traces until after the owner-led round 2. |
| 304–322 | This table and the [round 1 ledger](../../docs/delivery-quality.md#5-live-issue-ledger). | Several underlying r1 references are available only in the original worktree's ignored `tmp/plan-b` directory. |
| 323–328 | [Removal record](removals.md), [red logs](#red-runs) and [brief 17 gates](brief17.md) | The owner starts round 2. The review and live test have separate authorization. |
| 329–339 | [Prepared r3 PR body](pr-body.md), exact AGENTS.md §10 sentence and [brief 17](brief17.md) | Content-only §7 changes outside the path list need a human check. |

## Red runs

| Log | Failing assertions |
| --- | --- |
| [A01/A02](A01-A02-red.log) | Replaced lock and same-head report copied to another PR |
| [A03](A03-red.log) | No journal at dispatch and a first grant with the journal absent |
| [A05/A19](A05-A19-red.log) | Leader repair, unsearched cutoff and missing leader journal |
| [A07](A07-red.log) | New blocking review left the old grant usable |
| [A12/A17](A12-A17-red.log) | Approved active CI and auto-delete, and older CI failure |
| [A12](A12-incomplete-red.log) | A truncated workflow list could pass the expected inventory |
| [A13](A13-ready-red.log) | Draft grant, Ready error and head change |
| [A14/A16](A14-A16-resume-red.log) | Verified absence and completed worktree removal on retry |
| [A15](A15-red.log) | Replacement temp file reached deletion |
| [A16](A16-red.log) | Approved outputs, simulated mount and other device |
| [A18](A18-red.log) | A matching check without a durable ID could authorize a send |
| [A21](A21-red.log) | Later clean round erased the previous P3 from the gate |
| [A23](A23-red.log) | Another assertion with the same failure message earned credit |
