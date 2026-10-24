# Themes and views

> **Status: accepted (D30), from the owner's picks in round 2 (concepts 2, 11, 13).** Command
> ships first (M0); Material follows as its own small slice (T2). Canvas page
> "Deep dive: 2 · 11 · 13" shows bot detail, skill hub, statistics, the Board view and the
> Appearance settings in both themes. Visual details remain open until the M0 UI design review.

## 1. Four separate settings

The three picks are not the same kind of thing, so they become separate settings:

| Setting | Values | What it changes | Picked from |
| --- | --- | --- | --- |
| **Theme** | Command, Material | Colours, type, shape, spacing, elevation, motion feel | Concepts 2 and 11 |
| **Mode** | Follow system, light, dark | The colour set within a theme | Requirement "themes follow the OS" |
| **Density** | Theme default, compact | Control heights and row padding | Command is compact by default |
| **Flow pane default** | Closed, or open on Team, Timeline or Board | Whether the conversation opens with the Flow pane, and on which map | Concept 13 |

Every theme ships both a light and a dark mode. Features never depend on the theme: ⌘K, keyboard
shortcuts, the Flow pane and its Board map, charts and approvals work the same everywhere.

## 2. How theming works

```
Base UI primitives ─┐
                    ├─▶ our components (one set) ─▶ read only semantic tokens (CSS variables)
Tailwind utilities ─┘                                        ▲
                                                             │
          <html data-theme="material" data-mode="dark" data-density="default">
                                                             │
          frontend/src/themes/command.css    material.css     (token values per theme × mode)
```

Rules:

1. **One component set.** Components use semantic tokens only (`bg-surface`,
   `text-on-surface`, `rounded-control`), never raw colours, sizes or font names. A lint rule
   rejects hex colours and arbitrary Tailwind values in `frontend/src/components/` and
   `frontend/src/features/`.
2. **A theme is a token file**, nothing else. Adding a theme means adding one CSS file and one
   entry in the theme list.
3. **Allowed exceptions** (structure that differs by theme) live in one place,
   `frontend/src/themes/variants.ts`, and are listed here: Material shows labels under rail
   icons; Command shows keyboard hints in buttons. Anything else needs this document updated.
4. **No second component library.** Material is reproduced with tokens on Base UI, not with MUI.
   We get the Material look, not Google's components (no ripple, no exact M3 motion specs). Two
   libraries would double the bundle, the accessibility behaviour to verify and the tests.
5. **No flash on load.** A small inline script in `index.html` reads the saved theme and mode
   and sets the `data-` attributes before the first paint.
6. **Saved per browser** (localStorage, read with try/catch, falling back to Material + follow
   system). In the VPS phase it moves to the user's settings row.

## 3. Token set

| Group | Tokens | Command (dark) | Material (light) |
| --- | --- | --- | --- |
| Surface | `surface`, `surface-container`, `surface-raised` | #0E0F11, #16181B, #1E2125 | #F8FAF0, #ECEFE4, #FFFFFF |
| Text | `on-surface`, `on-surface-muted` | #E7E8EA, #9BA1AB | #191D17, #43483F |
| Primary | `primary`, `on-primary`, `primary-container` | #F5B544, #0E0F11, #1B170D | #3B6939, #FFFFFF, #BCF0B4 |
| Primary tint | `primary-tint` (selected tile fill, left bar) | #3A2E12 | set in T2 |
| Lines | `outline`, `outline-strong` | #23262B, #3A3F46 | #C3C8BB, #73796E |
| Status | `running`, `waiting`, `danger`, `success` | #7DB8E3, #F5B544, #F2777A, #7FCB8B | #235023, #7A3E14, #B3261E, #2F6B3A |
| Bots | `bot-1` … `bot-10` (avatar fills; the colour row offers 8 of them; text on a bot colour is black or white by contrast, `components/bot-avatar.md` §5) | shared palette | shared palette |
| Type | `font-sans`, `font-mono`, `text-base` | Geist, Geist Mono, 13 px | Roboto Flex, Roboto Mono, 16 px |
| Shape | `radius-control`, `radius-card`, `radius-pill` | 6, 8, 999 px | 20, 28, 999 px |
| Density | `control-height`, `row-padding-y` | 28, 8 px | 40, 12 px |
| Motion | `duration-fast`, `duration-medium`, `easing-standard` | 120, 200 ms, ease-out | 150, 300 ms, emphasised |

Light Command and dark Material values are defined the same way; the Appearance board shows
both. Chart colours come from these tokens, so charts switch with the theme.

## 4. Board view (concept 13)

The Board shows the conversation spatially: threads as frames, runs with their steps, files,
and handoffs as edges. It is built on the Flow view's scene and renderer (`../flow-view.md`,
D26, D27): the same scene data, laid out as a board instead of the Team or Timeline map. So it
adds a layout, not a new architecture. Keyboard: arrows pan, `F` fits, `G B` switches the Flow pane to the Board map.

Decided (D30): the Board is the third tab of the Flow pane (Team, Timeline, Board). There is
one split screen with three maps; no separate Chat + Board layout. Built in slice M8b, after the
pane and its first two maps exist (M8).

## 5. Verification

- **Contrast test:** a unit test reads every token file and checks text and icon pairs against
  WCAG AA (4.5:1 text, 3:1 large text and UI).
- **Visual snapshots:** Playwright screenshots of 8 key screens × 2 themes × 2 modes, reviewed
  in PRs that touch `frontend/src/themes/` or shared components.
- **Accessibility:** axe checks run in every theme and mode.
- **Leak check:** switching theme 50 times leaves no extra listeners or style elements.
