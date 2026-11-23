# Settings

The values that the chief's method reads (the memory contract). The check knows each key, and
which keys are numbers; it does not know the values. To change a value, change its row and its
source in a memory PR. A value with the source "#139 plan" is the chief's choice, not an owner
order, and the owner can change it.

| Key | Value | Source |
| --- | --- | --- |
| `leader_cap` | 2 | owner, 2026-11-13 (order 6): leader conversations at one time |
| `heavy_runs_at_once` | 1 | owner, 2026-11-13 (orders 4, 5); only one e2e run works at a time (fixed ports) |
| `heavy_commands` | `pnpm test`, `pnpm e2e`, `pnpm build`, `pnpm check:breaks`, a test file that runs more than about 60 s, long probes | owner, 2026-11-13 (orders 4, 5); the chief grants each run |
| `checkpoint_left_percent` | 40 | owner, 2026-11-13 (order 23) |
| `context_window_tokens` | 1000000 | the window of Opus 5.5, Sonnet 5.5 and Fable 5.2, checked on 2026-11-13 |
| `review_cap` | 5 | owner, 2026-11-13 and 2026-11-14 (orders 27, 48): review rounds before the work on a PR stops |
| `model_easy` | Sonnet 5.5 (`claude-sonnet-5-5`), effort `medium`, or `high` with recounts | owner, 2026-11-13 (order 9): written steps, little judgment |
| `model_medium` | Opus 5.5 (`claude-opus-5-5`), effort `high` | owner, 2026-11-13 (order 9): judgment inside clear rules |
| `model_hard` | Opus 5.5 (`claude-opus-5-5`), effort `xhigh` | owner, 2026-11-13 (order 9): design, proof, code fixes, security |
| `chief_model` | Opus 5.5 (`claude-opus-5-5`), effort `high` | owner, 2026-11-14 (order 47) |
| `owner_language` | Simple English (ASD-STE100, 80% target) | owner, 2026-11-06 and 2026-11-08 |
| `owner_pages` | HTML decision pages, made with the `decision-pages` skill | owner, 2026-11-19 (order 76) |
| `promote_after_hours` | 24 | owner, 2026-11-19 (order 78, arena Q2 A: a daily or nightly PR) |
| `drill_every_days` | 7 | #139 plan, 2026-11-19 |
| `boot_max_kb` | 80 | #139 plan, 2026-11-19; raised from 64 by the chief (2026-11-19, drill-139c fix): about 20,000 tokens, under 3% of the window |
| `identity_max_lines` | 80 | #139 plan, 2026-11-19 |
| `rule_max_lines` | 30 | #139 plan, 2026-11-19 |
| `state_max_lines` | 80 | #139 plan, 2026-11-19 |
| `lessons_max_lines` | 200 | #139 plan, 2026-11-19 |
| `quote_max_words` | 25 | #139 plan, 2026-11-19; the owner asked for short, dated quotes (order 78, arena Q3 A) |
| `quote_min_words` | 4 | chief, 2026-11-19 (#139 plan v3, Q3): a shorter quote proves little in the owner-quote check of order 109 |
| `audit_times` | 00:00, 08:00 and 16:00 (+07) | owner, 2026-11-19 (orders 108 and 109): the memory audit, rule R-037 |
| `audit_timeout_minutes` | 30 | chief, 2026-11-19 (#139 plan v3): the deadline of one audit run; the cron line copies it |
