# D12. Bots are soft-deleted

Status: accepted (2026-10-20)
Decision: Deleting a bot sets `deleted_at`. Its messages stay; its avatar and name render grey.
A deleted bot cannot be added to conversations.
Why: Conversations must remain readable.
Rejected: Hard delete; cascading message deletion.
Implemented in: `../domain-model.md` §2, `../requirements/conversation.md`.
