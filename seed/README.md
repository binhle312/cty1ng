# seed

Example content that `make seed` and "Load the examples" (UI-1.7, `POST /setup/examples`) import.
The skills are written for this app. They start from the BA and Designer skills of an earlier
prototype.

| File | What it is |
| --- | --- |
| `bots.yaml` | The example bots, in this order: **Guide** (explains the app; pins `using-the-app` with "Always load"), **BA** and **Designer** (pin `working-principles` with "Always load" and their role skills). `make seed` runs `cli bots seed` after the skill import: each new bot takes the first model in catalog order that can run, with its default effort; a bot whose name is taken is left as it is ("BA already exists"); with no model that can run, it prints "Set a key to seed the bots" |
| `skills/using-the-app/SKILL.md` | Guide's knowledge: what the app is, its words, what works now, what is not built yet, and how to answer. **Every slice that changes something the owner can see updates it in the same PR** (M2 plan, decision 14) |
| `skills/working-principles/SKILL.md` | General rules: done, check, ask, less, hand off, sources. The example bots pin it with "Always load" on (D16); the owner can turn it off or unpin it per bot |
| `skills/hand-off-work/SKILL.md` | How to write a handoff brief: Goal, Done (checked), Assumed, Open questions, Ask, Suggested skills (`docs/conversation-rules.md` §5) |
| `skills/write-user-stories/SKILL.md` | BA skill in the suggested layout: Steps, Done when, Reply (`docs/requirements/skill-hub.md`, "Suggested skill layout") |
| `skills/interview-stakeholder/SKILL.md` | BA skill: short rounds of questions, then a brief with decisions and open questions |
| `skills/design-ui-prototype/SKILL.md` | Designer skill: one HTML file per screen, with every state the stories name |
| `skills/review-against-stories/SKILL.md` | Review skill: each acceptance criterion with a result and evidence |

Try a cross-model review: add a bot that uses another provider, pin a review skill, and mention
it after BA replies. Two models that agree are a strong signal; nothing in the app needs to change.
