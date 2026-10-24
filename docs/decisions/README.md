# Decisions

One file per design decision. Each says what was decided, why, and what was rejected, so
nobody has to rediscover the reasoning. This index is the list of record.

**Rules**

- Status is one of `proposed`, `accepted`, `superseded by Dnn`.
- Accepted decisions change through a new entry that amends or supersedes them. The new entry
  has a metadata line under its status: `Amends: D38, D43` or `Supersedes: D10`. Ids are two
  digits, in number order, separated by ", ". The line lists only decisions; other documents go
  in the status text.
- An `Amends:` line that names a superseded decision is history only. The amending decision
  still stands on its own; for the rest of the old rule, read the decision that supersedes it.
  Example: D28 and D29 amend D10, which D34 supersedes. D28 (router) and D29 (SQLite) are
  current; the stack is D34.
- The old entry is not rewritten. Edit it only to set its status or to add a dated amendment
  that the owner approved ("Amended 2026-10-23 (owner): ..."), for a small change that needs no
  new entry.
- The index column "Changed by" lists every entry whose `Amends:` or `Supersedes:` line names
  this decision, and the dated amendments. Read those entries before you use a decision: the
  newest entry wins where they differ.
- `pnpm check:index` checks the metadata lines against the index (M0). It cannot check that two
  decisions agree in meaning; the reviewer checks that (`../workflow.md` §4).
- Agents may add `proposed` entries. Only the owner moves an entry to `accepted`.
- Each entry links to the document that implements it.
- One decision per file, named `Dnn-short-title.md`. Take the next free number; never reuse one.
- Add a row to the index below in the same PR as the new file.
- Paths in "Implemented in" are relative to this folder.

Template:

```
# Dnn. Title
Status: proposed | accepted (YYYY-MM-DD) | superseded by Dmm
Amends: Dnn, Dnn          (optional; or "Supersedes: Dnn")
Decision: one or two sentences.
Why: the reasoning.
Rejected: alternatives and why not.
Consequences: what this makes harder or easier.
Implemented in: links.
```

## Index

