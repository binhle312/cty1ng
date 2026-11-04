# Development plan

The order in which the app is built, and why. Progress lives in [status.md](status.md), not here;
this file changes only when the plan changes.

Split milestones into reviewable parts where needed. Each part preserves a usable, tested
app and merges before the next starts (except the parallel cases in `workflow.md` §5).
Write a brief for each implementation part before code starts; hand it to the builder agent with the prompt in
`workflow.md` §3.

| Slice | Brief | Delivers | Checkpoint | Depends on |
| --- | --- | --- | --- | --- |
| M0 | [M0-skeleton.md](tasks/M0-skeleton.md) | Repo, tooling, CI, app shell, security middleware, event log + SSE skeleton, in three parts: M0a tooling and CI, M0b backend core, M0c frontend shell | **plan** + merge | — |
| M1 | [M1-skill-hub.md](tasks/M1-skill-hub.md) | Skills: versions, authorship, clone, deprecate, import/export, in two parts: M1a backend, M1b Skills page | **plan** (schema) | M0 |
| M1c | [M1c-backend-maintenance.md](tasks/M1c-backend-maintenance.md) | Backend maintenance: daily event pruning (30 days by default) and a guard against a second SQLite writer in one process. No UI | **plan** (short) | M1b; before M2 |
| M2 | [M2-bots.md](tasks/M2-bots.md) | Model catalog, bots CRUD, clone, avatars, pins, header bar, in three parts: M2a backend, M2b Bots page, header and Create, M2c bot page and Skills page cards | **plan** (schema, uploads) | M1, M1c |
| M3 | [M3-chat-one-bot.md](tasks/M3-chat-one-bot.md) | Chat with one bot, in seven parts: M3a–M3g ([breakdown below](#m3-delivery-parts)) | **plan** per part (schema, events, worker, UI) | M2 |
| M4 | [M4-multi-bot.md](tasks/M4-multi-bot.md) | Multi-bot routing, membership and branches, in [four parts](#m4-multi-bot-conversations) | **plan** per part (routing, branches, UI) | M3 |
| M5 | [M5-bot-discussion.md](tasks/M5-bot-discussion.md) | Discussion, caps and Settings, in [five parts](#m5-discussion-caps-and-settings) | **plan** per part (claim rules, shared state, UI) | M4 |
| M5b | [M5b-projects-and-memory.md](tasks/M5b-projects-and-memory.md) | Projects, memory, Trash and Move to project without files, in [nine parts](#m5b-projects-memory-and-trash) | **plan** per part (schema, memory isolation, UI) | M5; shared plan approvals before action tools |
| M5c | not written | Owner-requested skill drafts and explicit assignment, in [three parts](#m5c-skill-drafts) | **plan** per part (schema, tools, UI) | M3 and shared plan approvals |
| M5d | not written | Skill improvement, blind probes and saved test cases, in [five parts](#m5d-skill-improvement) | **plan** per part (schema, UI, cost) | M5, M5c and shared plan approvals; M5d-3 also needs M5b-2 and M6-1 |
| M6 | [M6-workspace-parity.md](tasks/M6-workspace-parity.md) | Libraries, file tools, attachments, copies and handoffs, in [ten parts](#m6-libraries-files-and-handoffs) | **plan** per part (security, recovery, UI) | M5b and shared plan approvals |
| Inbox | not written | Project inbox (D58, D59; `requirements/project-inbox.md`): states, waits, notices, Send to conversation. No model calls | **plan** (schema, UI design) | M6 (needs D48 cards and D52 notices) |
| M7 | [M7-statistics.md](tasks/M7-statistics.md) | Statistics API, shared time range picker and Statistics page, in [three parts](#m7-statistics) | **plan** per part (metrics, shared state, UI, dependency) | M5; integrates with M3 bot Usage |
| M8 | [M8-flow-view.md](tasks/M8-flow-view.md) | Flow state, Timeline and motion, in [three parts](#m8-flow-timeline) | **plan** per part (renderer contract, UI, performance) | M7; full integration also needs M6 handoff data |
| M8b | not written | Board: second map in the Flow pane (D30 amendment), [size review after design](#m8b-and-m8c-board-slices) | **plan** (UI design) | M8 |
| M8c | not written | Read-only project Board, [two provisional parts](#m8b-and-m8c-board-slices); same project data as the inbox | **plan** (schema/API, UI design) | M8b; project, Library and handoff data |
| T2 | not written | Material theme: one token file plus the documented structural differences (D30) | merge (UI design, visual snapshots) | M0; any time, owner decides |
| M9 | not written | VPS: auth, Docker, TLS, backups | separate milestone | M8 |
| later | not written | Scheduled bots and web access (Researcher, Reminder; then Trip planner); web through provider web tools only (D53) | separate milestone | after phase 1 |
| later | not written | External project folders (D23: documents first, write-capable design) | separate milestone | M9 or earlier, owner decides |
| later | not written | Desktop app (Windows, Linux) and coding agents from the app (idea only: [ideas/desktop-app-and-cli-agents.md](ideas/desktop-app-and-cli-agents.md)) | separate milestone | M9 and external project folders (D23) |

"Checkpoint: plan" means the builder stops after writing the plan and waits for the owner's
approval (`workflow.md` §2). Every slice also needs the owner's review of migrations and
`Needs human review` items before merge.

Every slice with a screen (M0–M5d, M6, Inbox, M7, M8, M8b, M8c, T2) also has a **UI design checkpoint**:
the plan proposes the actual UI and the owner approves it before UI code is written. Sketches
and mockups in `docs/design/` are starting points for that discussion, never specs.

## M3 delivery parts

M3 follows M2c. Keep M3 as the milestone and deliver M3a–M3g as separate PRs in the order below.
The [M3 brief](tasks/M3-chat-one-bot.md) follows this breakdown. The milestone scope and acceptance criteria still apply.
Write the part briefs before implementation. This table defines the delivery boundaries;
each part still needs its implementation plan.

| Part | Delivers | Main verification | Depends on |
| --- | --- | --- | --- |
| M3a — Storage and queue | Conversation, message and run persistence, including `run_attempts`; repositories, queue claims, leases and database lock metric | Concurrent claims have one winner; stale attempts cannot write; state changes and events commit together | M2 |
| M3b — Bot execution | Prompt and pinned skills, model adapters, tools through the workspace port, message APIs, streaming, Stop, retry, sensitive-data checks and usage recording | Fake-model API journey; tool faults; Stop against finish; crash/restart with no duplicate reply; request costs equal run totals | M3a |
| M3c — Auto titles | One-time title requests, cost reservations, manual-title precedence and startup recovery | Concurrent sends make one title request; manual rename wins; cap checks and restart rules hold | M3b |
| M3d — Conversation screen | Rail and conversation-list scrolling, add bot, composer, virtualised messages, provenance, usage tooltip, queued reactions, Stop, unread state, drafts and reopen/reconnect | Fake-model Playwright journey; state-table and event-order tests; disconnect recovery; Markdown security tests | M3c |
| M3e — First-run setup | Get started checklist, setup APIs, example loading and the Guide offer after its design review | Fresh setup works; repeated actions create no duplicates; the checklist follows server state | M3d |
| M3f — Bot Activity and Usage | Conversation links, usage queries and the M3 portion of the bot Usage tab, with its scope resolved before implementation | Figures match stored requests; title costs stay outside bot totals; unknown prices stay visible | M3e |
| M3g — Reply feedback | Ratings, notes, endpoints and events, with the feedback controls and their request states | Only eligible replies accept feedback; replacement and deletion work; secret checks apply; message content stays unchanged | M3f |

Each part has a **plan** checkpoint, its own acceptance tests and a recovery approach.
Schema, API, security, dependency and UI approvals still follow `workflow.md` §2 and §7.
Each intermediate merge must preserve the existing app; part plans must define when new APIs
and worker execution become available together. Capture usage from the first model call in M3b.
Keep Stop, retries and recovery with execution; M3d adds their UI.

### Specification work before M3a

Prepare one docs-only PR before implementation:

- Create one brief per part and map every M3 acceptance criterion to a part and its tests.
- Include `run_attempts` and its invariants from `domain-model.md` §7 and §12 in the storage and worker scope.
- Obtain approval for the D46 schema design before implementation; the decision itself is accepted.
- Resolve the M3/M7 boundary for the bot Usage tab (`design/components/bot-page.md` §9.6).
  Approve any required data design before the part that first stores that data.
- Resolve the first-run Guide design and its relation to the Get started checklist and example loading.
- Assign the auto-title tests that use mentions or pending-history members, whose user flows arrive in M4.
- Map the M3 follow-ups in `status.md` to part briefs, including the database lock metric in M3a
  and conversation-list scrolling in M3d.

Feedback stays in M3g in this plan. A move to M4 changes the milestone scope.
Record that scope change in both briefs and this plan before M3 is complete.
Downstream dependencies on M3 mean the complete milestone, not only the first usable conversation screen.

## M4–M8 delivery rules

These parts separate independent risks and screens. Use numbered suffixes (`M5-1`, `M5b-1`)
to avoid a clash with the existing M5b–M5d and M8b–M8c milestone names.
The tables give delivery boundaries and dependencies, not approval to implement unresolved designs.
Each part gets its own brief, plan, acceptance tests and recovery approach before code starts.
M5 and M7 now have plan checkpoints because their parts change shared state and interfaces.

Before each milestone, reconcile its umbrella brief with the owning requirements and amended decisions
in a docs-only PR. Assign every criterion, invariant and follow-up to a part; no requirement
disappears because the milestone has more PRs. Keep migrations, APIs and their events together
where a split would break an invariant. Backend parts must pass API or contract tests without
their future UI. Do not expose an action that needs an approval card before that card exists.
Each new screen or request-owning card flow gets its state table and order tests.

The listed dependencies are prerequisites, not permission for parallel work on shared schemas.
Follow `workflow.md` §5 for parallel work. A dependency on a milestone means all its required
parts; a dependency on a named part means only that part and its prerequisites.
Final integration criteria belong to the last consuming part, while each earlier part proves
its own behaviour at merge. Security, recovery and performance checks start with the code they protect.

### Shared plan approvals

D48 assigns the plan card to the first consumer: M5b, M5c or M6.
Keep that rule: the first consumer delivers these two prerequisite PRs, and later consumers reuse them.
`Plans-1` and `Plans-2` below are shared work labels, not new product milestones.

| Part | Delivers | Main verification | Depends on |
| --- | --- | --- | --- |
| Plans-1 — Approval and progress backend | Plan versions, decisions, phase-specific tools, action-run admission, outcomes and notes for D51, and D57 progress records | Planning tools cannot write; only the latest approved plan starts its action run; duplicate decisions have one winner; progress replays exactly | M3; the first consumer's approved schema and tool contracts |
| Plans-2 — Plan and progress card | Approve, Request changes, Reject, conflict questions, progress, and reload/reconnect states | Rejection starts no action; a normal message supersedes the pending plan correctly; late answers cannot approve an old version | Plans-1 |

The first consumer's spec pass must resolve the D57/D54 boundary before these plans are ready.
D57 needs progress and Done-when evidence; D54 puts file checks in M6.
Specify the supported evidence for the first consumer without granting it M6 file tools early.
Record approval outcomes from the first plan, so M5d has signals to read.

### M4: Multi-bot conversations

Split membership and routing from message branches; each has different state and race conditions.

| Part | Delivers | Main verification | Depends on |
| --- | --- | --- | --- |
| M4-1 — Membership and routing backend | History choices, member lifecycle, mention validation, sequential multi-bot replies, and the invariant 24 purge-policy schema test | Every human-routing row; from-here history isolation; later bots see earlier replies; concurrent sends chain; policy coverage detects missing columns | M3 |
| M4-2 — Members and mentions UI | Drag and keyboard add, history card, member picker and removal, mention composer, queued reactions, derived icons, deleted bots and Rename | Keyboard and pointer journeys; pending/removed members; stale card decisions; one reaction per queued bot | M4-1 |
| M4-3 — Branch backend | Message edit endpoint, sibling branches, active-path queries and prompt history | Active runs block edits; old branches stay intact; prompts contain only the active path; purge-policy coverage includes new fields | M4-1 |
| M4-4 — Branch UI | Edit flow, sibling navigation and conversation state across branch changes | J6; late loads and stream events cannot replace the selected branch; full M4 journey checks | M4-2, M4-3 |

Delete, Move and Memory remain in M5b. The spec pass must distinguish M4 tests from M5-only
turn-budget cases that the current M4 brief also lists.

### M5: Discussion, caps and Settings

The brief includes several Settings pages as well as discussion. Separate enforcement from its controls.

| Part | Delivers | Main verification | Depends on |
| --- | --- | --- | --- |
| M5-1 — Discussion backend | Bot-trigger routing, inherited limits, counters, prompt numbers, notices and runs-per-hour admission | Exact turn limit; off/limit changes during discussion; concurrent admissions; one limit notice | M4 |
| M5-2 — Spending enforcement | Total and provider caps at claim, shared cap rule, unknown-price handling and threshold alerts | Running request may finish over cap; next claim is refused; reservations count; alerts fire once per threshold per cap | M5-1, M3c |
| M5-3 — Shared Settings UI | Settings navigation and shared setting-row flow for Profile, Bot discussion, Limits, New bots, Models and Appearance; later rows remain hidden | Row name/effect/note contract; save/error/conflict states; appearance persistence and page slides | M5-2 |
| M5-4 — Spending page | Total and provider cap controls, spend display and alert states | Raising a cap permits later runs; failed or stale saves preserve the owner's input; unknown costs remain explicit | M5-3 |
| M5-5 — Conversation controls and budget | Discussion popover, user-panel battery and collapsed budget header | Custom/Enter/Esc/outside-click cases; keyboard and touch battery actions; J2 with exact bot-turn count | M5-4 |

The Settings code design must identify one owner for the shared row-save flow.
If a page needs a separate request state machine, give that page its own PR within M5-3.
Activate bot-trigger execution only when M5-2 also enforces its claim-time caps.
Keep the M3 title tests and M5 cap tests aligned with the D42 unknown-price rule.

### M5b: Projects, memory and Trash

This milestone needs separate storage, memory execution, lifecycle and UI reviews.
Trash must be usable before the new screens expose deletion.

| Part | Delivers | Main verification | Depends on |
| --- | --- | --- | --- |
| M5b-1 — Project and memory storage | Project and memory schemas, CRUD services, scope rules, versions, limits, settings, seen state and purge-policy entries | Scope isolation; secret refusal; version limits; GET has no side effects; exact schema-policy coverage | M5 |
| M5b-2 — Lifecycle and move backend | Project/conversation/memory Trash, batch restore, permanent delete, purge, and atomic Home-to-project move without files | Restore places first; `place_in_trash`; purge boundary and idempotence; a racing run refuses the whole move | M5b-1 |
| M5b-3 — Memory runtime and upkeep | Prompt precedence, memory tools and approval checks, duplicate rules, Tidy/check requests, reservations and usage | No memory or tools when off; cross-scope isolation; plan restrictions; stale instructions; concurrent title/upkeep reservations; secret and size checks | M5b-2, Plans-1, Plans-2 |
| M5b-4 — Trash page | Shared Trash list, multi-select, restore dialogs, permanent-delete Undo, count and links; removal of the temporary skill/bot Trash CLI | Delete/restore journeys for every supported kind; parent in Trash; expired Undo; late batch results | M5b-2 |
| M5b-5 — Memory proposal cards | Tidy selection and Apply, memory-check results, conflict decisions and failure/retry states | Only selected unchanged items apply; changed instructions refuse an old decision; invalid proposed text stays unsavable | M5b-3 |
| M5b-6 — Memory surfaces | Memory page, pane and bot tab, history, search, seen tags, switches, Remember and Undo lines | Edit/delete/restore journey; seen survives restart; navigation during saves; memory tools become available with their feedback UI | M5b-4, M5b-5 |
| M5b-7 — New project and navigation | New project page, project rail groups, pin/reorder, list scrolling and project-scoped conversation creation | Create and reload; keyboard/touch reorder; concurrent pin answers; Home/project separation | M5b-6 |
| M5b-8 — Project settings | Goal, instructions, colour, memory settings, instruction-check flow and delete check card | Instruction save against an old check; failed saves retain edits; deletion reaches Trash; restore keeps the project intact | M5b-7 |
| M5b-9 — Conversation actions | Memory menu entry, Delete dialog and Move dialog with selected memory; no file step yet | Atomic move with ticked/unticked memory; a run starts after dialog open; full M5b journey checks | M5b-8 |

Keep the D56 failure-card integration with M6, as its decision specifies; memory approval checks
and saved-item records must already hold when memory tools become available.
D58 cross-conversation reading remains outside M5b. Its next-slice brief and its boundary with
Send to conversation and the later Inbox still need to be written; do not absorb them into M5b.

### M5c: Skill drafts

No umbrella brief exists yet. Write it from UI-7.9–7.15 and D41 as amended by D48, D64 and D65.
The following split keeps M5c's dependency on M3; it does not add an M4 dependency.

| Part | Delivers | Main verification | Depends on |
| --- | --- | --- | --- |
| M5c-1 — Draft backend | Draft storage, `read_skill_base`, `propose_skill`, decisions, slug conflicts, stale detection and events | Owner request and plan required; latest base must have been read; no skill or pin before approval; approval pins nothing | M3, Plans-1, Plans-2 |
| M5c-2 — Conversation draft card | Preview, diff, Reject/Approve, stale state, redraft link and existing assign/upgrade float-card integration | Double/late decisions; stale base; slug collision; only explicit assignment changes pins | M5c-1 |
| M5c-3 — Draft editor and links | Edit on the Skills page, approve-and-return, draft attribution and pending-draft links on bot/skill pages | Navigation during approval; stale draft in editor; complete draft/edit/approve/assign journey | M5c-2 |

### M5d: Skill improvement

No umbrella brief or final UI design exists yet. D51 includes a paid probe and saved test cases;
these need their own scope and cost review. The probe is optional for the owner to run, but is
a required milestone capability.

| Part | Delivers | Main verification | Depends on |
| --- | --- | --- | --- |
| M5d-1 — Improve backend | Signal selection/counts, used-signal records, Improve run, 1:1 destination, draft evidence and settings | Neutral notes never count as bad; only selected signals enter the run; approval consumes the correct signals; guards and caps apply | M5, M5c, Plans-1, Plans-2, reply feedback |
| M5d-2 — Improve entry and draft UI | Offer/menu, signal dialog, cost estimate, waiting link and draft evidence | Threshold boundaries; old/new signal selection; navigation to the correct 1:1 draft; no automatic adoption | M5d-1 |
| M5d-3 — Probe and test-case backend | Paired read-only runs, cost reservations, blind assignment/picks, saved task copies, limits and purge rules | No writes; no cap overspend; saved cases precede signal tasks; deleted places and copied task retention follow D51 | M5d-1, M5b-2, M6-1 |
| M5d-4 — Blind probe UI | Task/count selection, estimate, A/B comparison, reveal and separate scores for saved cases and signal tasks | Labels stay hidden until reveal; picks never become signals; late results cannot change another task | M5d-2, M5d-3 |
| M5d-5 — Saved test-case UI | Save as test case, skill-page list, Remove with Undo and the test-case limit setting | Limit races; source conversation purge preserves the copy; project/skill purge removes it; full Improve/probe journey | M5d-4 |

The spec pass must confirm the probe prerequisites in the milestone dependency table.
D51 requires the current Library of the task's place and project Trash behaviour, which the
old M5d dependency summary did not name. Do not replace them with temporary replay semantics.

### M6: Libraries, files and handoffs

The current brief omits parts of the accepted Library design. Complete it before implementation,
then separate the security boundary, durable save lifecycle and each approval flow.

| Part | Delivers | Main verification | Depends on |
| --- | --- | --- | --- |
| M6-1 — Workspace adapter and reads | Full workspace port, project/Home isolation, safe path resolution, git operations, `openFolder`, Library read API and safe file-serving headers | Workspace contract and path-escape suite; one place cannot access another; file-serving security tests | M5b |
| M6-2 — Run branches and save backend | Per-attempt worktrees, file claims, save queue, approved file operations, D54 run-end checks, D59 notice data and crash-safe discard/purge | Save/discard has one winner; recovery after each DB/disk boundary; retries keep separate branches; deletion/restore preserves saved Library files | M6-1, Plans-1, Plans-2 |
| M6-3 — Library page | Files, History, Unsaved changes, file viewer with safe headers and Open folder | Safe rendering; folder isolation; reload and list failure states; history matches saved commits | M6-2 |
| M6-4 — Run file cards | Overlap, save and unsaved-change cards, out-of-plan operation decisions, plan-check display, D56 memory Undo and D59 memory-change notice | No unapproved destructive save; failed/stopped run recovery; late decisions; action tools activate with the required cards | M6-3 |
| M6-5 — Attachment backend | Upload checks, text secret guard, multimodal prompt input and binary stripping from history | Upload/security corpus; an old image is not resent on a later turn; failed upload stores no unsafe file | M6-1 |
| M6-6 — Attachment UI | Composer attachment flow and the sensitive-data warning | Upload/send/retry/remove order tests; safe preview; file-attachment journey | M6-4, M6-5 |
| M6-7 — Copy and move backend | Pinned-version copies, copy proposals/limits, copy records and the file step of Home-to-project move | Destination changes only after approval; pinned commit copied; move refuses queued/running runs, saves or unsaved changes at commit | M6-2, M5b-9 |
| M6-8 — Copy and move UI | Copy to, Add from Home Library, copy cards, New tags and Move file selection | Source changes after dialog open; destination name collisions; late approvals; move with selected files and memory | M6-6, M6-7 |
| M6-9 — Handoff backend | Handoff tool, decisions, stale checks, target/member handling and rolling limit | No run before approval; one decision winner; stale files; unavailable target; all statuses count toward the limit | M6-2, Plans-1, Plans-2 |
| M6-10 — Handoff cards | Approve/reject, Add bot and start, stale states and links | J3; simultaneous decisions; target changes while card waits; full M6 integration and security suite | M6-8, M6-9 |

It must assign D52/D54/D57/D59 schemas, events and recovery cases to the parts above.
Typed handoff briefs and forked handoffs remain open choices in the current M6 brief; resolve them
before the handoff plan. Read-only helpers, automatic approval and a second-model judge stay outside M6.

### M7: Statistics

The time range picker is a shared stateful control with date math, a calendar, URL state and refresh.
Review it separately from metric queries and the page that uses it.

| Part | Delivers | Main verification | Depends on |
| --- | --- | --- | --- |
| M7-1 — Statistics backend | Indexes, metric rules, stats repository/API, CSV export and `make seed-usage` with synthetic data | Hand-computed metrics; unknown prices; historical deleted/deprecated entities; timezone buckets; query timings | M5 |
| M7-2 — Shared time range picker | Date math, calendar, range shifts, clipboard, timezone, URL/back-forward state and refresh; integration with bot Usage | DST/month ends; invalid input; storage failures; hidden-tab/absolute-range refresh pause; URL restoration | M7-1, M3f |
| M7-3 — Statistics page | Charts/tables, empty/error states, period/metric controls, export and header/battery navigation | Seeded Playwright journey; export; stale response after range change; UI-10.9 measurements | M7-2 |

Approve the chart dependency after a CSP and accessibility probe. Resolve the open bot Usage
data and Group by requirements before M7-2; do not invent metric definitions in the UI.

### M8: Flow Timeline

Separate the bounded state model and renderer contract from the Timeline and its motion.
Performance tests begin with the renderer, not in a later cleanup PR.

| Part | Delivers | Main verification | Depends on |
| --- | --- | --- | --- |
| M8-1 — Flow state and contract | Scene, bounded store, selectors, cue rules, renderer registry and conformance/performance harness | Replay produces no cues; only active-path data appears; retry stays one item with several tries; test-only second renderer uses the same contract | M7; M3–M6 event contracts |
| M8-2 — Pane and Timeline | Persisted split/swap/close, Timeline renderer, virtualisation, accessible list and conversation links | Storage failure; branch/conversation switches; keyboard navigation; open-time, DOM and unmount budgets | M8-1 |
| M8-3 — Motion and integration | Timeline animations, Animations switch, reduced motion, hidden-pane/tab cue handling and dev overlay | 50 open/close cycles and 5,000 cues; no replay burst; no animations with reduced motion; all performance budgets; discussion/handoff journey | M8-2, M6 |

The plan chooses the Timeline library after a probe; it does not assume the parked Team-map library.
Follow D30's amendment: Timeline first, Board second.
The Team map remains parked.

### M8b and M8c: Board slices

M8b has no brief and its design is parked. Keep it as a separate milestone; there is not enough
defined scope to justify a fixed PR count yet. After the design, assess scene/layout work separately
from renderer interactions, and reuse M8's conformance and performance tests.

M8c already has a useful backend/UI boundary in `design/components/left-bar.md` §5:

| Part | Delivers | Main verification | Depends on |
| --- | --- | --- | --- |
| M8c-1 — Project Board data | Project snapshot endpoint from stored tables and project-scoped live updates | Snapshot still works after event pruning; no cross-project data; reconnect reconciles to stored state | M8b; project, Library and handoff schemas |
| M8c-2 — Project Board UI | Read-only project Board with conversation frames, live states, shared files and waiting handoffs | Project switches discard old updates; navigation reaches the correct conversation; accessible interactions and renderer budgets | M8c-1 |

These two parts are provisional until the M8c brief and UI design define its full acceptance criteria.
Keep the later Inbox as its own milestone; reuse its underlying project data without folding its
unwritten workflows into the Board.

## Brief format

Briefs live in [tasks/](tasks/). Every brief has the same sections so agents know where to look:

- **Goal**: one paragraph.
- **Read first**: the documents (and sections) the builder must read.
- **In scope / Out of scope**.
- **Deliverables**: files, endpoints, pages.
- **Acceptance criteria**: references to `UI-x.y` ids in `requirements/`, `conversation-rules.md` sections,
  invariants, plus slice-specific checks.
- **Tests**: what must exist by the end.
- **Needs human review**: known items.
- **Open questions**: must be empty before building starts.
