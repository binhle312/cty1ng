---
id: R-031
title: Work only on files of this project, and change nothing else on the owner's laptop.
status: active
scope: all-agents
said: 2026-11-14
orders: [27, 48]
ends: never
supersedes: []
amends: []
---
Rule: Write files only for this project: in the repository, its worktrees, its `tmp/` folder, and a temporary folder that the project's work needs outside every git repository. Ask the owner before an action on the system, such as a kill or an install.
Owner said: "Protect my laptop by only working on `cty1ng` project. Do not touch any files that are not related to `cty1ng` project" (2026-11-14)
How to apply:
Two kinds of work need a folder outside every repository: the export of the restore drill (put it in the job folder of the session, which goes with the job) and the TMPDIR of `pnpm check:breaks` (`environment.md`).
Watch the free memory with R-018. A denied action stays denied: tell the owner (L-17).
