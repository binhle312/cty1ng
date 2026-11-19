---
name: decision-pages
description: Build an HTML page that a person reads to decide or to get a status, from a JSON content file, with checked word limits and a headless verify. Use when you ask a human to choose between options, send several questions for answers, or send a status report that ends in a decision.
disable-model-invocation: true
metadata:
  author: binhle312
  tags: [decision, report, html]
---

# Decision pages

A decision page asks one person to answer a set of questions, one question per step, and to
send the answers back as text. A report page shows status only. Both come from one JSON
content file. The kit writes one self-contained HTML file: no network, system fonts, light
and dark themes.

The reader scans. They read the title, the first line and the bold words, and little else
(R1.1, R1.2). Everything that decides the answer goes in those places. The rest goes into a
closed "Details" section or out.

Kit files in this skill folder:

| Script | Purpose |
| --- | --- |
| `scripts/lib.mjs` | The lint and the page builder. |
| `scripts/gen.mjs` | `node scripts/gen.mjs content.json page.html` checks the content and writes the page; `--text page.txt` also writes the page text for the writing check. |
| `scripts/selftest.mjs` | `node scripts/selftest.mjs` checks the text export on a small content file. |
| `scripts/verify.mjs` | Opens the page in a headless browser and asserts the rules below. |

- `references/content-format.md`: every field, with the limits table.
- `references/research.md`: the evidence. Rule ids such as R2.4 point to its sections.
- `agents/openai.yaml`: Codex does not start this skill by itself, as the `disable-model-invocation` field does for Claude Code.

## Reader rules

Each rule has its research id and the reason in one line. The kit enforces most of them; the
others are yours.

| Rule | Id | Reason |
|---|---|---|
| The ask comes first: "Decide: ..." in at most 20 words | R2.4 | Readers stop early; the conclusion must be in line 1. |
| The title is the question, at most 12 words, ends with "?" | R5.2 | The heading tells the reader what to do on this step. |
| One decision per step | R5.1 | Two decisions in one step make both answers vague. |
| 2-4 key facts, each with 2-4 bold lead words | R2.1, R1.5 | Working memory holds about 4 chunks; the first 2 words carry the scan. |
| More than 3 numbers go in a table, numbers right-aligned | R1.6, R3.1 | A matrix lets the eye compare; prose makes the reader build it. |
| An example as 2-4 ordered steps with a time or trigger label | R7b | Concrete steps show what the choice does in real use. |
| Each option shows Gets, Costs and Risk inside its own card | R2.2 | Trade-offs away from the option force the reader to join them in the head. |
| Every option has the same fields, all filled | R3.2 | A comparison with gaps is no comparison. |
| 2-4 real options; each has a real gain | R3.3, R3.6 | A straw-man option pushes the reader to the pick. |
| No option is pre-checked | R3.4 | A default moves the choice more than any argument. |
| The pick is a labeled box with confidence and "Pick another if" | R3.5, R3.7 | The reader can weigh only what the page shows. |
| One colour fill per question: the pick | R4.1, R4.6 | If everything is marked, nothing stands out. |
| Bold is at most 10% of the words | R4.3 | Fewer highlights get more attention each. |
| Risk level is a word ("Risk: low"), not only a colour | R4.5 | Colour alone fails some readers. |
| At most 220 words of context and 160 words of options before Details | R1.2 | People read about 20% of a page. |
| Sentences at most 20 words; paragraphs at most 50 | R2.7, R1.3 | Long sentences and blocks cause skipping. |
| Text lines at most about 70 characters | R2.6 | Long lines make readers lose their place. |
| A question step uses 12 columns: the facts take 7, the answers take 5. The facts scroll by themselves; the answers stay in place. | R2.2 | The trade-offs stay next to the choice while the reader reads. |
| Block labels say the content ("Scores are a near tie"), not the type ("What") | R1.4 | Headings are the scan path. |
| Every id has its meaning next to it ("order 12, for this week only") | R6 | A bare id stops the reader. |
| One closed Details section, labelled with what is inside | R2.5 | Some readers need the story; nobody needs it first. |
| A fact that does not change the choice goes into Details or out | R2.3 | Extra material costs attention and adds nothing to the decision. |
| Bold lead words and headings name decision facts, not background | R4.4 | Readers remember only the signaled words. |
| Answers save on each click; Back, Next and the arrow keys move | R5.6, R5.4 | The reader can stop, come back and change any answer. |
| A "Check your answers" step with a Change link per row | R5.5 | The reader confirms before sending. |

## Steps

1. **List the questions.** One decision per question. Split a question that holds two. Give
   each a topic of 1-3 words for its step button.
2. **For each question, find the real options.** 2-4 options that a sensible person could
   choose. Write each option's real gain, cost and risk. If an option has no case, remove it
   and say so in the question's Details.
3. **Write the content file** in the format of `references/content-format.md`, with the writing rules
   below. Put the conclusion in the ask and the evidence in the facts and table. Put the use
   case in the example and the story in Details.
