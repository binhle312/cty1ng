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
content file. The kit writes one self-contained HTML file with light and dark Workbench themes.
It uses local Inter when available and system fonts otherwise.

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
| The page stands alone: the reader decides with no chat, terminal or other file open | R2.9 | A reader who must look elsewhere to understand a choice cannot decide on the page. |
| The overview says what happened and why it needs a decision now | R2.9 | The reader did not see your work; the event gives the question its sense. |
| A choice about words quotes the old and the new words, and names the file and the section | R2.9 | A summary of a change hides the exact difference that the reader decides on. |
| The purpose and the source of the thing in question come before the choice | R2.9 | The reader cannot weigh a change to a rule without what the rule is for. |
| The ask comes first: "Decide: ..." in at most 20 words | R2.4 | Readers stop early; the conclusion must be in line 1. |
| The title is the question, at most 12 words, ends with "?" | R5.2 | The heading tells the reader what to do on this step. |
| One decision per step | R5.1 | Two decisions in one step make both answers vague. |
| 2-4 key facts, each with 2-4 bold lead words | R2.1, R1.5 | Working memory holds about 4 chunks; the first 2 words carry the scan. |
| More than 3 numbers go in a table, numbers right-aligned | R1.6, R3.1 | A matrix lets the eye compare; prose makes the reader build it. |
| An example as 2-4 ordered steps with a time or trigger label | R7b | Concrete steps show what the choice does in real use. |
| Each option shows Does, Gets, Costs and Risk inside its own card | R2.2 | Trade-offs away from the option force the reader to join them in the head. |
| Every option has the same fields, all filled | R3.2 | A comparison with gaps is no comparison. |
| 2-4 real options; each has a real gain | R3.3, R3.6 | A straw-man option pushes the reader to the pick. |
| No option is pre-checked | R3.4 | A default moves the choice more than any argument. |
| The pick is a labeled box with confidence and "Pick another if" | R3.5, R3.7 | The reader can weigh only what the page shows. |
| In the question content, the accent fill marks only my pick. The reader's choice, the current step and Next use the theme accent. Voter pills use role tints. | R4.1, R4.6 | If everything is marked, nothing stands out. |
| Bold is at most 10% of the words | R4.3 | Fewer highlights get more attention each. |
| Risk level is a word ("Risk: low"), not only a colour | R4.5 | Colour alone fails some readers. |
| At most 220 words of context and 160 words of options before Details | R1.2 | People read about 20% of a page. |
| Sentences at most 20 words; paragraphs at most 50 | R2.7, R1.3 | Long sentences and blocks cause skipping. |
| Text lines at most about 70 characters | R2.6 | Long lines make readers lose their place. |
| A question step uses 12 columns. The facts take 6 and the answers take 6. The facts scroll by themselves. | R2.2 | The 7:5 split pushed three option cards below the footer in a short window. The equal split gives the cards more room. |
| Block labels name the content ("A saves time on repeat builds") | R1.4 | Headings are the scan path. |
| Every id has its meaning next to it ("order 12, for this week only") | R6 | A bare id stops the reader. |
| One closed Details section, labelled with what is inside | R2.5 | Some readers need the story; nobody needs it first. |
| A fact that does not change the choice goes into Details or out | R2.3 | Extra material costs attention and adds nothing to the decision. |
| Bold lead words and headings name decision facts, not background | R4.4 | Readers remember only the signaled words. |
| Answers save on each click. Back, Next, arrow keys and a two-finger touchpad swipe move between steps. | R5.6, R5.4 | The reader can stop, come back and change any answer. |
| A "Check your answers" step with a Change link per row | R5.5 | The reader confirms before sending. |

## Steps

1. **List the questions.** One decision per question. Split a question that holds two. Give
   each a topic of 1-3 words for its step button.
2. **Read the source of each question.** Open the file, the rule or the record that the
   question is about, and find what it is for: its origin, such as a lesson, a decision or an
   incident. Write down the exact words that change, if the question is about words. A pick made
   from your memory of the source can be wrong.
3. **Find whose decision it is, and the real options.** For each question, write down:
   - the rule or the approval that makes it the reader's decision (`owner`);
   - what the reader's earlier decisions and the approved scope already settle (`settled`);
   - the one choice that still needs the answer (`decides`).

   Then find 2-4 options that a sensible person could choose, each with what it does, its real
   gain, cost and risk. Remove an option that asks the reader to approve a settled point, that
   only defends your own earlier change, or that offers a difference the sources do not show.
   List each removed option and why in `removed`.

   Then challenge each question before you write it: what stays open after the settled points,
   and which source makes it the reader's decision? If nothing stays open, drop the question.
   If you are not sure, get the source review of step 7 now, before you write. Give the reviewer
   this list and the paths of the sources, because the content and question files do not exist yet.
4. **Write the content file** in the format of `references/content-format.md`, with the writing rules
   below. Put the conclusion in the ask and the evidence in the facts and table. Put the use
   case in the example and the story in Details.
5. **Build:** `node scripts/gen.mjs content.json page.html --text page.txt`. Fix every `LINT` line.
   Cut words; do not move decision facts into Details to pass a limit. Read every `WARN` line: fix
   it, or keep it for a reason that you put in your report.
