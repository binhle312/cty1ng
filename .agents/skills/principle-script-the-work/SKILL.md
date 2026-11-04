---
name: principle-script-the-work
description: Write a script that does or proves non-trivial edits, analyses, or checks, so that a reviewer can rerun the work.
---

# Script the work

A script does the work the same way each time, and a reviewer can read and rerun it.
Someone can check work done by hand only if they do it again.

1. Do the first unit by hand to learn the steps.
2. Write the smallest tool for the job. Use a codemod for edits, a generator for repeated files, a query for analysis, or a rerunnable check for verification.
3. Run the tool on the first unit. Compare the output with your hand result.
4. Make the tool safe to rerun.
5. Run the tool on all units yourself. Use subagents only for work that a tool cannot do.
6. If you use subagents, give them one shared skill with the steps, the checks, and the files to leave alone.
7. Keep that skill outside their write scope.
8. Commit the tool when later work needs it. Otherwise, put its source in the PR description.

Skip this only for a few obvious edits that a reader can check at a glance.
A one-off job also needs a tool when the tool makes the work checkable.
Write a small script, not a framework.
For a rule that must hold in all later work, use `principle-automate-checks`.

**Done:** A reviewer can read the tool and rerun it from the diff or the PR description. The rerun gives the same result.
