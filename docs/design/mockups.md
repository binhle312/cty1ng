# Mockups

> **Illustrative only.** These mockups were drawn to explore ideas before implementation. They
> are not final designs; colours, shapes, wording and layout will be decided with the owner in
> the slice plan (`README.md` §How a design becomes final).

## Flow view (D26)

Canvas "Flow view mockups": https://claude.ai/artifact/RWUH7vwXrbKaj6turpq8hk (private to the
owner). Agents cannot open it; when a slice needs it, the owner exports screenshots into
`assets/` (`flow-team-v1.png`, `flow-timeline-v1.png`, `flow-files-v1.png`).

| Board | Illustrates | Requirement |
| --- | --- | --- |
| Team | Participants as cards, links weighted by mentions, handoff state (approved, waiting for you), running ring | `../requirements/flow-view.md` FL-2, UI-12.4 (parked, D26 amendment 2026-10-25) |
| Timeline | Lifelines per participant, messages and handoffs as arrows, runs expanded into steps with time and cost | FL-3, UI-12.5. Superseded by the agreed spec `components/flow-timeline.md` |
| Files | Who attached, read and wrote each workspace file, including in-progress writes | Not in scope yet (Files map is a later milestone) |

What the mockups are meant to settle: **which information** each map shows. What they are not
meant to settle: visual style. The renderer is swappable (`../flow-view.md`), so a pixel-art
look later must not need new requirements.
