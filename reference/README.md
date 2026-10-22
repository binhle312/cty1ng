# reference/

> Read-only reference, in Python. Do not import from it or copy files into the app. Translate
> behaviour into `backend/src/` following `docs/porting-guide.md`. This folder is deleted at the
> end of M6.

`discord-role-bots/` is the prototype (`porting-guide.md` §1), copied in M0a without `.env`,
`.venv/` or caches. Copy checked against the owner's checksums of `rolebots/workspace.py`,
`rolebots/db.py`, `rolebots/agent.py` and `tests/test_workspace.py` (PR #10). It is excluded
from ESLint, Prettier, Vitest, dependency-cruiser and CodeQL.
