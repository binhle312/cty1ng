# log

Pino JSON logs (`docs/architecture.md` §9).

| File | What it is for |
| --- | --- |
| `pino-logger.ts` | The logger, and the redaction of every `*_API_KEY` value from the final line (`docs/security.md` §2.6) |

Start here: `pino-logger.ts`. Do not: log message or file contents at `info`.
