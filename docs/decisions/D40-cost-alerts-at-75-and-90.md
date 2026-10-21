# D40. Cost alerts at 75% and 90% of the daily cap

Status: accepted (2026-10-21, owner). Supersedes D20's 80% warning; the rest of D20 stands.
Decision: When today's estimated spend crosses **75%** and then **90%** of the daily cap, the
owner is notified:

- a banner across the app;
- a toast;
- a system line in every conversation that has a running or queued run.

Each threshold fires once per day. At **100%** bots stop: no new run is claimed, as in D20.
Notifications are in-app only in phase 1. Desktop notifications can follow if the owner wants
them.
Open for the owner: D20 lets a run that is already running finish, so spend can pass the cap by
one run. "Bots stop working when hit the cost cap" could also mean stopping that run at once,
like the Stop button. Recommended: keep D20 (finish the running run), because cutting it off
wastes the tokens already spent and leaves half-written files.
Why: Two warnings give time to react before work stops.
Implemented in: `../requirements/settings.md` UI-8.3, `../domain-model.md` §13, task M5.
