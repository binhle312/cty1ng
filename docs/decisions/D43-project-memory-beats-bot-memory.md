# D43. Project memory beats bot memory; a conflict with the owner stops the bot

Status: proposed (2026-10-22). The owner agreed to it in the UI design review. It waits for the
owner's acceptance. It amends D38 (memory scopes). The other rules of D38 do not change.
Decision: In a project, a bot continues to use its own memory (D38). If project memory and bot
memory do not agree, the bot uses project memory. If project memory does not agree with the
owner's last message, the bot does not guess. The bot stops, and the run shows **Waiting for
you**. The owner then selects one of two buttons: **"Follow my instruction this time"** or
**"Update project memory"**. The owner can move a 1:1 chat into a project. The API gets an
endpoint for this move.
Example: The project memory says "Stories use the Given/When/Then format". The BA's own memory
says "The owner likes short bullet stories". In the project, the BA writes Given/When/Then. Then
the owner writes "just give me bullets". The BA stops and asks the owner which rule to follow.
Not chosen:
- The last instruction always wins, and the bot does not ask. Project rules then change and
  nobody sees the change.
- Bots do not use their own memory in projects. Bots then lose useful habits.
Consequences: The Memory pane shows project memory first. It shows a bot memory item that project
memory overrides with a line through it (`../design/components/memory-pane.md`). Runs get a new
waiting reason. The API gets an endpoint that moves a conversation into a project.
Why: All bots and chats in a project share project memory, so it must be stable. Only the owner
can decide between project memory and a new instruction.
Implemented in: `../conversation-rules.md`, `../domain-model.md` §14, `../api.md`, task M5b
(after the owner accepts it).
