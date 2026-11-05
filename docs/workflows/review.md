# Review code or a PR

Before a protected action, check [AGENTS.md §7](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr).

For every local code review, PR review or review of fixes, follow [review-guide.md](../review-guide.md).
Keep its evidence table with the review record. Record the review per [delivery quality](../delivery-quality.md#7-update-and-assess). Use this prompt for a slice PR:

```
You are reviewing PR <url> for slice <M#>. You did not write it.
Read AGENTS.md, docs/review-guide.md, docs/tasks/<M#>-<name>.md, and the documents it lists.
Read the approved plan revision. Follow the guide's evidence table and completion checks.
Check, in order:
1. Every acceptance criterion: is it implemented, and does the cited test really prove it?
   Run the tests yourself.
2. Architecture rules in AGENTS.md §5 (domain purity, events in the same transaction,
   generated client only, immutability rules, workspace port use, Markdown rendering).
3. Security: anything touching docs/security.md controls.
4. Invariants in docs/domain-model.md §12 that this slice touches.
5. Docs: does the PR update the owning document for every behaviour change? For a changed
   rule, does it still agree in meaning with each decision in its "Changed by" column
   (`decisions/README.md`) and with every summary table that cites it?
6. Simplicity: code that could be removed or made plainer.
Report findings in the requested destination, most severe first, each with the file, line,
why it matters, and severity (docs/workflows/merge-bar.md). Publish PR comments only when the
session authorizes it. Do not push commits. State the evidence limits if no defect was found.
```
