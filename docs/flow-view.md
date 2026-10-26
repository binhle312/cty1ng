# Flow view

This document owns the Flow view: the second pane of the conversation page that shows how
bots communicate and work. It covers what it shows, how it is built so the drawing can be
replaced (for example by pixel-art characters), and the animation, performance and memory rules
it must meet. Decisions: D26, D27. Stories and acceptance criteria: `requirements/flow-view.md`. Task: `tasks/M8-flow-view.md`.

## 1. What it is for

| Map | Question it answers | Phase |
| --- | --- | --- |
| **Timeline** | How did the work happen, step by step, and what did each run cost? | M8 |
| **Board** | The conversation as a spatial board (D30, `design/themes.md` §4) | M8b |
| **Team** | Who talks to whom, who is working, who is waiting on whom, right now? | parked (D26 amendment 2026-10-25) |
| **Files** | Where did this document come from, and who used it? | later |

The Team map is parked until bots work together without the owner (one orchestrator bot with
helper bots). Today the owner starts and approves all work, so the Timeline shows it better.
When the Team map returns, it is designed again as a tree with the orchestrator at the top. The
scene types below keep its fields so that it can come back without a contract change; M8 does
not build them.

Timeline look (agreed with the owner, 2026-10-25): `design/components/flow-timeline.md`. Older mockups: `design/mockups.md`, illustrative only. This document fixes behaviour and architecture, not visual style.

The Flow view is **read-only** in M8. It is a second view of the same event log as the chat
(`realtime-events.md`), so it can never disagree with the chat. A later milestone may let the
owner draw explicit workflows here (the alternative recorded in D18); nothing in M8 may make
that harder (see §3: the scene is data, not drawing code).

## 2. Split screen

Sketch only (not final; see `design/README.md`):

```
┌─────────────────────────────┬┬──────────────────────────────┐
│ Conversation                ││ Flow · Timeline  Animations ⇄ ✕│
│                             ││                              │
│                             ││                              │
└─────────────────────────────┴┴──────────────────────────────┘
                              ↑ draggable divider (double-click resets to 50/50)
```

- Exactly two panes: chat and Flow. No arbitrary splitting.
- Divider drag with min widths (chat 360 px, Flow 320 px); keyboard resizable (arrow keys on the
  focused divider); double-click resets.
- ⇄ swaps sides; ✕ closes Flow; a "Flow" button in the conversation header opens it.
- Pane state (open, side, width, active map) is a per-browser convenience in `localStorage`,
  wrapped in try/catch; the page works without it.