6. **Check the writing.** Write the content in Simplified Technical English (ASD-STE100). Run the
   checker of the `ste-writing` skill on the `--text` file of step 5: the page text with one sentence or item on
   each line. The score must be 80% or more before you send the page. Give a reason for each
   flagged sentence that stays: fixed text, a technical name, or accuracy. If the checker is not
   installed, tell the person, and apply the rules by hand.
7. **Get a source review.** A reviewer of the same or a stronger model than yours, read-only,
   gets the content file, the question files of step 5 (`page.q1.txt`, ...) and the paths of the
   sources behind each question. The question files show what each screen shows; the content
   file shows the option keys, the pick and the Details. For each question it
   answers: whose decision is it, and which source says so; what do the sources already settle;
   does an option ask for an approval that the sources do not give, or offer a difference that
   does not exist; does the question say what is settled and what only the answer changes. It
   ends with `VALID` or `INVALID` for each question. Fix each point, or answer it in writing in
   your report. In a test on two rejected pages, a reader of the page alone missed an option that
   needed an approval nobody gave; a reader of the sources found it.
8. **Test each question screen alone.** Step 5 also writes `page.q1.txt`, `page.q2.txt` and so
   on: the text of one question screen, with its Details closed. Give each file, and nothing
   else, to a new agent session that did not see your work. Ask it to write "NOT ON THE SCREEN"
   for each part that the screen does not give:
   1. What happened, and why does it need a decision now?
   2. What is already decided, and what does only your answer change?
   3. What is the thing in question, and what is it for? If the choice is about words: what are
      the exact old and new words?
   4. For each option: what does it do, and what does it cost?
   5. What does the pick rest on, and when is another option better?
   6. Is any option about something that is already decided, or not your decision to make? If
      so, write "ALREADY SETTLED" and why.

   Compare its answers with what you know. Each answer that it cannot give, or gives wrong, is a
   missing fact on that screen: add it, then build and check again. The step is done when
   answers 1 to 5 are right, answer 3 gives the purpose (and both versions for a choice about
   words), and answer 6 names no option. If you cannot start a new session, tell the person that
   this test did not run.
9. **Verify:** `NODE_PATH=<node_modules that has @playwright/test> node scripts/verify.mjs content.json page.html`.
   The step is done when the command exits with status 0 and its summary line says `0 failed`.
   Each check reads only what its message names: an element, a class, a computed value or a text.
   `0 failed` does not show how the page looks, so step 10 is still necessary.
10. **Look at the screenshots** that verify writes: `-overview`, `-q1`, `-finish` and `-q1-dark`
   for a page with questions, and only `-overview` for a report page.
   Blur your eyes. On a question screenshot you must see, in order, the title, the ask, the pick
   box and the options. On the overview of a report page, you must see the title first, then the lead if the page has one.
   Fix what one look shows, then build and verify again.
11. **Run the pre-send checklist** at the end of this guide, then send the page.

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

- **The pick box** is the only accent fill in the question content (see the R4.1 row). Examples are plain steps and
  facts are plain bullets. If the source gives votes, list them in the option cards as described
  in [the content format](references/content-format.md#one-question).
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
- Base the pick on the source (step 2), not on your summary of it. If the source changes your
  pick, say so in the Details.
- When you remove an option or correct an earlier claim, say so in the Details.

## Overview step

The overview is step 0. It answers "what is the state, and what do you need from me?"

- `heading`: what the page is and how many questions ("Release 4: 7 questions for you").
- `lead`: the bottom line in at most 30 words: the state and the main finding.
- When a question comes from an event (a review finding, a failure, a change), one block says
  what happened, where, and why it needs the reader now. A block for the thing in question says
  what it is and what it is for. A choice about words gets a table with the old words, the new
  words and their source, each as a quote.
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
  Worker: <name>
  Note: <note text>
Q2: (no answer)
Page clear: no
  Missing: <text>
```

If a question has votes, each vote of the chosen option gets one line below it, or "No votes".
The reader pastes it back to you. Read the letters against the options in your content file.
The "Page clear" line answers "Did this page tell you what each question is about?". It is the
only test by the real reader. When it says "no", or names something missing, fix that in the
next page, and add the case to the step that should have found it.

## Pre-send checklist

- [ ] `scripts/gen.mjs` printed 0 lint errors; each warning is fixed or has a reason in your report.
- [ ] `scripts/verify.mjs` printed `0 failed` on the final page.
- [ ] The STE checker gave 80% or more on the `--text` file of step 5, or you told the person that it is not installed.
- [ ] Each question has `owner`, `settled` and `decides`, and each option has `does`; no option asks for a settled point.
- [ ] A source review ran; each of its points is fixed or answered in your report.
- [ ] A new session passed step 8 on each question screen alone (answers 1 to 5 right, answer 6 names no option), or you told the person that the test did not run.
- [ ] The overview says what happened and why it needs the reader now.
- [ ] Each choice about words quotes the old and the new words, with the file and the section.
- [ ] You looked at each screenshot of step 10 after the last change.
- [ ] Each title is a question, and each ask starts the decision in line 1.
- [ ] Each option has a real gain; no straw man is left.
- [ ] Each pick has its confidence, its margin when close, and "Pick another if".
- [ ] Every fact and number of the source is on the page or in Details.
- [ ] Every id has its meaning next to it.
- [ ] The overview names my errors and other items waiting for the reader.
- [ ] The storage key is new for this page, so old answers do not show.