4. **Build:** `node scripts/gen.mjs content.json page.html --text page.txt`. Fix every `LINT` line.
   Cut words; do not move decision facts into Details to pass a limit. Read every `WARN` line: fix
   it, or keep it for a reason that you put in your report.
5. **Check the writing.** Write the content in Simplified Technical English (ASD-STE100). Run the
   checker of the `ste-writing` skill on the `--text` file of step 4: the page text with one sentence or item on
   each line. The score must be 80% or more before you send the page. Give a reason for each
   flagged sentence that stays: fixed text, a technical name, or accuracy. If the checker is not
   installed, tell the person, and apply the rules by hand.
6. **Verify:** `NODE_PATH=<node_modules that has @playwright/test> node scripts/verify.mjs content.json page.html`.
   The step is done when the last line says `0 failed`.
7. **Look at the screenshots** that verify writes (`-overview`, `-q1`, `-finish`, `-q1-dark`).
   Blur your eyes: you must see, in order, the title, the ask, the pick box and the options.
   Fix what one look shows, then build and verify again.
8. **Run the pre-send checklist** at the end of this guide, then send the page.

## Writing rules

Write in Simplified Technical English (STE). The reader may not be a native speaker, and an
expert also reads plain text faster (R2.8).

- One short sentence for one idea. Simple present or past tense, active voice.
- Use the common word: "use", not "utilize". One name for one thing on the whole page.
- Write counts as digits: 8 fixes, 25 files (R1.6).
- Start each fact, list item and option label with its key words (R1.5).
- Keep exact text exact: file names, commands, ids and quotes go in `code` or quote marks.
- Define a private term at first use in at most 8 words, or use a plain word (R6).
- Write "I" for your own work and your own errors. Name an error plainly.

The limits (words per field, items per list) are in `references/content-format.md`. The lint applies
them; a sentence split on "; " still counts as one sentence.

## What to highlight

- **The pick box** is the only colour fill on a question step. Nothing else competes with it:
  examples are plain steps, facts are plain bullets.
- **Bold** goes on the 2-4 lead words of each fact and list item. The kit sets option labels,
  the "Decide:" label and the pick line in bold for you. Bold nothing for tone.
- **The chart** on an overview gets one highlighted series in the accent colour; the other
  series are grey. Label each bar directly.
- **Risk chips** use pale colours with the level in words.

## Honest recommendations

The pick moves the answer strongly (R3.4), so calibrate it.

- Give the main reason in one sentence. If the evidence is close, say "close call" and show
  the margin: "107 against 106", not "won".
- Show the evidence against the pick. When a judge or a test disagreed, put it in a key fact.
- "Pick another if" names a real situation where another option is better, and its letter.
- Do not inflate the pick's gains or hide its costs. Its risk text is as concrete as the
  others'.
- Keep every fact and number from your sources. Shorten the words, not the facts. A fact that
  does not change the choice goes into Details.
- When you remove an option or correct an earlier claim, say so in the Details.

## Overview step

The overview is step 0. It answers "what is the state, and what do you need from me?"

- `heading`: what the page is and how many questions ("Release 4: 7 questions for you").
- `lead`: the bottom line in at most 30 words: the state and the main finding.
- Blocks, each with a finding as its title. Typical blocks: the open issues, the status list,
  the numbers table, my errors, and other items that wait for the reader. Put two short blocks
  side by side (`place: left` and `place: right`).
- A chart only when it shows real status at a glance, for example the margin between scores.
  Bars start at 0.
- The kit adds a table of all questions with the pick and its confidence; each title links to
  its step.

For a **report page**, set `questions` to an empty list. The page is the overview alone. Put
the decision you need, if any, in the lead.

## Check-answers step

The last step lists each question title, the chosen option and the note, with a Change link
per row. "Copy my answers" copies this text:

```text
<page title>, <date>: my answers (7 of 9)
Q1: A <option label>
  Note: <note text>
Q2: (no answer)
```

The reader pastes it back to you. Read the letters against the options in your content file.

## Pre-send checklist

- [ ] `scripts/gen.mjs` printed 0 lint errors; each warning is fixed or has a reason in your report.
- [ ] `scripts/verify.mjs` printed `0 failed` on the final page.
- [ ] The STE checker gave 80% or more on the `--text` file of step 4, or you told the person that it is not installed.
- [ ] You looked at all four screenshots after the last change, in light and dark.
- [ ] Each title is a question, and each ask starts the decision in line 1.
- [ ] Each option has a real gain; no straw man is left.
- [ ] Each pick has its confidence, its margin when close, and "Pick another if".
- [ ] Every fact and number of the source is on the page or in Details.
- [ ] Every id has its meaning next to it.
- [ ] The overview names my errors and other items waiting for the reader.
- [ ] The storage key is new for this page, so old answers do not show.
