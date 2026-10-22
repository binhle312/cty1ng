# D43. Project memory beats bot memory; a conflict with the owner stops the bot

Status: proposed (2026-10-22). Agreed in the UI design review; waits for the owner's acceptance.
Amends D38 (memory scopes); D38's other rules stand.
Decision: Inside a project a bot keeps using its **own memory** (D38), and **project memory wins**
when the two disagree. When project memory conflicts with what the owner just asked, the bot does
not guess: it stops with the run in **Waiting for you** and two buttons, **"Follow my instruction
this time"** and **"Update project memory"**. 1:1 chats may be moved into a project; a
move-to-project endpoint is added.
Example: project memory says "Stories use the Given/When/Then format"; the BA's own memory says
"Owner likes short bullet stories". In the project the BA writes Given/When/Then. If the owner
then writes "just give me bullets", the BA stops and asks which one to follow.
Not chosen: the latest instruction always wins silently (project rules drift without anyone
noticing), and bot memory switched off inside projects (bots lose useful habits).
Consequences: The Memory pane shows project memory first and marks overridden bot items
(`../design/components/memory-pane.md`). A new waiting reason on the run. An API endpoint to move
a conversation into a project.
Why: Project memory is shared by every bot and chat in the project, so it must be stable; a
conflict with the owner is a decision only the owner can make.
Implemented in: `../conversation-rules.md`, `../domain-model.md` §14, `../api.md`, task M5b
(after acceptance).
