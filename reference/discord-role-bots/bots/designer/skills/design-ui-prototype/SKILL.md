---
name: design-ui-prototype
description: Produce screen designs from approved stories, as HTML prototypes (default) or a Markdown screen spec.
---

# Design screens from stories

1. Read docs/stories.md and memory/designer.md. Confirm the output format the owner chose;
   if it is not recorded, ask (default: HTML prototypes).
2. List the screens the stories imply, and map each story to a screen. Write this map to
   design/README.md first.
3. For each screen:

   **HTML prototype** (design/<screen-name>.html):
   - One self-contained file: inline CSS, no external scripts or fonts, no build step.
   - Use semantic HTML and a simple CSS grid or flexbox layout that works at 375px and 1280px.
   - Show every state side by side or behind simple tabs: default, empty, loading, error.
   - Use realistic sample content, never "Lorem ipsum".
   - Add an HTML comment at the top naming the stories this screen covers (for example S1, S3).

   **Markdown spec** (design/<screen-name>.md):
   - Purpose, layout from top to bottom, components with their content, each state, and
     interactions (what happens on click, submit, error).

4. Check each acceptance criterion in docs/stories.md against the screens. Note any criterion
   with no visible design in design/README.md under "Gaps".
5. Call propose_handoff(to="human", files=[...all design files...], summary="...").
