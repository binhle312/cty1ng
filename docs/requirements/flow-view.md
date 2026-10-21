# Flow view

A pane beside the chat showing how bots communicate and work. Technical design: `../flow-view.md`.

The Board (`../design/themes.md` §4) is the third map in this pane, after Team and Timeline
(D30). It is built in slice M8b; its stories are written with that brief.

## Stories

- **FL-1.** As the owner, I want a Flow pane beside the chat that I can resize, swap and close, so that I can watch the work without losing the conversation.  
  Acceptance criteria: UI-12.1 to UI-12.3.
- **FL-2.** As the owner, I want a Team map of who talks to whom and who is working or waiting, so that I see the state of the team at a glance.  
  Acceptance criteria: UI-12.4.
- **FL-3.** As the owner, I want a Timeline of messages, handoffs and run steps, so that I understand how a result was produced and what it cost.  
  Acceptance criteria: UI-12.5.
- **FL-4.** As the owner, I want clicks in the Flow to take me to the chat and back, smoothly animated and accessible, so that the two views feel like one.  
  Acceptance criteria: UI-12.6 to UI-12.9.

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Flow view (D26, D27) (UI-12)

Behaviour, architecture, animation and performance rules: `../flow-view.md`.

- UI-12.1: A "Flow" button in the conversation header opens the Flow pane beside the chat.
  The pane has tabs Team and Timeline, a ⇄ swap-sides button and a ✕ close button.
- UI-12.2: The divider drags with min widths (chat 360 px, Flow 320 px), is keyboard resizable,
  and double-click resets to 50/50. Open state, side, width and active tab persist per browser.
- UI-12.3: Below 960 px the page shows Chat and Flow as tabs.
- UI-12.4: **Team map**: one card per participant (you and the bots), links between them weighted
  by mentions, handoff state (approved, pending) shown in a way that does not rely on colour
  alone, live status (queued, running, waiting for owner), runs and cost per bot. Mockup
  "Team" illustrates this; it is not the final look.
- UI-12.5: **Timeline map**: one lifeline per participant, times on the left, message and
  handoff arrows between lifelines, run boxes on the bot's lifeline listing steps, duration,
  cost and bot turn n/limit. Shows the active branch only. 50 items, "load earlier" for more.
  Mockup "Timeline" illustrates this; it is not the final look.
- UI-12.6: Clicking a bot card filters the chat to that bot's messages (a removable filter chip
  appears in the chat). Clicking a message, run step or handoff scrolls the chat to it and
  highlights it. Scrolling the chat highlights the matching item in the Timeline.
- UI-12.7: Animations per `../flow-view.md` §4; none when the OS asks for reduced motion.
- UI-12.8: Performance and memory budgets per `../flow-view.md` §5.
- UI-12.9: An accessible list alternative of actors and timeline items is available to screen
  readers and keyboard users, with the same selection behaviour.
