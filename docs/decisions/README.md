# Decisions

One file per design decision. Each says what was decided, why, and what was rejected, so
nobody has to rediscover the reasoning. This index is the list of record.

**Rules**

- Status is one of `proposed`, `accepted`, `superseded by Dnn`.
- Accepted decisions change only through a new entry that supersedes them. Edit the old entry
  only to set its status.
- Agents may add `proposed` entries. Only the owner moves an entry to `accepted`.
- Each entry links to the document that implements it.
- One decision per file, named `Dnn-short-title.md`. Take the next free number; never reuse one.
- Add a row to the index below in the same PR as the new file.
- Paths in "Implemented in" are relative to this folder.

Template:

```
# Dnn. Title
Status: proposed | accepted (YYYY-MM-DD) | superseded by Dmm
Decision: one or two sentences.
Why: the reasoning.
Rejected: alternatives and why not.
Consequences: what this makes harder or easier.
Implemented in: links.
```

## Index

| Id | Decision | Status |
| --- | --- | --- |
| D1 | [Single human, no login, localhost only](D01-single-human-no-login-localhost-only.md) | accepted |
| D2 | [No lead bot](D02-no-lead-bot.md) | accepted |
| D3 | [Reply rule](D03-reply-rule.md) | accepted |
| D4 | [Bot-to-bot discussion with a server-enforced turn budget](D04-bot-to-bot-turn-budget.md) | accepted |
| D5 | [Hybrid skill storage](D05-hybrid-skill-storage.md) | accepted |
| D6 | [Skill versions are pinned per bot (Go-modules style)](D06-skill-versions-are-pinned-per-bot-go-modules-style.md) | accepted |
| D7 | [Model and effort are fixed at bot creation](D07-model-and-effort-are-fixed-at-bot-creation.md) | accepted |
| D8 | [History choice when a bot joins](D08-history-choice-when-a-bot-joins.md) | accepted |
| D9 | [SSE + POST transport with an ordered event log](D09-sse-post-transport-with-an-ordered-event-log.md) | accepted |
| D10 | [Python backend, React frontend, generated API client](D10-python-backend-react-frontend-generated-api-client.md) | superseded by D34 |
| D11 | [One run at a time per conversation](D11-one-run-at-a-time-per-conversation.md) | accepted |
| D12 | [Bots are soft-deleted](D12-bots-are-soft-deleted.md) | accepted |
| D13 | [Editing a message creates a branch](D13-editing-a-message-creates-a-branch.md) | accepted |
| D14 | [Skill authorship and cloning](D14-skill-authorship-and-cloning.md) | accepted |
| D15 | [Skill provenance from server records](D15-skill-provenance-from-server-records.md) | accepted |
| D16 | ["Always load" per pinned skill](D16-always-load-per-pinned-skill.md) | accepted |
| D17 | [New repository; agent instructions in AGENTS.md](D17-new-repository-agent-instructions-in-agents-md.md) | accepted |
| D18 | [Handoff targets and who decides the workflow](D18-handoff-targets-and-who-decides-the-workflow.md) | accepted |
| D19 | [Bot slug fixed at creation](D19-bot-slug-fixed-at-creation.md) | accepted |
| D20 | [Daily spending cap](D20-daily-spending-cap.md) | accepted |
| D21 | [Token and cost tracking](D21-token-and-cost-tracking.md) | accepted |
| D22 | [Use UUIDv7 instead of ULID for ids](D22-use-uuidv7-instead-of-ulid-for-ids.md) | accepted (shown as TypeIDs, D36) |
| D23 | [Bots working on an external project folder](D23-bots-working-on-an-external-project-folder.md) | accepted in principle |
| D24 | [Statistics page](D24-statistics-page.md) | accepted |
| D25 | [One Grafana-style time range picker](D25-one-grafana-style-time-range-picker.md) | accepted |
| D26 | [Flow view beside the chat](D26-flow-view-beside-the-chat.md) | accepted |
| D27 | [Flow rendering is swappable; animations have hard budgets](D27-swappable-flow-renderer-with-animation-budgets.md) | accepted |
| D28 | [TanStack Router and shadcn/ui on Base UI](D28-router-and-component-primitives.md) | accepted |
| D29 | [SQLite now; switch to PostgreSQL on defined triggers](D29-sqlite-now-postgres-on-triggers.md) | accepted |
| D30 | [Switchable themes (Command, Material) and conversation views](D30-themes-and-conversation-views.md) | accepted |
| D31 | [Bots answering the same message see each other's replies](D31-later-bots-see-earlier-replies.md) | accepted |
| D32 | [History budget is a per-bot share of the model's context window](D32-history-budget-from-model-context.md) | accepted |
| D33 | [Zod for runtime validation in the frontend](D33-zod-for-frontend-runtime-validation.md) | accepted |
| D34 | [TypeScript on the backend and the frontend](D34-typescript-full-stack.md) | accepted |
| D35 | [Ports and adapters at the edges, not "switch anything"](D35-ports-and-adapters-at-the-edges.md) | accepted |
| D36 | [Ids are TypeIDs everywhere outside the database](D36-typeid-outside-the-database.md) | accepted |
| D37 | [Projects group conversations](D37-projects-group-conversations.md) | accepted |
| D38 | [Bot memory and project memory](D38-bot-memory-and-project-memory.md) | accepted |
| D39 | [Sensitive-data guard before anything reaches a model or memory](D39-sensitive-data-guard.md) | accepted |
| D40 | [Cost alerts at 75% and 90% of the daily cap](D40-cost-alerts-at-75-and-90.md) | accepted |
