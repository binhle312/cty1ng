# D43. Project memory beats bot memory; the bot asks about a conflict before it acts

Status: accepted (2026-10-22, owner). The owner agreed to it in the UI design review. It amends D38 (memory scopes). The other rules of D38 do not change.
Decision:
- **Order of the rules in a project.** The project instructions (D45) win over project memory.
  Project memory wins over the bot's own memory (D38). The bot continues to use its own memory
  when no rule above it disagrees.
- **Check before action.** Before a bot works on a new owner message, it compares the
  message with the project instructions and project memory. The prompt tells it to do this in the
  same model call, so the check adds no extra call.
- **Conflict found: the bot asks first.** If the message does not agree with a project rule, the
  bot does not do the work yet. It replies with a short question that names the rule, as in an
  interview. This is a normal bot reply, not a special run state.
- **The owner's answer wins.** The bot then does what the owner says. If the answer is different
  from project memory, the bot adds one line with an **Update project memory** button. The line
  does not stop the work.
- **No conflict found: the bot works.** It does not ask questions when nothing disagrees.
- **Memory and instructions: the check happens when they change, not during work.**
  - Before a bot saves a project memory item, it compares the item with the project instructions.
    If they disagree, the bot does not save the item. It asks the owner in the chat. If the owner
    agrees, the bot saves the item, and the bot also suggests a change to the instructions.
  - When the owner saves new project instructions, the app starts one check run. The run compares
    the instructions with all project memory items. It shows a proposal card, as "Tidy memory"
    does (D38). Each item that disagrees has a checkbox to update or delete it. Nothing changes
    until the owner applies the card.
  - So a run normally does not find a disagreement between instructions and memory. If a run does
    find one, the instructions win, and the bot continues the work. When the work is complete, the
bot reports the conflict to the owner at the end of its reply. The report names the memory item
and the instruction, and has an **Update project memory** button.
- The owner can move a 1:1 chat into a project. The API gets an endpoint for this move.
Example: The project memory says "Stories use the Given/When/Then format". The owner writes
"just give me bullets". The BA replies: "Project memory says stories use Given/When/Then. Do you
want bullets only for this answer?" The owner writes "yes, only this time". The BA writes
bullets. It adds the line "This differs from project memory" with the **Update project memory**
button.
Not chosen:
- The bot stops the run in **Waiting for you** with two buttons. This is a special state for a
  question that a normal reply can ask.
- The bot follows the message and does not ask. The owner sees the conflict only after the work.
- The bot asks about each memory item that is near the topic. Too many questions slow down the
  owner. The bot asks only when a rule and the message disagree.
Consequences: The Memory pane shows project memory first. It shows a bot memory item that project
memory overrides with a line through it (`../design/components/memory-pane.md`). The prompt
builder adds the check rule. A test with the fake model checks that a conflict gives a question
and no file changes. The memory tools check new project items against the instructions. A save of
the instructions starts a check run, with normal cost tracking (D21). The API gets an endpoint that moves a conversation into a project.
Why: D38 says that memory is data, not instructions from the owner. So the owner's answer must
win. A question before the work costs less than work that the owner must undo. All bots and chats
in a project share project memory, so the owner must see each change to it.
Implemented in: `../conversation-rules.md`, `../domain-model.md` §14, `../api.md`, task M5b.
