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
| `dialog.tsx` | Dialogs: a card that closes on a click outside, or an alert that asks; the default button |
| `checkbox.tsx` | The check box of `buttons.md` §5, with an optional label |
| `switch.tsx` | The on/off switch (Always load, D16) |
| `tabs.tsx` | Tabs with the 2 px `primary` underline |
| `toast.tsx` | Toasts: `showToast(text)` and the one `Toaster` in the shell |
| `time-text.tsx` | A time with its full time in a tooltip, from hover or keyboard focus |
| `markdown.tsx` | Safe Markdown: no raw HTML, safe links only, no images loaded (`docs/security.md` §2.2) |
| `popover.tsx` | A popover card (Base UI Popover; no inline styles) |
| `slider.tsx` | A slider (Base UI Slider) with an optional track background |
| `sort-button.tsx` | A 24 px sort button with its direction arrow |
| `pin-badge.tsx` | The pin badge of a bot card: Pin to top or Unpin |
