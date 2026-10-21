# Product requirements

This folder is the product requirements document, split by area so agents load only what a
slice needs. What the app must do, written as user stories with testable acceptance criteria. This folder
owns **behaviour**; how a screen looks lives in `../design/` and is not final; how it is built
lives in the technical documents one level up.

## Files

| File | Stories | Acceptance criteria |
| --- | --- | --- |
| [product-brief.md](product-brief.md) | Problem, users, use cases and phases, goals, success measures, non-goals, trust failures, journeys J1–J6, glossary | (none; journeys are tested end to end) |
| [app-shell.md](app-shell.md) | SH-1 to SH-3 | UI-1, UI-2 |
| [conversation.md](conversation.md) | CV-1 to CV-7 | UI-3 |
| [bots.md](bots.md) | BT-1 to BT-5 | UI-4, UI-5, UI-6 |
| [skill-hub.md](skill-hub.md) | SK-1 to SK-4 | UI-7 |
| [settings.md](settings.md) | ST-1 to ST-3 | UI-8, UI-9 |
| [statistics.md](statistics.md) | SA-1 to SA-4 | UI-10 |
| [time-range-picker.md](time-range-picker.md) | TR-1 to TR-2 | UI-11 |
| [flow-view.md](flow-view.md) | FL-1 to FL-4 | UI-12 |
| [projects-and-memory.md](projects-and-memory.md) | PM-1 to PM-4 | UI-13 |

## Ids

- **Story ids** (`CV-3`) name a need. A prefix per file, numbered in order. Never reuse a
  retired id; mark the story "(withdrawn)" instead.
- **Acceptance criteria ids** (`UI-3.4`) are what task briefs, tests and PRs cite. They are
  stable: moving a criterion to another file keeps its id. New criteria take the next free
  number in their group.
- A test that proves a criterion names it in its title, for example
  `test("UI-3.4: mention menu lists only members")`.

## Applies to every story

These hold on every screen, so stories do not repeat them:

- Every list or detail view has **empty, loading, error and success** states.
- **Loading uses skeletons**: grey placeholder shapes in the layout of the real content (rows,
  avatars, chart boxes), not a centred spinner, so the page does not jump when data arrives.
  They appear only if loading takes longer than 200 ms (no flash on fast loads), are marked
  `aria-busy`, and do not shimmer when the OS asks for reduced motion. Streaming bot replies are
  not "loading" and keep their typing/working states (UI-3.4).
- Every hover tooltip also appears on keyboard focus.
- Every drag-and-drop action has a keyboard or button alternative.
- Every screen works in every theme and in both light and dark mode; mode follows the OS by
  default (theme system: `../design/themes.md`, D30).
- Components use semantic design tokens only, never raw colours, sizes or font names.
- Components come from shadcn/ui (Base UI underneath, D28) for tooltips, dialogs, menus and toasts.

## Writing a story

```markdown
- **XX-n.** As the owner, I want <capability>, so that <outcome>.
  Acceptance criteria: UI-a.b to UI-a.c.
```

Criteria are yes/no checks on behaviour ("the menu lists only members"), not on looks ("the
menu is blue"). Visual details belong to the design agreed in the slice plan, not here. A
criterion that refers to a layout links a sketch in `../design/` and must still pass whatever
the final layout is.
