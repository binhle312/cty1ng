# D44. The right pane holds Flow or Memory, one at a time

Status: proposed (2026-10-22). Agreed in the UI design review; waits for the owner's acceptance.
Amends D26 (Flow view beside the chat) and UI-12; D30's Flow maps stand.
Decision: The pane to the right of the chat shows **either** the Flow view **or** the Memory pane,
never both. Flow opens from the chat header (its only pane button); Memory opens from the Memory
row in the left bar. Opening one closes the other. The pane slides in over `duration-medium`,
animating only transform and opacity, and the chat narrows once at the end.
Not chosen: a third bar for memory (three columns leave the chat too narrow at 1280 px), and a
Memory button in the chat header (two pane buttons in the header for one slot).
Consequences: The pane's resize and close behaviour (UI-12) apply to both contents. The URL or
view state records which content is open.
Why: Memory is looked at beside the chat, like Flow, but rarely at the same time; one slot keeps
the layout simple.
Implemented in: `../design/components/memory-pane.md`, `../requirements/flow-view.md`, task M5b
(after acceptance).
