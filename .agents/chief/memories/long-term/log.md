# Log

Append only. One heading for each promotion, lint, restore drill or migration.

## [2026-11-19] migrate | the first content, copied from the chief's notes and the owner's orders (#139)

- Sources: the chief's playbook, lessons and memory, the common context of the leaders, and 52
  auto-memory notes. Nothing was removed from the sources.
- Not copied: the method and the tools (they move with the `chief` skill PR), and the full texts
  of the orders (they stay private).

## [2026-11-19] restore | the first drill, on b0eecf5: 17 of 18 right, 1 partial (Q10), pass

- Method: `restore-drill.md`. The probe saw only `CLAUDE.md` and `AGENTS.md`: no memory file and
  no user-level skill.
- Q10 left out the consultants before the owner's page. Fix: R-016 now points to R-015.

## [2026-11-19] restore | the second drill, on c2702a1, graded by a fresh agent: 17 of 18 right, 1 partial (Q4), fail

- The probe saw only `CLAUDE.md` and `AGENTS.md`.
- Q4 said that a standing permission must cover each chief merge, and left out a merge that the
  owner asks for. The fix is in R-002, which waits for the owner's decisions of review round 1
  (DQ-895).

## [2026-11-19] restore | Q4 again, on f60347a, graded by a fresh agent: right

- R-002 now gives its two merge paths apart (DQ-895). The probe saw only `CLAUDE.md` and
  `AGENTS.md`. The answer gave both paths and each point of the key.

## [2026-11-19] restore | the third and fourth drills, on 5445f32 and ca66447, graded by fresh agents: 14 of 18 right each, fail

- The probe saw only `CLAUDE.md` and `AGENTS.md` each time.
- Q4 left out the PRs that no permission covers: the answer follows the R-002 steps, and the
  list is only in the Rule sentence (DQ-896). The redesign waits for the owner (DQ-897).
- Partial too: Q10, Q13 and Q16 on 5445f32; Q10, Q11 and Q13 on ca66447.

## [2026-11-19] restore | the fifth drill, on 2fe62e8 (the Check first redesign), graded by a fresh agent: 12 of 18 right, fail

- The probe saw only `CLAUDE.md`, `AGENTS.md` and skill names.
- Q4 gave only the merge bar of path 2, not path 1 (the owner asks), and named no item of the
  `AGENTS.md` §7 list (DQ-899). Q3 left out "no standing permission covers it".
- Partial too: Q2, Q10, Q11 and Q13. Q10 and Q13 are partial for the third time.
- No patch: the next step is the owner's.
