# Fix the cause, not only the finding

Date: 2026-11-03 · Source: M2c review fixes, PR #59 · Status: applied

**Observed.** A review found that a late Profile answer brought back an old Always load
setting. The fix kept the answer's `pins` and skill counts out of the merge. The next review
found the same bug with the pinned position and health, and that fix added two more fields to
the same list. "Discard while Save waits" took four rounds in the same way, one case each.

**Cause.** Each fix answered the finding as written. Nobody named the rule behind it ("an
answer writes only the fields its request owns") or searched for the other places that broke
it. A list of fields to keep grows by one each time a review finds the next field.

**Change.** For each finding the builder names the broken rule, searches for every place with
the same cause, fixes the rule once and tests each place. The PR's review-fix table has a
column "Same cause checked in", and the reviewer looks for one more place itself.

**Rule now in.** `../workflow.md` §2 step 5 and §6; `../review-guide.md` §5.
