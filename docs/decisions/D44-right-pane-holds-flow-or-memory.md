# D44. The right pane holds Flow or Memory, one at a time

Status: proposed (2026-10-22). The owner agreed to it in the UI design review. It waits for the
owner's acceptance. It amends D26 (Flow view beside the chat) and UI-12. The Flow maps of D30 do
not change.
Decision: The pane on the right of the chat shows the Flow view or the Memory pane. It never shows
both. The Flow button in the chat header opens Flow. This is the only pane button in the chat
header. The Memory row in the left bar opens Memory. When one opens, the other closes. The pane
moves in over `duration-medium`. The animation changes only transform and opacity. The chat gets
narrower one time, at the end of the animation.
Not chosen:
- A third bar for memory. Three columns make the chat too narrow at 1280 px.
- A Memory button in the chat header. Two buttons for one pane cause confusion.
Consequences: The resize and close rules of UI-12 apply to Flow and to Memory. The URL or the view
state records which content is open.
Why: The owner looks at memory next to the chat, as with Flow. The owner rarely needs the two at
the same time. One pane keeps the layout simple.
Implemented in: `../design/components/memory-pane.md`, `../requirements/flow-view.md`, task M5b
(after the owner accepts it).
