# D45. Every run reads the project's goal and instructions

Status: proposed (2026-10-22). Agreed in the UI design review; waits for the owner's acceptance.
Amends D37 (projects).
Decision: A project has a **goal** (`projects.description`, ≤ 500 chars, shown in the left bar)
and **instructions** (`projects.instructions_md`, new, ≤ 3000 chars, Markdown, like an
`AGENTS.md`). Only the owner edits them; bots cannot. Every run in the project puts them in the
prompt in this order: **project instructions, then goal, then memory**. Both count toward the
bot's history budget (D32) and pass the sensitive-data guard (D39) when saved.
Example: goal "Plan the v2 onboarding flow"; instructions "Write stories as Given/When/Then. Ask
before adding a new screen." Every bot in every chat of that project reads both.
Not chosen: instructions as project memory items (bots could change them, and they are rules, not
facts), and no limit (3000 chars is roughly 750 tokens, a small share of any current context).
Consequences: Migration: change the `description` limit, add `instructions_md`. The New project
page and project settings get both fields (`../design/components/new-project-page.md`).
Why: The owner needs one place for the rules every bot follows in a project, which memory (learned
and editable by bots) is not.
Implemented in: `../domain-model.md` §14, `../api.md`, the prompt builder rules, task M5b (after
acceptance).
