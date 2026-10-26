# D63. Tidy memory and the memory check are model requests, not runs

Status: accepted (2026-10-26, owner, PR #37 review 14:34). From the M5b UI design review, round 15, step 4: the owner
approved the Tidy boards Y1–Y8 and the recommendation "Tidy on the page is one model request,
not a run" (14:07).
Amends: D38, D43

Decision:

- **Why a request.** A run belongs to a conversation (`runs.conversation_id` is NOT NULL, D11).
  Tidy on the Memory page and the memory check after an instruction save (D43) have no
  conversation. So each is **one model request** with `purpose = 'memory_tidy'` or
  `'memory_check'`, like the title request (D46): no tools, no run, no run slot.
- **Which model.** Tidy uses the model and effort of the bot that the owner picks in "Tidy
  with" (the bots of that place). On a bot's own memory, that bot does the work, with no menu.
  The memory check uses the model of the bot that last ran in the project; with none, the owner
  picks one in the same menu.
- **Cost and caps.** The request is priced and stored in `model_requests` (D21), counts toward
  the daily caps (D20, D42) and reserves its worst-case cost while it is in flight, as a title
  request does (D46). At a cap, the request does not start and the page shows the cap error.
  On the Usage and Statistics pages these requests are one group, "Memory upkeep".
- **The result is a proposal card.** The model returns a list of changes (merge, rewrite,
  delete, flag) with the version of each item it read. The app stores it (`memory_proposals`,
  `../domain-model.md` §14) and shows the card. Nothing changes until the owner applies it.
- **Stale rows.** When the owner or a bot changed an item after the request read it, the rows
  for that item are off and not ticked: "You changed this item after BA read it. Press Tidy
  again to include it." The other rows still apply.
- **The app checks every new text (owner, PR #37 review).** A merge or rewrite text passes the
  sensitive-data guard (D39) and `memory_item_max_chars` when the card is stored (a failing row
  is off, with its reason) and again at Apply. A failing row is never saved.
- **Instructions changed.** A check change stores `projects.instructions_version`. Decide and
  Apply refuse a change with 409 `instructions_changed` when the version moved on; the row says
  "The instructions changed. Check again."
- **Apply.** Applied rows are ordinary memory changes: versions when history is on, events, and
  a deleted item goes to Trash (D62). A merge keeps the first item with the new text and
  deletes the others. The toast is "Saved ✨". A flag row has no check box; it points to Decide
  on the item.
- **One open card per place and kind.** A new Tidy replaces a Tidy card that the owner did not
  apply; a new check replaces an open check card. A Tidy card and a check card can be open at
  the same time, because they do different jobs (clarified 2026-10-26, owner, PR #37 review).
  **Stop** cancels the request in flight; nothing is stored. A request that was in flight when
  the app stopped is marked failed at the next start.
- **Asked in a conversation.** "@BA tidy the project memory" is a normal run. The bot calls the
  tool `propose_memory_tidy`, which stores the same card in BA's reply. The tool changes
  nothing, so the run needs no plan card first (D48): the tidy card is the approval.

Example: The owner presses Tidy on Login app memory and picks BA (Claude Sonnet, High). After
one request ($0.01), the card lists a merge, a rewrite, a delete and a flag. The owner unticks
the delete and presses **Apply 2 changes**. Login app now has 7 items, and the merged and
rewritten items have the New tag.

Why: A run needs a conversation, a slot and tools. Tidy needs none of them: it reads one list of
items and returns a list of changes. A request is cheaper, has no queue behind other runs, and
fits the model that the title request already uses.

Rejected:

- **A hidden "system" conversation for upkeep runs.** It would show up in lists, counts and the
  purge, and the owner never opened it.
- **Make `runs.conversation_id` NULL-able.** D11, the run slots, the Flow timeline and the
  purge all key on the conversation. Many rules would need an exception.
- **A fixed upkeep model in Settings.** The owner already chose a model per bot; a second model
  setting is one more thing to keep current.

Consequences: `model_requests.purpose` gets two values and `conversation_id` is NULL for them.
D43's "check run" is a check request; its card (`../design/components/memory-pane.md` §4) is
unchanged. A failed check shows "Memory check failed" with **Check again**, as D43 says.

Implemented in: `../design/components/memory-page.md` §8, `../domain-model.md` §7, §14,
`../api.md` §5b, task M5b.
