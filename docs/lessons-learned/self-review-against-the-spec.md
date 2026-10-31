# Check the code against the spec before the PR

Date: 2026-10-31 · Source: M1b build, PR #54 · Status: applied

**Observed.** The cross-review of PR #54 found one P1 and four P2 bugs. Each behaviour was
already in the docs: a save in another tab reset this tab's unsaved edit; Create left an edited
Clone without asking (`skills-page.md` §14); a second Clone proposed a taken slug (§12); a
failed request showed Page not found (the four required states); time tooltips did not open
from the keyboard (`ui-rules.md`). All tests were green.

**Cause.** The builder tested the normal path of each acceptance criterion and stopped when the
tests passed. Nobody read the spec sections one by one against the code before the PR, and the
edge cases that break these rules (two tabs, the same action twice, a failed request, keyboard
only) had no tests.

**Change.** Before the PR, the builder checks each section of the slice's spec against the code
and tests these edge cases on purpose. The PR description lists the sections checked.

**Rule now in.** `../workflow.md` §2 step 4 "Spec walk"; `../testing.md` §3 "Edge cases each
slice tests".
