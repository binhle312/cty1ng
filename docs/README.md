# Documentation

This folder is the specification of the app. Agents and humans build from it; the code must
match it. When they disagree, the disagreement is a bug in one of them and must be raised.

## Reading order

New to the project (human or agent), read in this order:

1. [requirements/product-brief.md](requirements/product-brief.md): what we are building, for whom, and the words
   we use (glossary).
2. [decisions/](decisions/README.md): the decisions already made and why. Saves you from
   re-arguing them.
3. [architecture.md](architecture.md): the moving parts and the rules between them.
4. The document for the area you are working on (table below).
5. [Principle skills](../.agents/skills/README.md): select the skill for the current phase of work.
6. [workflow.md](workflow.md): how this project applies them during planning, building, review, and merge.

## Map

| Document | Answers |
| --- | --- |
| [status.md](status.md) | Where we are: current step, next steps, what waits on the owner, what is done |
| [requirements/product-brief.md](requirements/product-brief.md) | Product brief: problem, users, goals, success measures, non-goals, journeys, glossary |
| [requirements/](requirements/README.md) | Product requirements: user stories and acceptance criteria per area |
| [decisions/](decisions/README.md) | One file per design decision: its reason and what was rejected; index in the README |
| [architecture.md](architecture.md) | Components, ports and adapters, repository layout and import rules, folder indexes, request flow |
| [diagrams.md](diagrams.md) | Index of every diagram: what it shows and which document holds it |
| [domain-model.md](domain-model.md) | Tables, invariants, skills and versions, model catalog, files on disk |
| [conversation-rules.md](conversation-rules.md) | Who replies, bot-to-bot budget, joining, what a bot sees, handoffs, branches |
| [realtime-events.md](realtime-events.md) | Event log, SSE stream, event types and payloads, reconnect |
| [api.md](api.md) | HTTP endpoints, request and response shapes, errors |
| [research/](research/) | Notes from studying other products (behaviour only, no copied code). Inputs, not spec |
| [ideas/](ideas/README.md) | Future ideas the owner wants to keep. Not decisions, not spec; nobody builds from them |
| [design/](design/README.md) | Agreed UI specs, shared standards and exploratory sketches; the design index identifies their status |
| [flow-view.md](flow-view.md) | Flow pane: scene and cue model, swappable renderer, animation, performance and memory budgets |
| [frontend-conventions.md](frontend-conventions.md) | TypeScript rules across packages, frontend state rules and lint enforcement |
| [security.md](security.md) | Threat model and the controls that must exist |
| [testing.md](testing.md) | Test layers, fake model, what each slice must prove |
| [workflow.md](workflow.md) | Using Claude Code and Codex together, branches, reviews, human checkpoints |
| [review-guide.md](review-guide.md) | Local code and PR reviews: requirement-to-code-to-test evidence, separate safety and compliance conclusions, follow-up checks |
| [Principle skills](../.agents/skills/README.md) | Select a principle skill, and the rules to maintain them |
| [lessons-learned/](lessons-learned/README.md) | Project incidents, causes, responses, and their mapping to reusable principles |
| [delivery-quality.md](delivery-quality.md) | Quality by milestone and PR: issue counts, review rounds, evidence limits, and prevention actions |
| [development-plan.md](development-plan.md) | Slices M0–M9 in order, dependencies, checkpoints |
| [tasks/](tasks/) | Existing milestone and part briefs; `development-plan.md` defines delivery parts and the briefs still needed |
| [plans/](plans/README.md) | The plan of each slice: a record of what the owner and the builder agreed before the build. Not spec |
| [audits/](audits/2026-11-05-repo-audit.md) | Repository audits: findings, owner decisions and fix progress. A record, not spec |

## Rules for keeping docs healthy

- **One fact, one place.** Each fact lives in exactly one document; others link to it. If you
  find a fact in two places, keep the one in the owning document (table above) and replace the
  other with a link.
- **Change docs with code.** A PR that changes behaviour updates the owning document in the
  same PR.
- **Decisions change by rule.** A new entry amends or supersedes an accepted decision, or the
  owner approves a dated amendment (`decisions/README.md`). Do not rewrite an accepted decision.
- **Explain why.** A rule without its reason gets deleted by the next person who finds it
  inconvenient. Every non-obvious rule says why it exists.
- **Prefer tables and examples** over long prose. Agents and humans both scan.
