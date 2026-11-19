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
