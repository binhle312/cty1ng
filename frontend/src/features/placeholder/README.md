# placeholder

What a page shows when it has no content: before its slice builds it, while a lazy page loads,
when its address has no page, and when it fails.

| File | What it is for |
| --- | --- |
| `placeholder-page.tsx` | An empty page: its title and the slice that builds it |
| `page-skeleton.tsx` | The loading shapes of a lazy page |
| `not-found-page.tsx` | Page not found |
| `error-page.tsx` | The error screen of a failed route, and the log line of an error |

Start here: `placeholder-page.tsx`. Do not: keep a placeholder after its slice ships.
