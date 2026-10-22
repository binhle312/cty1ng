# D45. Every run reads the project's goal and instructions

Status: proposed (2026-10-22). The owner agreed to it in the UI design review. It waits for the
owner's acceptance. It amends D37 (projects).
Decision: A project has a **goal** and **instructions**.
- The goal is `projects.description`, 500 characters or less. The left bar shows it.
- The instructions are `projects.instructions_md`, a new column, 3000 characters or less. They are
  Markdown, like an `AGENTS.md` file.
Only the owner can change the goal and the instructions. Bots cannot change them. Every run in the
project puts them in the prompt in this order: project instructions, then the goal, then memory.
They count toward the history budget of the bot (D32). The sensitive-data guard (D39) checks them
when the owner saves them.
Example: The goal is "Plan the v2 onboarding flow". The instructions are "Write stories as
Given/When/Then. Ask before you add a new screen." All bots in all chats of the project read both.
Not chosen:
- Instructions as project memory items. Bots can change memory, and instructions are rules, not
  facts.
- No limit. 3000 characters is approximately 750 tokens. This is a small part of the context
  window of a current model.
Consequences: A migration changes the limit of `description` and adds `instructions_md`. The New
project page and the project settings show the two fields
(`../design/components/new-project-page.md`).
Why: The owner needs one place for the rules that all bots in a project follow. Memory is not
that place, because bots learn and change memory.
Implemented in: `../domain-model.md` §14, `../api.md`, the rules of the prompt builder, task M5b
(after the owner accepts it).
