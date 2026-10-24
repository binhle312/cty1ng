# D42. Optional daily caps per provider, under the total cap

Status: accepted (2026-10-22, owner). Amends D20 (one global cap); D20's other rules and D40 stand.
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
Runs whose price is unknown count towards neither cap, as before (Settings warns). No migration:
the caps live in `settings` as one JSON value.
Why: With one total cap, one busy provider could use the whole budget and stop bots on every
other provider.
Implemented in: `../requirements/settings.md` UI-8.3, `../domain-model.md` §10 and §13,
`../api.md` §1 and settings, `../realtime-events.md`, task M5.
