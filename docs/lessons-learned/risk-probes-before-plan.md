# Try new parts in short probes before writing the plan

Date: 2026-10-30 · Source: M0c build, PR #49 · Status: applied

**Observed.** The build hit problems that a short check would have found before the plan:
Zod's `new Function` and Base UI's inline styles broke under the CSP, the Hey API client had
type errors, and Base UI behaved differently from what the tests expected (no tooltip role,
link items that stay open).

**Cause.** The plan was written from the docs only. Libraries new to the repository were first
tried during the build, so each surprise stopped the build.

**Change.** Before writing the plan, the builder runs short probes on every part not used in
the repository yet, and puts the results in the plan as evidence. It checks the known
pitfalls first.

**Rule now in.** `../workflow.md` §2 step 2 "Risk probes first"; `../frontend-conventions.md` §5.
