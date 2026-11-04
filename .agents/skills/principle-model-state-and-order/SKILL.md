---
name: principle-model-state-and-order
description: Model transitions when requests overlap, replies arrive late, or state survives navigation, locks, retries, or live events.
---

# Model state and event order

Define the state rules before control flags. Give each flow one state owner.

1. Remove avoidable states first. Ask if the UI can block the action, queue it, or skip the optimistic update.
2. Treat a removal that changes visible behaviour as an open decision.
3. List authoritative data, pending operations, request IDs, versions, and invariants.
4. Build a state-by-event table. State what each cell shows and keeps.
5. Explain impossible cells. Resolve unspecified cells before dependent code.
6. Define which fields each request owns and when its answer remains valid.
7. Keep transitions pure where possible. Put I/O at the boundary.
8. Test cells and event sequences. Check invariants after each event.

Use the approved failure scope to decide which cases apply. See `principle-set-review-exit`.
Cover late answers, newer requests, caller departure and return, and intervening loads or live events.
Cover failed or slow refreshes, rejection, lost answers, cancellation, and recovery.
For overlapping requests, each answer must end only its own work.
If both requests fail, both completion orders must recover the server's state.
Keep loading, error, empty, and success states distinct.
Use an independent reference model for sequence tests. Keep seeds and traces for random failures.
Sampled runs do not prove every order.

**Done:** Each applicable cell has an assertion. Sequence tests check the rules across intermediate states.