- Below 960 px wide, the panes become tabs (Conversation | Flow).
- Library: `react-resizable-panels` (what shadcn/ui's "Resizable" wraps).

## 3. Architecture: data, scene, cues, renderer

The core rule: **knowing what happened** and **drawing it** are separate layers. Everything
above the renderer is plain data and pure functions; the renderer only draws. Replacing the
diagram with pixel characters means writing a new renderer, nothing else.

```
SSE events ──▶ flowStore (bounded, normalised)
                   │
                   ├──▶ selectors (pure) ──▶ FlowScene      "what is true now"   ──┐
                   │                                                              ├──▶ Renderer
                   └──▶ cue builder (pure) ──▶ FlowCue stream "what just happened" ┘    (diagram today,
                                                                                         pixel later)
Renderer ──▶ onSelect(target) ──▶ chat pane (filter / scroll)
```

### 3.1 The scene (state)

```ts
// frontend/src/features/flow/model.ts — renderer-neutral, serialisable, no React types
type ActorId = string;               // owner id or bot id

interface FlowScene {
  map: "timeline" | "board" | "team" | "files"; // M8: timeline; board in M8b; team parked; files later
  actors: Actor[];                   // you + bots in the conversation
  links: Link[];                     // team map only (parked): aggregated relationships; empty in M8
  items: TimelineItem[];             // timeline map: ordered, windowed (§5)
  window: { fromSeq: number; toSeq: number; hasEarlier: boolean };
  selection: SelectionTarget | null;
}

interface Actor {
  id: ActorId; kind: "human" | "bot"; name: string; avatarUrl: string | null;
  status: "idle" | "queued" | "running" | "waiting_for_owner" | "removed" | "deleted";
  runs: number; costUsd: number | null;
  lastStep?: { kind: StepKind; target: string; at: string };   // while running: the last FINISHED step (run.step comes after a tool call ends)
}

interface Link {
  id: string; from: ActorId; to: ActorId;
  mentions: number; handoffs: { approved: number; pending: number; rejected: number };
  lastAt: string;
}

// Every item has `at` (UTC ISO time of the event that created it) for the time column, and `seq`
// (the event order) for sorting and windowing.
type TimelineItem =
  | { kind: "message"; id: string; seq: number; at: string; from: ActorId; to: ActorId[]; text: string; botTurn?: [number, number] }
  | { kind: "run"; id: string; seq: number; at: string;            // at = the run's first start (runs.started_at)
      finishedAt: string | null; actor: ActorId; status: RunStatus; costUsd: number | null;
      durationMs: number | null;                                   // all tries together
      tries: { startedAt: string }[];                              // one per run_slots row; length > 1 = retried (UI-3.7)
      steps: RunStep[] }                                           // all tries, in call order (seq_in_run)
  | { kind: "handoff"; id: string; seq: number; at: string; decidedAt: string | null; from: ActorId; to: ActorId | "human"; status: HandoffStatus; files: string[] }
  | { kind: "notice"; id: string; seq: number; at: string; text: string };

// The same list as run_steps.kind in domain-model.md §3.8. A test asserts the two lists match.
type StepKind =
  | "load_skill" | "list_files" | "read_file" | "view_file" | "write_file" | "propose_handoff"
  | "remember" | "update_memory" | "forget" | "restore_memory"   // D38
  | "propose_skill"                                              // D41
  | "mark_step"                                                  // D57
  | "unknown_tool";
interface RunStep { kind: StepKind; target: string; status: "ok" | "error"; startedAt: string; finishedAt: string }
```

A Retry (UI-3.7) queues the same run again, so the Timeline keeps one run item and adds a try;
it never adds a second run item. There is no event for a tool call that has started, so the scene
knows only finished steps; the open run box shows them and "Working · last step … ago"
(`design/components/flow-timeline.md` §4).

Built by pure selectors: `buildTimelineScene(store, window)` in M8 (`buildTeamScene(store)` when the Team map returns). They
are memoised and use structural sharing: an unchanged actor or link keeps the same object, so a
renderer can skip it cheaply.

### 3.2 Cues (what just happened)

Animations are driven by **semantic cues**, never by diffing the DOM:

```ts
type FlowCue =
  | { type: "message.sent"; from: ActorId; to: ActorId[]; messageId: string }
  | { type: "run.queued" | "run.started" | "run.finished" | "run.failed" | "run.stopped"; actor: ActorId; runId: string }
  | { type: "run.step"; actor: ActorId; runId: string; step: RunStep }
  | { type: "handoff.proposed" | "handoff.approved" | "handoff.rejected"; from: ActorId; to: ActorId | "human"; handoffId: string }
  | { type: "member.joined" | "member.left"; actor: ActorId }
  | { type: "budget.exhausted"; used: number; limit: number };
```

The cue builder maps live SSE events to cues. **Replayed events (on reconnect) produce no
cues**: they update the scene silently, so a reconnect never triggers an animation storm.

Why cues: a diagram renderer turns `handoff.approved` into a green flash on an edge; a pixel
renderer turns the same cue into the BA character walking to the Designer's desk with a
document. Both need the same meaning, not the same drawing.

### 3.3 The renderer contract

```ts
// frontend/src/features/flow/renderer.ts
interface FlowRendererProps {
  scene: FlowScene;
  cues: CueSource;                         // subscribe(fn) → unsubscribe; renderer pulls at its own pace
  motion: "full" | "reduced";              // from prefers-reduced-motion and a user setting
  onSelect(target: SelectionTarget): void; // actor, link, timeline item
}
type FlowRenderer = React.ComponentType<FlowRendererProps>;

const renderers: Record<string, FlowRenderer> = {
  diagram: DiagramRenderer,                // M8: the Timeline; library chosen in the M8 plan, HTML/SVG preferred (D27 amendment 2026-10-26)
  // pixel: PixelRenderer,                 // later: e.g. PixiJS sprites, same props
};
```

Rules for every renderer:

1. Reads only its props. Never calls the API, never reads the store, never decides status.
2. Owns its animation clock and resources and releases all of them on unmount.
3. Provides an accessible alternative: a visually hidden but screen-reader-visible list of
   actors and timeline items with the same selection behaviour.
4. Passes the **renderer conformance test** (§6) before it can be merged.

A renderer choice is a setting (Settings → Appearance → Flow style) only once a second
renderer exists.

## 4. Animations (diagram renderer)

All durations and easings live in one file, `frontend/src/features/flow/motion.ts`, so the feel can be
tuned in one place.

The Team column is kept for when the Team map returns (parked, not built in M8).

The owner turns animations on or off with the **Animations** switch in the pane header
(`requirements/flow-view.md` UI-12.7). It sets `motion`: On = `"full"`, Off = `"reduced"`.

| Cue | Team map (parked) | Timeline map | Duration |
| --- | --- | --- | --- |
| `message.sent` | a dot travels along the link from sender to receiver, then fades; link weight updates | new row slides in from below | 600 ms / 150 ms |
| `run.queued` | small "queued" badge appears | — | 150 ms |
| `run.started` | running ring appears with a slow breathing pulse | run box appears, open, with a slow breathing outline in the bot colour | 200 ms, pulse 2 s loop |
| `run.step` | last-step label on the node cross-fades | finished step line appended in the run box | 150 ms |
| `run.finished` | ring fades out | box closes, cost appears | 300 ms |
| `run.failed` / `run.stopped` | node shakes once (2 px) / ring turns grey | box turns red / grey | 300 ms |
| `handoff.proposed` | link turns dashed amber with a slow dash flow while pending | dashed amber arrow, pulse on its badge while it waits for the owner | flow 1.5 s loop |
| `handoff.approved` | link flashes green once, flow stops | badge turns green | 400 ms |
| `member.joined` / `left` | node scales/fades in or out; layout eases to new positions | lane appears or greys out | 250 ms / 300 ms |
| `budget.exhausted` | brief amber outline around the map | notice row | 400 ms |

With `motion: "reduced"` there is no movement: state changes apply instantly (colours and
badges still change).

## 5. Performance and memory rules

These are requirements, not tips. The owner's machine runs the app, the bots' streaming and
the browser at the same time.

**Rendering**

1. Animate only `transform` and `opacity` (composited by the GPU, no layout or paint). The one
   exception is the dash flow on pending handoff links (`stroke-dashoffset`, which repaints): at
   most 8 links animate it at once; beyond that they are dashed but still.
2. No per-frame React state updates. Animations run through CSS keyframes or the Web
   Animations API on element refs, or (in a canvas renderer) one shared `requestAnimationFrame`
   / ticker loop. Never one timer per node; never `setInterval` for animation.
3. At most 20 animations run at once. Extra cues are **coalesced**: five messages on the same
   link within one second play as one dot with a "×5" label.
4. The cue queue is bounded (200). When the Flow pane is closed, collapsed below its minimum, or
   the browser tab is hidden (`visibilitychange`), cues are dropped, not queued; on return the
   renderer shows the current scene without catching up.
5. *(Team map, parked; not in M8.)* Layout (positions of actors in the Team map) is computed only when the set of actors or
   links changes, not on every message, debounced by 200 ms, in a Web Worker (elkjs or dagre)
   so the main thread stays free. Positions animate to their new place.
6. Timeline rows, run chips and run boxes are memoised components with stable ids; the row list
   is rebuilt only from changed scene parts (structural sharing from §3.1).
7. Long timelines are windowed: 50 items in the DOM, "load earlier" pages 50 more, and a
   virtualised list keeps the DOM size flat however far the owner scrolls.

**Memory**

8. The flow store is bounded: the Team map keeps counters, not lists of messages; the Timeline
   keeps the window plus one page on each side; older pages are evicted.
9. Every subscription, observer (`IntersectionObserver`, `ResizeObserver`), animation, timer,
   worker and texture has a disposer, and the component's effect cleanup calls them all.
   Closing the pane or switching conversation unmounts the renderer.
10. No closures capturing whole stores in long-lived callbacks; handlers read the latest value
    through refs.

**Budgets (checked in CI, §6)**

| Metric | Budget |
| --- | --- |
| Frame time while animating (12 actors, 200 timeline items, 5 cues/s) | p95 ≤ 16.7 ms (60 fps) on the CI machine; logged with a 2× allowance in CI |
| Opening the Flow pane on a 1,000-message conversation | ≤ 300 ms to first paint |
| JS heap after opening/closing the pane 50 times and replaying 5,000 cues, after GC | within +5 MB of the baseline |
| DOM nodes after scrolling the whole timeline | ≤ 2× the count at first paint |
| Event listeners and timers after unmount | back to the baseline count (zero leaked) |

## 6. Verification

- **Selectors and cue builder:** unit tests with fixtures (Vitest). Replayed events produce no
  cues; coalescing works; windowing is correct on branches (only the active path).
- **Renderer conformance test** (`frontend/src/features/flow/conformance.test.ts`), run
  against every registered renderer:
  1. mount with a fixture scene; the accessible list contains every actor and item;
  2. feed 1,000 scene updates and 5,000 cues;
  3. unmount;
  4. assert, through Chrome DevTools Protocol metrics in Playwright (`JSEventListeners`,
     `Nodes`, `JSHeapUsedSize` after forced GC) and a patched timer registry, that nothing
     leaked;
  5. with `motion: "reduced"`, assert no running animations (`document.getAnimations()` empty).
- **Performance test** (Playwright with tracing): the frame-time and open-time budgets in §5,
  results attached to the PR.
- **Dev overlay:** a dev-only toggle shows FPS, heap size, running animations and queued cues,
  so regressions are visible while building.

## 7. Swapping in a pixel renderer later (guidance, not M8 scope)

What a `PixelRenderer` would add, without touching anything above the renderer:

- a canvas/WebGL engine with one ticker (PixiJS is the usual candidate), texture atlases per
  character, and `destroy({ texture: true })` on unmount;
- a placement function from `FlowScene.actors` to desks or rooms;
- a cue → animation script table (`message.sent` → speech bubble; `run.step write_file` →
  typing; `handoff.approved` → walk and hand over a paper);
- sprite assets per bot: uploaded through the same pipeline as avatars (PNG only, re-encoded,
  stored by hash; `security.md` §2.4), or generated from the avatar.

It must pass the same conformance test and budgets.
