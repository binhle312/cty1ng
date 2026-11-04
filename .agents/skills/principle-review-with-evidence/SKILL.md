---
name: principle-review-with-evidence
description: Review code or fixes against each requirement, approved plan promise, and implementation boundary.
---

# Review with evidence

Trace each obligation to code and evidence. Judge compliance and runtime correctness separately.

1. Record the base, head, included local changes, and contract revisions.
2. Read the requirements, approved plan, amendments, and shared rules.
3. Give each obligation one row: source, operation, boundary, assertion, result, and evidence limits.
4. Trace validation, locks, transactions, publication, failure, and recovery.
5. Inspect test setup and assertions. Run checks that support the conclusion.
6. Report contract differences even when no runtime defect appears.
7. Recheck earlier issues and paths changed by their fixes.
8. Use independent review for material risk under the project's delegation rules.

**Done:** Every obligation has a result or evidence gap. Every prior issue has a disposition. Conclusions match the reviewed scope.
