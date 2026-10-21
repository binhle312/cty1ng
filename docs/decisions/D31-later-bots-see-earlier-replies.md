# D31. Bots answering the same message see each other's replies

Status: accepted (2026-10-21, owner).
Decision: A bot's visible history runs along the active path to the active leaf at the moment
its run starts, not only up to its trigger message. When one human message mentions several
bots, they run in mention order (D11) and each sees the replies of the bots before it.
Why: The owner asked for it. Without it, mention order has no meaning and the second bot often
repeats the first one's answer.
Rejected: History up to the trigger only (bots answer in isolation, like parallel calls).
Consequences: `visible_history` takes the active leaf at run start; every new message's parent
is the active leaf at insert time. A later bot's reply depends on the earlier one, so a failed
or stopped earlier run is visible to the later bot as that message with its status.
Implemented in: `../conversation-rules.md` §1, §4.
