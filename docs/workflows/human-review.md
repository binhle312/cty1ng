# Present work for human review

Read this workflow when you present a proposal, plan, design, or review item to the owner. Before a protected action, check [AGENTS.md §7](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr).

## Visual first

The documents in `docs/` are written for agents. They are long and exact. The owner must not
have to read them to understand or approve a proposal. So an agent shows each proposal to the
owner in a short, visual form first. This applies to plans, design rounds, decisions and
review items, in PRs and in local sessions.

1. **Sketch first.** For a new flow, screen, data model, architecture change or other
   structural decision, show a short text sketch, table or outline before a detailed artifact.
2. **Explain the decision.** With the sketch, say what changes, why, the trade-offs, and which
   choices need the owner's approval.
3. **Draw when it helps.** Make a rendered diagram or mockup when the owner asks for it or
   approves the sketch. If the owner asks for a finished visual at once, skip the sketch.
4. **Keep the source.** A diagram has a text source that an agent can edit: Mermaid in the
   Markdown for flows, states, sequences and data models. A screen has its spec in
   `docs/design/components/` and its preview in `docs/design/previews/` (`docs/design/README.md`).
5. **Update the docs together.** After the owner approves, one docs-only PR updates the
   owning specs, decisions, acceptance criteria and visuals together.
6. **Each approval is separate.** Approval of a sketch lets the agent draw. It does not let the
   agent build. The checkpoints are, in order:

   ```
   text sketch ──▶ rendered visual ──▶ approved spec (docs PR) ──▶ implementation plan ──▶ code
          approve to draw     approve the design      approve the plan (planning.md)
   ```

   A migration and a decision change are their own checkpoints ([approvals](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr)).
7. **Keep it small.** A small change gets a short explanation or a table. Do not draw a
   diagram that adds no information.

A diagram or mockup from an agent is a proposal, not a decision, until the owner accepts it.
This does not change the rule that `docs/design/` wins over design-skill output.

Which form to use:

| Subject | First sketch | After approval, if useful |
| --- | --- | --- |
| Page layout | Text wireframe | Preview in `docs/design/previews/`, spec in `docs/design/components/` |
| Bot or run states | List of states and transitions | Mermaid state diagram |
| Bots and the owner in a conversation | Numbered steps | Mermaid sequence diagram |
| Tables and relations | List of entities and links | Mermaid ER diagram |
| API and provider calls | Arrows between parts | Mermaid flowchart |
| Repository structure | Folder tree | Module map, only if the tree is not clear |
| A user journey | Numbered steps | Mermaid flowchart |
| Alternatives | Comparison table | Side-by-side mockups, for screens only |
| A small rule change | Before and after table | Nothing more |

## Owner review before merge

Focus on `Needs human review` items, migrations, the evidence table, and
one run of the app. Merge when satisfied.
