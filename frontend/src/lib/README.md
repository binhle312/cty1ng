# lib

Helpers the whole app uses.

| File | What it is for |
| --- | --- |
| `storage.ts` | Browser storage read with a schema, in try/catch; the app works without it |
| `log.ts` | The logger: silent in production, ids and event names only |
| `time-format.ts` | "5 min ago" under a day, else local ISO time; the full time for tooltips (`time-format.md` §1) |
| `cn.ts` | Joins Tailwind classes; knows our token names |
| `zod-config.ts` | Zod without its `new Function` fast path, which the CSP blocks |
| `api/` | The generated API client and its setup |
| `realtime/` | The event stream and the reducer (`docs/realtime-events.md` §1a, §3) |

Start here: the folder you need. Do not: log message or file contents (`docs/security.md` §2.10).
