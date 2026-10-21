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
Resolved with the recommended answer (2026-10-21; the owner can still override): as in D20, a
run that is already running finishes, so spend can pass the cap by one run. Stopping it at once
would waste the tokens already spent and leave half-written files.
Why: Two warnings give time to react before work stops.
Implemented in: `../requirements/settings.md` UI-8.3, `../domain-model.md` §13, task M5.
