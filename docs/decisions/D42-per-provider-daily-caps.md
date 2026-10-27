# D42. Optional daily caps per provider, under the total cap

Status: accepted (2026-10-22, owner). Amends D20 (one global cap); D20's other rules and D40 stand.
Amended on 2026-10-27 by the owner, from the review thread "Explain our eval and guardrail
features": a model with no known price is refused while a cap applies to it.
Amends: D20
Decision: Keep the total daily cap of D20 and add an **optional daily cap per provider**
(`anthropic`, `openai`, `deepseek`, … as in the model id prefix). A run is refused when **its
provider's cap or the total cap** is reached, whichever comes first. A provider with no cap of its
own counts only towards the total. Each cap gets its own 75% and 90% alerts (D40) and its own
100% notice. As in D20, a run already running finishes, so a cap can be passed by one run.
Example: total $10, OpenAI $4, Anthropic $5, DeepSeek empty. When OpenAI spend reaches $4, bots on
OpenAI models stop and the others keep working until the total reaches $10.
Not chosen: caps per model (too fine-grained to manage) and caps per API key (keys come from
environment variables, one per provider, so per key and per provider are the same today).
Consequences: Spend is still an estimate (D21); the provider consoles remain the hard limit.
No migration: the caps live in `settings` as one JSON value.

Amendment (owner, 2026-10-27): **no price, no run under a cap.**

- Before, a request on a model with no known price (D21: price source "unknown") counted toward
  no cap. So a bot on such a model could spend with no limit while the owner thought the cap
  protected them.
- Now: when the total cap is on, or the model's provider has its own cap, the app refuses a
  request on a model with no known price. This applies to runs, title requests (D46) and memory
  upkeep requests (D63), at the same checks as the caps.
- A refused run is `failed` with `price_unknown`. Its system notice says: "<model label> has no
  known price, so the app cannot keep it under the daily cap. Add a price in
  `config/models.yaml`, or turn the cap off." A refused title request is `skipped` with reason
  `cap`, as for a reached cap. A refused memory upkeep request returns 429 `price_unknown`.
- With no cap that applies, a model with no known price works as before: tokens are recorded and
  the cost shows "cost unknown".
- Settings flags the model (UI-8.2) and says that its runs are refused while a cap is on.
- Example: total cap $10. A new provider model is not in `genai-prices` yet and has no override.
  BA uses it. BA's next run fails with the notice. The owner adds
  `price_override_per_mtok` in `config/models.yaml`, and BA runs again.
- Why: a cap that some models can pass without a limit gives a false sense of safety. The fix
  costs the owner one line in `config/models.yaml`.
Why: With one total cap, one busy provider could use the whole budget and stop bots on every
other provider.
Implemented in: `../requirements/settings.md` UI-8.3, `../domain-model.md` §10 and §13,
`../api.md` §1 and settings, `../realtime-events.md`, task M5.
