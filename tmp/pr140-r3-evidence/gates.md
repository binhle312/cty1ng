# PR #140 build gates

These results apply to the local r3 candidate. GitHub's results apply to the preceding remote head.

| Command or check | Result |
| --- | --- |
| `python3 -I .agents/skills/overnight/scripts/run_tests.py -v` | Pass. 234 tests. [Log](skill-delivery.log) |
| `python3 -I scripts/overnight/mutants.py` | Fail. 70 caught, 286 listed, 216 invalid. [Log](breaks-delivery.log) |
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm check:index` | Pass |
| `pnpm check:status` | Pass |
| `pnpm records:counts --write` and `pnpm records:counts` | Pass. A34 rejects a stale count in a separate copy. [A34](A34-count-break.log) |
| `pnpm test` | Pass. 2,829 tests in 141 files. |
| `python3 -B -m unittest discover -s scripts/overnight -p 'test_*.py' -v` | Pass. Four runner and evidence tests. |
| `python3 tmp/pr140-r3-evidence/check-plan-lines.py` | Pass. All 335 lines have an evidence row or a stated gap. |
| SkillEvaluator Tier 1, offline | Exit 1. SkillEvaluator 0.9.0 and SkillSpector 2.13.4. Security analysis returned `partial` for a synthetic cleanup test. Dependency auditing was skipped for the offline run. [Full output](evaluator-tier1.log) |
| SkillEvaluator Tier 2, offline | Exit 1. There was no embedding provider. [Full output](evaluator-tier2.log) |
| Live test under order 155 | Deferred until after owner-led round 2. |

[Package manifest digest](package-digest.log). The former evaluator result remains in DQ-977.

GitHub reports draft head `808e4fe3d3eac4c6fd46d145e7f51edc863d3461` as `MERGEABLE` and `CLEAN` with 16 successful checks. The open build gate holds the push and live PR body update.
