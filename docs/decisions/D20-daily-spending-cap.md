# D20. Daily spending cap

Status: accepted (2026-10-21). Amended by D42 (optional caps per provider under this total cap).
Decision: One global (owner-level) daily cap in USD on estimated spend across all providers,
computed from recorded tokens (D21). Warning banner at 80%. At 100% new runs are refused with a
system message ("Daily cap reached ($10.02 / $10). Raise it in Settings or wait until
midnight.") until local midnight or until the owner raises the cap. A run already in progress
finishes, so the cap can be exceeded by one run. Off when no cap is set.
Consequences: It is an estimate, not an invoice. The owner should also set spend limits in each
provider's console; the app's cap is the fast local guard.
Why: The turn budget and runs-per-hour cap bound one conversation, not the total across many.
Implemented in: `../conversation-rules.md` §2 (if accepted), task M5.
