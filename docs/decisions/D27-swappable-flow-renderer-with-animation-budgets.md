# D27. Flow rendering is swappable; animations have hard budgets

Status: accepted (2026-10-21). Amended 2026-10-26 (owner): the M8 renderer draws only the Timeline
(D26 amendment 2026-10-25). Its library is chosen in the M8 plan; plain HTML and SVG are preferred,
because the Timeline is lanes and rows. React Flow was named for the graph layout of the Team map,
which is parked. The layers, the contract and the budgets do not change.
Decision: Flow is built in layers: a bounded store, pure selectors producing a renderer-neutral
`FlowScene`, a pure cue builder producing semantic `FlowCue`s ("BA handed stories.md to
Designer"), and a renderer that only draws. The M8 renderer is a diagram (React Flow, CSS / Web
Animations API). A later renderer (for example pixel-art characters on PixiJS) plugs into the
same contract. Animations are required, and must meet the performance and memory budgets in
`../flow-view.md` §5, enforced by a renderer conformance test and a performance test in CI.
Why: The owner wants animated cards and arrows without lag or leaks on a machine that is also
running the app, and wants to be able to replace the look (pixel characters) without rewriting
the logic.
Rejected: Drawing logic mixed with state (a new look would mean a rewrite); animating via React
state per frame (re-render storms); a canvas engine from day one (harder accessibility and
testing for the first renderer).
Implemented in: `../flow-view.md` §3–6.