| Id | Decision | Status | Changed by |
| --- | --- | --- | --- |
| D1 | [Single human, no login, localhost only](D01-single-human-no-login-localhost-only.md) | accepted |  |
| D2 | [No lead bot](D02-no-lead-bot.md) | accepted |  |
| D3 | [Reply rule](D03-reply-rule.md) | accepted |  |
| D4 | [Bot-to-bot discussion with a server-enforced turn budget](D04-bot-to-bot-turn-budget.md) | accepted |  |
| D5 | [Hybrid skill storage](D05-hybrid-skill-storage.md) | accepted |  |
| D6 | [Skill versions are pinned per bot (Go-modules style)](D06-skill-versions-are-pinned-per-bot-go-modules-style.md) | accepted |  |
| D7 | [Model and effort are fixed at bot creation](D07-model-and-effort-are-fixed-at-bot-creation.md) | accepted |  |
| D8 | [History choice when a bot joins](D08-history-choice-when-a-bot-joins.md) | accepted |  |
| D9 | [SSE + POST transport with an ordered event log](D09-sse-post-transport-with-an-ordered-event-log.md) | accepted |  |
| D10 | [Python backend, React frontend, generated API client](D10-python-backend-react-frontend-generated-api-client.md) | superseded by D34 | D28, D29, D34 |
| D11 | [One run at a time per conversation](D11-one-run-at-a-time-per-conversation.md) | accepted |  |
| D12 | [Bots are soft-deleted](D12-bots-are-soft-deleted.md) | accepted | D50 |
| D13 | [Editing a message creates a branch](D13-editing-a-message-creates-a-branch.md) | accepted |  |
| D14 | [Skill authorship and cloning](D14-skill-authorship-and-cloning.md) | accepted |  |
| D15 | [Skill provenance from server records](D15-skill-provenance-from-server-records.md) | accepted |  |
| D16 | ["Always load" per pinned skill](D16-always-load-per-pinned-skill.md) | accepted |  |
| D17 | [New repository; agent instructions in AGENTS.md](D17-new-repository-agent-instructions-in-agents-md.md) | accepted |  |
| D18 | [Handoff targets and who decides the workflow](D18-handoff-targets-and-who-decides-the-workflow.md) | accepted |  |
| D19 | [Bot slug fixed at creation](D19-bot-slug-fixed-at-creation.md) | accepted |  |
| D20 | [Daily spending cap](D20-daily-spending-cap.md) | accepted | D40, D42 |
| D21 | [Token and cost tracking](D21-token-and-cost-tracking.md) | accepted |  |
| D22 | [Use UUIDv7 instead of ULID for ids](D22-use-uuidv7-instead-of-ulid-for-ids.md) | accepted (shown as TypeIDs, D36) |  |
| D23 | [Bots working on an external project folder](D23-bots-working-on-an-external-project-folder.md) | accepted in principle | D52 |
| D24 | [Statistics page](D24-statistics-page.md) | accepted |  |
| D25 | [One Grafana-style time range picker](D25-one-grafana-style-time-range-picker.md) | accepted |  |
| D26 | [Flow view beside the chat](D26-flow-view-beside-the-chat.md) | accepted | D44 |
| D27 | [Flow rendering is swappable; animations have hard budgets](D27-swappable-flow-renderer-with-animation-budgets.md) | accepted |  |
| D28 | [TanStack Router and shadcn/ui on Base UI](D28-router-and-component-primitives.md) | accepted |  |
| D29 | [SQLite now; switch to PostgreSQL on defined triggers](D29-sqlite-now-postgres-on-triggers.md) | accepted |  |
| D30 | [Switchable themes (Command, Material) and conversation views](D30-themes-and-conversation-views.md) | accepted |  |
| D31 | [Bots answering the same message see each other's replies](D31-later-bots-see-earlier-replies.md) | accepted |  |
| D32 | [History budget is a per-bot share of the model's context window](D32-history-budget-from-model-context.md) | accepted |  |
| D33 | [Zod for runtime validation in the frontend](D33-zod-for-frontend-runtime-validation.md) | accepted |  |
| D34 | [TypeScript on the backend and the frontend](D34-typescript-full-stack.md) | accepted |  |
| D35 | [Ports and adapters at the edges, not "switch anything"](D35-ports-and-adapters-at-the-edges.md) | accepted |  |
| D36 | [Ids are TypeIDs everywhere outside the database](D36-typeid-outside-the-database.md) | accepted |  |
| D37 | [Projects group conversations](D37-projects-group-conversations.md) | accepted | D45, D47, D52 |
| D38 | [Bot, project and conversation memory](D38-bot-memory-and-project-memory.md) | accepted | D43, D48, D53; D56 (proposed) |
| D39 | [Sensitive-data guard before anything reaches a model or memory](D39-sensitive-data-guard.md) | accepted |  |
| D40 | [Cost alerts at 75% and 90% of the daily cap](D40-cost-alerts-at-75-and-90.md) | accepted |  |
| D41 | [Bots draft skills; the owner approves and is the author](D41-bots-draft-skills-the-owner-approves.md) | accepted | D48; own amendment 2026-10-23 |
| D42 | [Optional daily caps per provider, under the total cap](D42-per-provider-daily-caps.md) | accepted |  |
| D43 | [Project memory beats bot memory; the bot asks about a conflict before it acts](D43-project-memory-beats-bot-memory.md) | accepted | D47, D48 |
| D44 | [The side pane holds Flow or Memory, one at a time](D44-right-pane-holds-flow-or-memory.md) | accepted |  |
| D45 | [Every run reads the project's goal and instructions](D45-project-goal-and-instructions.md) | accepted |  |
| D46 | [The app writes a short title from the first message, one time only](D46-auto-title-from-the-first-message.md) | accepted |  |
| D47 | [Delete sends the whole project to Trash; the owner picks what wins in a memory check](D47-delete-project-to-trash-and-memory-check-choices.md) | accepted | D49 |
| D48 | [Bots plan first and wait for approval before they change anything](D48-bots-plan-before-they-change-anything.md) | accepted | D56 (proposed) |
| D49 | [Deleted skills go to Trash, Trash keeps items for a set number of days, and only a permanent delete has Undo](D49-skills-go-to-trash-and-trash-days-setting.md) | accepted |  |
| D50 | [Deleted bots go to Trash and can be restored](D50-deleted-bots-go-to-trash.md) | accepted |  |
| D51 | [Bots improve their skills from the owner's feedback, and the owner approves each change](D51-bots-improve-their-skills-from-owner-feedback.md) | accepted | own amendments 2026-10-23, 2026-10-24 |
| D52 | [Each run writes on its own branch and saves to the Library when it ends](D52-each-run-writes-on-its-own-branch.md) | accepted |  |
| D53 | [Bots read the web only through the provider's web tools, with rules for runs that read it](D53-web-access-through-provider-web-tools.md) | accepted | D55 |
| D55 | [Provider tools first, one switch per tool, and one tool per job](D55-provider-tools-first-and-tool-switches.md) | accepted |  |
| D56 | [Memory in action runs: items not in the plan, and runs that fail](D56-memory-in-action-runs-and-failed-runs.md) | proposed | |
