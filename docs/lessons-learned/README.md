# Lessons learned

One file per lesson: what the owner saw go wrong in how the project is built, why it happened,
and what changed because of it. Newest first.

**Rules**

- A lesson keeps the story. The rule itself lives in its owning document, and the lesson links
  to it ("One fact, one place", `../README.md`). When a lesson changes a rule, the same PR
  changes the owning document.
- Who writes it: the agent that the owner asks to fix the process, in the same PR as the fix
  (`../workflow.md` §8).
- Each file has a metadata line: `Date`, `Source` (the slice or PR where it was seen) and
  `Status`: `applied`, or `open` while part of the fix still waits.
- File names are kebab-case and say the lesson, not the date.

| File | Lesson | Source | Status |
| --- | --- | --- | --- |
| `e2e-server-reuse.md` | Keep the end-to-end servers running between local runs; run only the affected tests while fixing | M0c, PR #49 | open (sandbox hang) |
| `risk-probes-before-plan.md` | Try new libraries and parts in short probes before writing the plan | M0c, PR #49 | applied |
| `one-round-of-questions.md` | Put every open question in the plan, so the owner answers once | M0c, PR #49 | applied |
| `spec-gap-pass.md` | Before a slice starts, find what it needs that the specs do not say | M0c, PR #49 | applied |
| `split-ui-and-infrastructure.md` | Keep UI work and infrastructure in separate slices or PRs | M0c, PR #49 | applied |
| `write-down-pitfalls.md` | Write down library and lint pitfalls and test helpers, so they are not learned twice | M0c, PR #49 | applied |
