# Diagrams

This file lists every diagram of the specification. It holds no diagram itself. Each diagram
sits in the document that owns its facts, so one fact has one place (`README.md`). Where a
diagram leaves out or simplifies a rule, that document's text wins.

All diagrams are Mermaid in Markdown (`workflow.md` §2, human review: visual first), so an agent
can edit them.

## Agreed

| Diagram | Shows | Where |
| --- | --- | --- |
| System context | Owner, browser, the app, the `data/` folder, the file manager, model providers | [architecture.md](architecture.md) §1.1 |
| Inside the process | HTTP, SSE, event hub, run worker, model requests outside runs, timed jobs, startup task; what survives a restart | [architecture.md](architecture.md) §1.2 |
| Component map | Allowed imports between frontend, `app/`, adapters, core and `shared/` (D35) | [architecture.md](architecture.md) §4.1 |
| VPS topology | One possible M9 layout: proxy, authentication, web and worker processes, database, Library storage. Not a commitment | [architecture.md](architecture.md) §10 |
| ERDs by domain | Bots and skills; projects, conversations and messages; runs, usage and events; memory | [domain-model.md](domain-model.md) §1a |

## Planned (pre-coding gate, owner 2026-10-25)

Each one is drawn and agreed before the slice that uses it.

| Diagram | Where it goes |
| --- | --- |
| ERDs for the M6 Library tables, plan tables and search entries (not designed yet) | `domain-model.md` §1a, with the slice's schema design |
| States: runs, approval waits, Stop, retry, failure, recovery; Trash lifecycles | `architecture.md` §6, `conversation-rules.md`, `domain-model.md` |
| Sequences: send to reply, plan approval to Library save, reconnect; with failures and transaction boundaries | `realtime-events.md`, `conversation-rules.md` |
| User flows and screen states, linked to the mockups | `requirements/<area>.md`, `design/components/` |
