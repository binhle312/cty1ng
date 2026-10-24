# seed

Example content that `make seed` and "Load the examples" (UI-1.7, `POST /setup/examples`) import.
The skills are written for this app. They start from the prototype's BA and Designer skills
(`docs/porting-guide.md`).

| File | What it is |
| --- | --- |
| `skills/working-principles/SKILL.md` | General rules for every bot: done, check, question, less, decide, hand off. Seeded bots pin it with "Always load" (D16) |
| `skills/write-user-stories/SKILL.md` | BA skill in the suggested layout: Steps, Done when, Reply (`docs/requirements/skill-hub.md`, "Suggested skill layout") |

The prototype's other skills (`interview-stakeholder`, `design-ui-prototype`,
`review-against-stories`) move here in M1, in the same layout.

Try a cross-model review: add a bot that uses another provider, pin a review skill, and mention
it after BA replies. Two models that agree are a strong signal; nothing in the app needs to change.
