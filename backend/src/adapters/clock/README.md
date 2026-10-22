# adapters/clock

The clock port on the system clock.

| File | What it is for |
| --- | --- |
| `system-clock.ts` | `now()` from `Date` |

Do not: read the time anywhere in `core/` except through the clock port.
