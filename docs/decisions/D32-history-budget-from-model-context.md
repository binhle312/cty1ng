# D32. History budget is a per-bot share of the model's context window

Status: accepted (2026-10-21, owner).
Decision: The transcript and the bot's own `run_history` share one budget per run:
`history_share_pct` of the model's `context_window` from the catalog. Each bot sets the share
with a slider (10–80 %, step 5); the default is 40 %. History fills newest first; older lines
and runs are dropped with a marker. `run_history` only includes runs on the active branch.
Why: Models differ widely (64k to 1M tokens), so a fixed token limit is either wasteful or too
small. A share scales with the model. Bots differ too: a reviewer needs deep history, a
formatter needs little. The owner chose 40 % so most of the window stays free for the run's
own work (tool results, file reads, the reply). `run_history` had no limit at all and kept
work from abandoned branches.
Rejected: A fixed token limit for all models; one global percentage; always filling the whole
window (cost grows with every run, and answer quality tends to drop on very long inputs).
The 80 % maximum keeps at least a fifth of the window for work.
Consequences: Adding a model needs only its `context_window` in `config/models.yaml`. At the
default a bot on a 1M model can send ~400k tokens of history per run, so the slider and the
daily spending cap (D20) are the cost controls. Token counts are estimates; one retry with a
halved budget covers underestimates. The default can be tuned later from the per-run token
statistics.
Implemented in: `../conversation-rules.md` §4, `../domain-model.md` (bots, run_history),
`../requirements/bots.md` (UI-5.1).
