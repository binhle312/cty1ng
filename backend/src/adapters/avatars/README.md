# avatars

The avatar store on disk (M2 plan, decision 1; `docs/domain-model.md` §2 Avatar files):
`<DATA_DIR>/avatars/<sha256>.webp`, with staged files in the same folder so the publish is one
atomic rename.

| File | What it is for |
| --- | --- |
| `avatar-files.ts` | The disk adapter of the avatar files port: stage (every byte, then fsync), publish by rename (a failure leaves no final file), touch, list, remove |

Start here: `avatar-files.ts`. Do not: build a path from a name that is not checked (an avatar id is
64 hex characters, a token a UUID), or decide here whether a file is used; the services do.
