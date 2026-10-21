# D21. Token and cost tracking

Status: accepted (2026-10-21)
Decision: Usage is recorded **per model request**, not only per run (a run with tool calls makes
several requests). Each request stores the normalised fields Pydantic AI exposes (input, output,
cache-read, cache-write tokens; model name as resolved by the provider; provider response id;
finish reason; timestamps; latency), plus the provider's full usage details as raw JSON, so
provider-specific fields (reasoning tokens, cache TTL split, server-tool counts, service tier)
are kept without schema changes. Cost is estimated per request with the `genai-prices` library
(maintained price data; Pydantic AI's `RequestUsage` is designed to be priced by it), with an
optional per-model override in `config/models.yaml`. The cost and the price source are stored
on the request at completion, so later price changes do not rewrite history. Runs hold totals.
The UI shows usage per message, per bot, per conversation and per day.
Why per request: pricing can depend on a single request's size (for example long-context tiers),
so summing a run's tokens first and pricing afterwards can be wrong; Pydantic AI's docs warn
against summing usage before pricing.
Why: The owner wants to know what each bot costs; the data is free (providers return usage
with every response) and D20 needs it.
Rejected: Asking bots to report usage (they cannot know it); fetching invoices from provider
billing APIs (provider-specific, delayed; possible later for reconciliation).
Implemented in: `../domain-model.md` §4 and §7, `../requirements/conversation.md`, `../requirements/bots.md` (UI-6), `../requirements/settings.md` (UI-8).
