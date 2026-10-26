# D26. Flow view beside the chat

Status: accepted (2026-10-21). Amended 2026-10-25 (owner): M8 ships only the **Timeline** map.
The **Team** map is parked until bots work together without the owner, with one orchestrator bot
and helper bots (after M6). Until then, the owner starts and approves all work, so a map of who
works with whom adds little that the Timeline does not show. When the Team map returns, it is
designed again as a tree with the orchestrator at the top. The Board stays the next map (M8b,
D30). The Timeline look is in `../design/components/flow-timeline.md`.
Decision: The conversation page can open a second pane, "Flow", beside the chat with a
draggable divider, side swap and close (exactly two panes; tabs on narrow screens). Flow shows
the **Team** and **Timeline** maps in M8; **Files** comes later. It is read-only and updates live
from the event stream. To feed the Timeline, every bot tool call is recorded as a run step
(`run_steps`, event `run.step`), from M3 on.
Why: The chat is linear; the owner needs to see who is working, who waits on whom, and how a
run unfolded. Recording steps is free (no tokens) and also improves debugging.
Rejected: Arbitrary Obsidian-style pane splitting (large feature, little gain); an editable
workflow designer now (kept possible for later, see D18).
Implemented in: `../flow-view.md`, `../requirements/flow-view.md`, `../design/mockups.md`, `../design/components/flow-timeline.md`, `../tasks/M8-flow-view.md`.
