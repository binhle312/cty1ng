# D2. No lead bot

Status: accepted (2026-10-20)
Decision: There is no bot that answers un-mentioned messages on behalf of others or routes work.
Why: Routing logic hides who decided what and costs extra model calls; explicit mentions are
predictable.
Rejected: A lead bot that triages and delegates.
Implemented in: `../conversation-rules.md` §1.
