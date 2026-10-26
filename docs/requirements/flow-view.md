# Flow view

A pane beside the conversation showing how bots communicate and work. Technical design: `../flow-view.md`.

M8 ships one map, the **Timeline** (D26, amended 2026-10-25). The **Board**
(`../design/themes.md` §4, D30) is the next map. It is built in slice M8b; its stories are
written with that brief. The **Team** map is parked until bots work together without the owner
(one orchestrator bot with helper bots). FL-2 and UI-12.4 stay here for that time; they are not
in M8.

## Stories

- **FL-1.** As the owner, I want a Flow pane beside the conversation that I can resize, swap and close, so that I can watch the work without losing the conversation.  
  Acceptance criteria: UI-12.1 to UI-12.3.
- **FL-2.** *(Parked, not in M8; D26 amendment 2026-10-25.)* As the owner, I want a Team map of who talks to whom and who is working or waiting, so that I see the state of the team at a glance.  
  Acceptance criteria: UI-12.4.
- **FL-3.** As the owner, I want a Timeline of messages, handoffs and run steps, so that I understand how a result was produced and what it cost.  
  Acceptance criteria: UI-12.5.
- **FL-4.** As the owner, I want clicks in the Flow to take me to the conversation and back, smoothly animated and accessible, so that the two views feel like one.  
  Acceptance criteria: UI-12.6 to UI-12.9.

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Flow view (D26, D27) (UI-12)

Behaviour, architecture, animation and performance rules: `../flow-view.md`.

- UI-12.1: A "Flow" button in the conversation header opens the Flow pane beside the conversation.
  The pane header shows the map name, the Animations switch (UI-12.7), a ⇄ swap-sides button
  and a ✕ close button. With one map (M8) the header reads "Flow · Timeline" and has no tabs. A
  tab strip appears only when there are two or more maps (Timeline and Board, from M8b).
- UI-12.2: The divider drags with min widths (conversation 360 px, Flow 320 px), is keyboard resizable,
  and double-click resets to 50/50. Open state, side, width and active tab persist per browser.
- UI-12.3: Below 960 px the page shows Conversation and Flow as tabs.
- UI-12.4: *(Parked, not in M8.)* **Team map**: one card per participant (you and the bots), links between them weighted
  by mentions, handoff state (approved, pending) shown in a way that does not rely on colour
  alone, live status (queued, running, waiting for owner), runs and cost per bot. Mockup
  "Team" illustrates this; it is not the final look.
- UI-12.5: **Timeline map** (`../design/components/flow-timeline.md`): one lifeline per
  participant, with the avatar, name and live status badge at the top; times (24-hour clock) on
  the left; message and handoff arrows between lifelines; a run chip on the bot's lifeline for
  each finished run (steps, duration, cost and bot turn n of limit); a red chip for a failed run;
  a grey "Queued" pill. A click on a run chip opens its run card: each finished step with its
  time, and for a retried run each try and the owner's Retry, with a footer of tries, time and
  cost. The running run's card is open and adds a finished step live. One run stays one chip and
  one card after a Retry (UI-3.7). A
  rejected handoff is a dashed grey arrow; a handoff that waits for the owner is a dashed amber
  arrow. Shows the active branch only. 50 items, "Load earlier" for more.
- UI-12.6: Clicking a lifeline head (a bot's avatar at the top of the Timeline) filters the conversation to that bot's messages (a removable filter chip
  appears in the conversation). Clicking a message, run step or handoff scrolls the conversation to it and
  highlights it. Scrolling the conversation highlights the matching item in the Timeline.
- UI-12.7: Animations per `../flow-view.md` §4. An **Animations** switch in the pane header
  turns them on or off, default On. It is the same value as Settings → Appearance → "Always
  reduce motion" (UI-8.5), shown the other way round: On = reduce motion off. Off changes only
  the movement: the map shows the same state, badges, colours and steps. When the OS asks for
  reduced motion, the switch shows Off and is disabled, with the tooltip "Your system asks for
  reduced motion".
- UI-12.8: Performance and memory budgets per `../flow-view.md` §5.
- UI-12.9: An accessible list alternative of actors and timeline items is available to screen
  readers and keyboard users, with the same selection behaviour.
