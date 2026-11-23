---
id: R-035
title: Before each merge, check the two template-named tests of DQ-795 by hand until #107 merges.
status: active
scope: chief
said: 2026-11-19
orders: [68]
ends: until #107 merges
supersedes: []
amends: []
check-first: true
permission-rule: true
---
Rule: The CI job `check:breaks static` cannot read a test whose name is a template (DQ-795). Before each merge, check by hand if the PR changes `backend/src/adapters/http/uploads/skill-zip.test.ts:123` or `frontend/test/e2e/shell.spec.ts:73`. If it does, the break list of the PR must name that test.
Owner said: "Q1: A / Q2: B / Q3: D / Q4: A / Q5: A" (2026-11-19)
How to apply:
Check first: before each merge, does the PR change `backend/src/adapters/http/uploads/skill-zip.test.ts:123` or `frontend/test/e2e/shell.spec.ts:73`? Then the break list of the PR must name that test.
- The quote is the owner's answer line of order 68; this rule is its Q5.
- Run `git diff --stat origin/main...<head>` on the two files, and read the break list.
- When #107 merges with its revision 5, give this rule the status `ended`.
Not covered: The check of other template names: #107 changes the reader.
