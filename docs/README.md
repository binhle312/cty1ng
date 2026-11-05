# Documentation

Use this map to find the workflow and specification sections for the current task.
Requirements and technical or agreed design specifications own product behaviour. Plans, audits,
and lessons record work and evidence; they do not replace those specifications.

## Read for the task

1. Read [AGENTS.md](../AGENTS.md) and the assigned request, brief, or approved plan.
2. Use the map below to choose the relevant workflow and specifications. Open their matching sections ([how](../AGENTS.md#3-read-for-the-task)).
3. Apply the [principle skill](../.agents/skills/README.md) for the current phase when its trigger applies.
4. Include the shared rules that govern the change: conventions, invariants, security controls, and UI standards where applicable.
5. When a decision governs the behaviour, check its amendments in [decisions/README.md](decisions/README.md) before you rely on it.
6. Expand the reading scope when a dependency, conflict, or unanswered question requires it.

A brief's **Read first** list identifies required sources. Use its section references; an explicit **all** requires the whole document.
A task that covers one part needs that part's rules and dependencies. A whole-slice review needs the full slice contract.
A link is a route to context, not an instruction to read every linked file.

## Task map

| Task or question | Start here | Read scope |
| --- | --- | --- |
| Plan, implement, fix a bug, review, or prepare a PR | [Workflows](workflows/README.md) | Choose the workflow for your role and current task |
| Find the next delivery part or its brief | [Development plan](development-plan.md) | The relevant milestone and part; its table links existing briefs |
| Find current progress or owner decisions | [Status](status.md) | Current work and relevant waiting or follow-up rows |
| Find an approved plan | [Plans](plans/README.md) | The named plan and its approval record |
| Understand product scope or terminology | [Product brief](requirements/product-brief.md) | Relevant goals or [glossary](requirements/product-brief.md#glossary) |
| Find a feature's behaviour | [Requirements](requirements/README.md) | The area and acceptance criteria in scope; shared rules when applicable |
| Understand an accepted decision | [Decisions](decisions/README.md) | The matching entry and its "Changed by" entries |
| Find code, module boundaries, or runtime design | [Architecture](architecture.md) | The matching section, then the affected folder's README |
| Change tables, storage, or invariants | [Domain model](domain-model.md) | Conventions, affected entities, and applicable invariants |
| Change routing, bot context, handoffs, or message branches | [Conversation rules](conversation-rules.md) | The affected rule and the state it depends on |
| Change SSE or events | [Realtime events](realtime-events.md) | The transport, event types, client handling, and ordering rules affected |
| Change an HTTP endpoint | [API](api.md) | Conventions, errors, and the relevant endpoint group |
| Build or review a screen | [Design](design/README.md) | The agreed component spec, [UI rules](design/ui-rules.md), and [shared requirements](requirements/README.md#applies-to-every-story); the [design skills rules](workflows/planning.md#design-skills) if you use one |
| Change style or theme tokens | [Themes](design/themes.md) | The relevant theme, tokens, and shared theme rules |
| Change the Flow pane or its renderer | [Flow view](flow-view.md) | The affected scene, cue, renderer, performance, or verification sections |
| Write TypeScript | [Conventions](frontend-conventions.md) | Shared coding rules and relevant frontend or backend guidance |
| Change a trust boundary, file handling, secrets, or untrusted output | [Security](security.md) | Threat model and every control and security test affected by the change |
| Write tests or verify a change | [Testing](testing.md) | Relevant layer and cases; required gates and evidence rules still apply |
| Apply an engineering principle | [Principle skills](../.agents/skills/README.md) | The skill that matches the current phase |
| Trace a previous failure or review | [Lessons](lessons-learned/README.md), [delivery quality](delivery-quality.md), [repository audit](audits/2026-11-05-repo-audit.md) | Only records relevant to the current issue |
| Find an existing diagram | [Diagrams](diagrams.md) | The relevant view and its owning specification |
| Explore future work or research | [Ideas](ideas/README.md), [chat-client research](research/chat-client-patterns.md) | Background only; these do not authorize implementation |

## Keep docs focused

- **One rule, one home.** Put each rule in its owning document. Other documents link to the exact section.
- **Task-specific entry points.** Indexes say when to read a file. Long specifications keep stable headings, so a reader can find one section.
- **No mirror indexes.** Use the existing folder index or delivery table instead of another list of the same files.
- **Move links with content.** Update callers when a document moves. Remove obsolete redirects after all callers use the new location.
- **Change docs with code.** Update the owning specification when behaviour changes. Resolve code/specification conflicts with the owner.
- **Preserve decisions and evidence.** Follow [decision rules](decisions/README.md) for accepted decisions. Keep historical approvals and test evidence.
- **Explain non-obvious rules.** Keep the reason beside the rule. Prefer short tables or examples when they make the rule easier to find.
