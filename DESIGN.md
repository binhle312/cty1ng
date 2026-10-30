---
name: cty1ng
description: Design reference for the Command theme
colors:
  surface: "#0E0F11"
  surface-container: "#16181B"
  surface-raised: "#1E2125"
  surface-bubble: "#262A30"
  on-surface: "#E7E8EA"
  on-surface-muted: "#9BA1AB"
  primary: "#F5B544"
  on-primary: "#0E0F11"
  primary-container: "#1B170D"
  primary-tint: "#3A2E12"
  outline: "#23262B"
  outline-strong: "#3A3F46"
  running: "#7DB8E3"
  waiting: "#F5B544"
  danger: "#F2777A"
  success: "#7FCB8B"
typography:
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "13px"
  mono:
    fontFamily: "Geist Mono, monospace"
rounded:
  control: "6px"
  card: "8px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.card}"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.card}"
    height: "36px"
---

# Design system: cty1ng

## Overview

**Creative North Star: "Collaborative studio"**

The interface is warm and approachable. It gives the owner and role bots a clear place to work
together, with familiar controls and visible bot identities. Keep the conversation easy to read
through long work sessions.

This file is a snapshot for Impeccable. The owning [theme specification](docs/design/themes.md),
[UI rules](docs/design/ui-rules.md), and [component specifications](docs/design/components/README.md)
are authoritative. If this snapshot differs, follow those documents and update this file.
The token values above describe Command dark; they are not values for every theme or mode.

**Key Characteristics:**

- Compact controls and a clear reading area.
- Distinct bot avatars and visible work states.
- Semantic colours, with labels or icons for status.

## Colors

Command dark uses layered neutral surfaces, light text, and amber for the primary role. Status
colours distinguish running, waiting, danger, and success. Follow the agreed status meanings in
[UI rules](docs/design/ui-rules.md) and the theme and mode values in
[themes](docs/design/themes.md).

## Typography

Command uses Geist for interface text and Geist Mono for technical labels. The Command base text
size is 13 px. Follow the legibility rules in [UI rules](docs/design/ui-rules.md).

## Layout

The shell keeps the project rail and project contents on the left, the bot roster at the top,
and the current page in the main area. The user panel sits at the bottom of the left bar. Follow
the [left bar](docs/design/components/left-bar.md), [top header](docs/design/components/top-header.md),
and [user panel](docs/design/components/user-panel.md) for their states and interactions.

## Elevation & Depth

Use surface levels and outlines to separate areas. The floating user panel has a shadow, as
specified in [user panel](docs/design/components/user-panel.md).

## Shapes

Use the theme's control, card, and pill radii. Bot and owner avatars are round. Use the agreed
[bot avatar](docs/design/components/bot-avatar.md) and [button](docs/design/components/buttons.md)
specifications for details.

## Components

Use the agreed components indexed in [component specifications](docs/design/components/README.md).
Use semantic theme tokens rather than raw values in application components. Keep keyboard focus
visible and give pointer and touch users a way to complete each action.

## Do's and Don'ts

### Do:

- **Do** use the agreed component specifications and UI rules.
- **Do** make bot authorship and work states clear.
- **Do** use the word "conversation" in the interface.

### Don't:

- **Don't** rely on colour alone to communicate a state.
- **Don't** treat an illustration as an approved component specification.
