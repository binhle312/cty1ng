# seed

Example content that `make seed` and "Load the examples" (UI-1.7, `POST /setup/examples`) import.
The skills are written for this app. They start from the BA and Designer skills of an earlier
prototype.

| File | What it is |
| --- | --- |
| `skills/working-principles/SKILL.md` | General rules: done, check, ask, less, hand off, sources. The example bots pin it with "Always load" on (D16); the owner can turn it off or unpin it per bot |
| `skills/hand-off-work/SKILL.md` | How to write a handoff brief: Goal, Done (checked), Assumed, Open questions, Ask, Suggested skills (`docs/conversation-rules.md` §5) |
| `skills/write-user-stories/SKILL.md` | BA skill in the suggested layout: Steps, Done when, Reply (`docs/requirements/skill-hub.md`, "Suggested skill layout") |
| `skills/interview-stakeholder/SKILL.md` | BA skill: short rounds of questions, then a brief with decisions and open questions |
| `skills/design-ui-prototype/SKILL.md` | Designer skill: one HTML file per screen, with every state the stories name |
| `skills/review-against-stories/SKILL.md` | Review skill: each acceptance criterion with a result and evidence |

Try a cross-model review: add a bot that uses another provider, pin a review skill, and mention
it after BA replies. Two models that agree are a strong signal; nothing in the app needs to change.
