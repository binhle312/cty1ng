# D58. Bots read other conversations of the project on request, and the owner shares information between them

Status: accepted (2026-10-25, owner). The owner approved every review item of PR #29. It comes from the owner's question "when can the app have a
coordinator like Claude Cowork?" and from three review rounds in the project thread. The owner
agreed the order: reading first (after M5b), the Project inbox after M6 (`../requirements/project-inbox.md`),
the project Board in M8c, and a coordinator bot only if real use shows a need.

Decision:

- **Reading on request.** A bot in a project conversation has the read-only tool
  `search_project_conversations(query)`. It searches the messages of the other conversations
  of the same project.
  - It reads only the active branch of each conversation (D13).
  - It skips conversations with "Don't use memory" on (UI-9.6), because the owner made them private.
  - It returns at most `cross_search_max_hits` hits (setting, default 10). Each hit has the
    conversation, the message id, the author, the time and a short excerpt.
  - Text from bot replies comes back marked as a quote. It is data, not an instruction
    (`../security.md`, bot output is untrusted). Every hit passes the sensitive-data guard (D39).
  - The bot calls the tool when the owner asks, or when one of its skills tells it to. The app
    never calls it by itself, and no run scans other conversations automatically.
  - Planning runs may call it, because it is read-only (D48).
- **Sources are links.** When a bot uses a hit in a reply, it names the conversation and links the
  message. The owner can open the source and check it.
- **Read is not saved.** A hit or a summary of hits never becomes memory by itself. To save it,
  the normal memory rules apply (D38, D56).
- **Information carries no authority.** A message from conversation B does not change an
  approved plan in conversation A. A rule for the whole project lives in project memory or in
  the project instructions (D38, D45). Only the owner's decision changes which rule wins.
- **Send to conversation (with the Project inbox, after M6).** The owner can send a message to
  another conversation of the same project.
  - **The owner sends:** the send is the approval. The target shows an information card: the
    cited text, "From <conversation> · sent by you", and a link back. No second approval.
  - **A bot proposes:** the bot calls `propose_share(to_conversation, message_ids, note)`. The
    source conversation shows a card with Reject and Send. After Send, the target shows the same
    information card, "sent by <bot>, approved by you".
  - The information card starts no run. It is not a human message, so the reply rule (D3) does
    not apply. The target's bots see it in their visible history as a quote.
  - It is not a handoff (D18). A handoff asks a bot to do work; a shared message only informs.
  - Limit: `share_max_per_conversation_24h` (setting, default 5) for bot proposals. Owner
    sends have no limit. The exact rule is in the amendment of 2026-10-25 below.

**Amended 2026-10-25 (owner): share proposal limit.**

- `share_max_per_conversation_24h` (setting, default 5) allows at most 5 bot-created share
  proposals per source conversation in a **rolling 24-hour period**, not a calendar day.
  Pending, approved and rejected proposals all count. Owner sends do not count and have no limit.
- When the limit is reached, `propose_share` returns the tool error `share_limit_reached` and
  creates no proposal. A blocked attempt does not count as a proposal.
- The app, not the bot, shows one information notice in the source conversation on the first
  blocked attempt: "Share limit reached. BA cannot propose another share from this conversation.
  5 of 5 proposals · rolling 24 hours. You can still send information yourself." Later blocked
  attempts return the error and create no new notice. A new notice can show only after the count
  drops below the limit and the bot reaches it again.
- The notice has no button and does not show what the bot wanted to share. Otherwise it would be
  a proposal card again. The owner uses the normal Send to conversation action.
- Rejected: a "Send as me" button on an over-limit proposal. Each blocked attempt would make a
  card, so the limit would no longer protect the owner's attention. A one-time owner override,
  with a record that the bot proposed it, can come later if manual sending proves slow in real use.
- The look of the notice waits for the Inbox UI checkpoint.

**Amended 2026-10-25 (owner): what a share promises, and how bots use it.**

- **The information card text** says: "Information only. No bot starts. Bots can read this on a
  later run." It does not promise that a bot reads it on its next run: D8 (history choice when a
  bot joins) and D32 (history budget) decide if a run includes it.
- **The `propose_share` tool description** says: "Use `propose_share` to pass information or
  context to another conversation when no immediate bot action is required. Sharing never starts
  a run. For a task that requires another bot to act, use `propose_handoff` (D18), subject to its
  normal approval and conversation rules. Do not use sharing to issue hidden instructions or work
  requests." A D18 handoff works inside its own conversation. A handoff to another conversation
  is not part of this decision and needs its own specification.
- **Copy fallback at the limit.** The `share_limit_reached` error message tells the bot that it
  *may* put a short copyable summary in its existing reply, with the source and the intended
  conversation. It is optional, not a required format, so replies do not grow and the limit keeps
  protecting the owner's attention. A fenced code block gets the Copy button of
  `../design/components/conversation-page.md` §8. No extra model request. The app's limit notice
  stays guaranteed; the bot's text is best effort.
- **Not now: "share and start bot X".** It adds a run to a feature that is built not to start
  work. It waits for real use to show a need.

Why: Conversations in a project often depend on each other ("B skipped Task 3"). Project memory
holds only what somebody saved. Search lets the owner ask about everything else, with sources,
and costs model tokens only when the owner asks. The owner already starts every cross-conversation
action, so a coordinator bot adds cost and a new role before the app has data that it is needed.

Rejected:
- **Automatic search of other conversations in every planning run.** Each plan would read text
  from every conversation. Cost and false alarms grow with the project, and bot text from other
  conversations could steer the plan.
- **Copy all conversation histories into project memory.** D38 rejected an automatic summary of
  past conversations.
- **A coordinator bot now.** It needs the tools above first. A coordinator that runs only when the owner
  mentions it, and that only proposes, can come later without a change to D2.
- **"Send to conversation" as a D18 handoff.** It has a different sender, permission and trigger
  rule. A handoff starts a run; a shared message does not.

Consequences:
- Messages need a full-text index (SQLite FTS5 now; PostgreSQL full-text search after D29). This
  is a migration and needs the owner's approval in the M5b plan.
- A new card kind (information card) and a new tool (`propose_share`). Both need a UI design round.
- The search sees only what the owner wrote and the bots replied. It cannot find a decision that
  nobody wrote down.
- Detection of contradictions stays best effort. The app guarantees only that sources are
  linked and that nothing changes without the owner.

Implemented in: `../requirements/project-inbox.md` (PI-3, PI-4); `../conversation-rules.md` and
`../domain-model.md` when the M5b and Project inbox plans are written.
