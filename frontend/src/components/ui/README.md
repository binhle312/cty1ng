# components/ui

Base UI parts in our style (D28, copied in the shadcn way, owned by us). They use semantic
tokens only. Base UI's Select and ScrollArea add inline styles, which the CSP blocks: do not use
them without a decision.

| File | What it is for |
| --- | --- |
| `button.tsx` | The four button kinds and two heights (`docs/design/components/buttons.md`) |
| `menu.tsx` | Menu popup, link items with the current-page bar, header, separator |
| `tooltip.tsx` | Tooltips within 300 ms |
| `skeleton.tsx` | Loading shapes, after 200 ms, still with reduced motion |
