# trash

What all Trash kinds share (D62, `docs/architecture.md` §6.1). Each kind's own Trash rules stay
in its feature folder (skills, bots).

| File | What it is for |
| --- | --- |
| `purge-due.ts` | The purge job's loop: the due items of one kind, one per transaction, each checked again inside its transaction |

Start here: `purge-due.ts`. Do not: purge two items in one transaction; one item's failure must
roll back only that item.
