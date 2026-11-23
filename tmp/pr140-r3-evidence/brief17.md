# PR #140 · Brief 17 evidence

Base checkout `b00beb7d96384cf1fe6e8806faa17ee66e81ff7d`. The [previous run](breaks-delivery.log) reported 70 caught, 286 listed and 216 invalid.

| Original runner reason | Count | Examples |
| --- | ---: | --- |
| Historical edit had no current assertion mapping | 199 | `lock not exclusive`, `decide before the lock` |
| Legacy selector lacked an exact assertion site and subtest | 17 | `ignore-format-version`, `ignore-staged-cut` |

Of the 199 historical entries, 166 had one match for each edit, 32 had at least one missing match, and one had an ambiguous match. Examples of a missing match include `decide before the lock` and `B35 render takes no lock`. The one ambiguous entry was `A1 check misses a second final result`.

The current registry maps the retained breaks to the source module, replacement and exact assertion. The [historical retirements](../../scripts/overnight/historical_r3_breaks.py) and [Option B retirements](../../scripts/overnight/option_b_breaks.py) record the rules that changed or moved to separate checks. The runner requires a green control and one failure at the specified assertion. The original tests stay in the skill suite.

| Break that survived a replay | Test repair |
| --- | --- |
| `allow-leader-review-start` | The later replay rule still blocked the command. Check that the earlier authority check stops GitHub reads. |
| `D8 enum values are not checked` | Pass an invalid result outcome to the schema and assert the exact field error. |
| `lock not exclusive` | The old test could release the marker before the writer started. Keep the marker in place through lock acquisition. |

The first diagnostic replay reported 265 catches, 19 invalid and two survivors. It exposed duplicate teardown failures, misbound assertions, and edits that raised unexpected exceptions. The final run used dedicated fixtures where one change would otherwise fail several assertions.

## G08a

Grant and merge read the full PR file list. They apply one [owner-only path list](../../.agents/skills/overnight/scripts/night_owner_paths.py) before grant or claim. A rename contributes both paths.

| Test | Evidence |
| --- | --- |
| `test_grant_refuses_migration_classified_as_night` | Before the fix, the migration received a grant. After the fix, it returns `REVIEW_OWNER_PATH`, leaves the journal unchanged at grant and appears under **Needs you**. |
| `test_docs_only_pr_can_receive_grant_and_merge` | A PR with only `docs/x.md` gets a grant and sends one PUT to the fake GitHub API. |
| `test_merge_refuses_live_rename_from_owner_path_before_claim` | The same grant cannot cross a live diff with an owner-only rename source. The merge preflight leaves no claim and sends no Ready or PUT. |
| `test_owner_path_categories` | Fixture paths cover each listed category. Ordinary docs and similar names pass. |

### Not claimed

Content checks outside the path list still need the owner. Examples include a removed security guard call, secret handling, public API and UI changes, and scope or plan approval. [Plan delta](../plan-b/plan-delta-r2.md#11-needs-human-review--not-claimed)

## Gates

| Command | Result |
| --- | --- |
| `NIGHT_BREAK_JOBS=8 python3 -I scripts/overnight/mutants.py` | Pass. [289 of 289 breaks caught, 0 invalid](brief17-breaks.log). |
| Skill suite, `unittest discover` per module | Pass. 304 tests. |
| `python3 -B -m unittest discover -s scripts/overnight -p "test_*.py" -v` | Pass. Four runner and evidence tests. |
| `pnpm lint`, `pnpm typecheck` | Pass. |
| `pnpm check:index`, `pnpm check:status` | Pass. |
| `pnpm records:counts --write`, `pnpm records:counts` | Pass. A34 also rejected a stale #140 count in a disposable copy. |
| `pnpm test` | Pass. 2,829 tests in 141 files. The break runner is outside the skill folder. |
| `python3 -B tmp/pr140-r3-evidence/check-plan-lines.py` | Pass. Covers all 339 lines of the delta. |

The owner starts round 2. Order 155 puts the live test after that round. The earlier daytime and evaluator gaps remain in the [plan-line table](plan-lines.md).
