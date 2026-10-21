# M8: Flow view

Checkpoint: **plan** (renderer contract, libraries, performance test setup).

## Goal

The conversation page can show a Flow pane beside the chat with animated Team and Timeline
maps that update live, stay smooth, leak no memory, and are built so the drawing layer can be
replaced later (for example by pixel-art characters) without touching the logic.

## Read first

`docs/flow-view.md` (all); `docs/decisions/` D18, D26, D27; `docs/requirements/flow-view.md`, `docs/requirements/conversation.md` (UI-3.5);
`docs/realtime-events.md` §2–4; `docs/domain-model.md` §3.8; `docs/conversation-rules.md` §6
(branches); `docs/design/mockups.md` (illustrative, not final).

## In scope

- Split pane with `react-resizable-panels` (UI-12.1 to 12.3).
- `frontend/src/features/flow/`: `model.ts` (scene and cue types), `store.ts` (bounded), `selectors.ts`,
  `cues.ts` (cue builder with coalescing; replayed events produce no cues), `motion.ts`
  (durations and easings), `renderer.ts` (contract and registry), `diagram/` (the React Flow
  renderer), `layout.worker.ts` (elkjs or dagre in a Web Worker), `a11y/` (accessible list).
- Team and Timeline maps (UI-12.4, 12.5) with the animations in `flow-view.md` §4.
- Chat ↔ Flow linking (UI-12.6).
- Renderer conformance test and performance test (`flow-view.md` §6) in CI.
- Dev-only overlay: FPS, heap, running animations, queued cues.

## Out of scope

Files map; editing workflows; a second renderer; any backend change except what is missing for
the Timeline (run steps exist since M3; if anything is missing, list it in the plan).

## Acceptance criteria

- UI-12.1 to UI-12.9.
- Every budget in `flow-view.md` §5 met; measurements attached to the PR.
- Conformance test passes for the diagram renderer: no leaked listeners, timers, DOM nodes or
  heap after 50 open/close cycles and 5,000 cues.
- Reconnecting the stream after 2 minutes offline updates the maps with no burst of animations.
- With reduced motion, `document.getAnimations()` is empty while cues arrive.
- A toy second renderer (a plain list, in tests only) renders the same scene through the
  registry, proving the contract is renderer-neutral.

## Tests

Selector and cue-builder unit tests; conformance and performance Playwright specs; Vitest for
the split pane persistence (including `localStorage` throwing); e2e: open Flow during a
two-bot discussion, see the running ring move between bots, click a run step and land on the
message.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

The renderer contract (`renderer.ts`, `model.ts`): it is the long-lived interface; chart and
graph dependencies (React Flow, elkjs or dagre, react-resizable-panels).

## Open questions

- D30 (proposed): whether the Board view joins this pane as a third map (Team, Timeline,
  Board) or is a separate Chat + Board view. Recommendation: one pane, three maps.
