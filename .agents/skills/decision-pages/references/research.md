# Decision pages: research and rules (2026-11-19)

Purpose: make the owner's quiz pages (left pane = question, right pane = options) easy to scan and
decide. Each finding has its source and one testable rule. Section 7 applies the rules to arena Q1.

Source trust: NN/g, Baymard, GOV.UK and W3C pages were read for this file. Peer-reviewed papers
were checked by their abstract or index record (DOI given); full texts were not read. Where a figure
comes from a weaker source, the finding says so.

## 1. How people read screens

1. **Most people scan; few read word by word.** 79% of test users always scanned a new page; 16%
   read word by word. Concise text improved usability 58%, scannable layout 47%, objective
   language 27%, all three 124%.
   Source: https://www.nngroup.com/articles/how-users-read-on-the-web/
   Rule for our pages: every question passes a "scan test": the bold lead words and headings alone
   tell the question, the pick and the main trade-off.
2. **People read about 20% of the words on a page** (at most 28% of a 593-word page).
   Source: https://www.nngroup.com/articles/how-little-do-users-read/
   Rule for our pages: before "Details", the left pane shows at most 220 words (table cells
   included) and the right pane at most 160 (Q1 today: about 470 words in all).
3. **A dense block of text causes the F-pattern:** the eye reads the first lines, then only the
   left edge, and misses facts at the right or lower in a line. Fixes: key points first, headings,
   bullets, bold key terms, cut text.
   Source: https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/
   Rule for our pages: no paragraph in the left pane is longer than 50 words (W3C COGA, §2.5 below).
4. **Clear headings give the "layer-cake" pattern,** the most efficient scan: the eye jumps from
   heading to heading and reads only the sections it needs. Headings must describe only their
   section, with the important words first.
   Source: https://www.nngroup.com/articles/layer-cake-pattern-scanning/
   Rule for our pages: every block has a label that says its content ("Scores are a near tie"),
   not its type ("What").
5. **Readers often see only the first 2 words (about 11 characters) of a list item or heading.**
   For 35% of tested links, those characters gave no idea of the target.
   Source: https://www.nngroup.com/articles/first-2-words-a-signal-for-scanning/
   Rule for our pages: each bullet and option label starts with its key fact, in 2-3 words.
6. **Numerals stop the scanning eye;** spelled-out numbers do not.
   Source: https://www.nngroup.com/articles/web-writing-show-numbers-as-numerals/
   Rule for our pages: write all counts as digits (8 fixes, 25 files), and put numbers in a table
   when there are more than 3.

What this means for a decision page: the owner reads the title, the first line and the bold words.
Everything that decides the answer must be in those places.

## 2. Cognitive load, chunking, disclosure, BLUF, text length

1. **Working memory holds about 4 chunks** (Cowan 2001, revising Miller's 7 plus or minus 2).
   Source: https://doi.org/10.1017/S0140525X01003922 (abstract: https://pubmed.ncbi.nlm.nih.gov/11515286/)
   Rule for our pages: the context list has at most 4 bullets; the options have at most 4 named
   attributes each.
2. **Extraneous load (effort spent on the format, not the problem) lowers performance**
   (Sweller 1988, cognitive load theory). **Split attention** is one cause: the reader must join
   separated sources in the head (Chandler & Sweller 1991).
   Sources: https://doi.org/10.1207/s15516709cog1202_4 ; https://doi.org/10.1207/s1532690xci0804_2
   Rule for our pages: an option's gain, cost and risk sit inside the option card on the right,
   next to its radio button, not in a separate left-pane section.
3. **Mayer's principles: coherence** (remove material that is not needed), **signaling** (mark the
   essential words), **spatial contiguity** (put related items near each other).
   Source: Mayer 2008, American Psychologist 63(8), https://doi.org/10.1037/0003-066X.63.8.760
   (index: https://pubmed.ncbi.nlm.nih.gov/19014238/)
   Rule for our pages: a fact that does not change the choice goes into "Details" or is removed.
4. **Inverted pyramid / BLUF: the conclusion first,** then detail in order of importance;
   "the first sentence of every paragraph should be the most important."
   Source: https://www.nngroup.com/articles/inverted-pyramid/
   Rule for our pages: the first line under the title is the ask: "Decide: ..." in at most 20 words.
5. **Progressive disclosure:** show the core first, the rest on request; keep to 2 levels; the
   label of the hidden part must say what is inside. GOV.UK: use a Details element for content
   that only some users need, never for content most users need.
   Sources: https://www.nngroup.com/articles/progressive-disclosure/ ;
   https://design-system.service.gov.uk/components/details/
   Rule for our pages: one `<details>` per question (and optional one per option), with a label
   such as "Details: the 8 parts of the Fable design"; nothing that changes the choice is hidden.
6. **Line length 50-75 characters; WCAG AAA max 80.** Long lines look "intimidating", readers
   lose their place and skip; 100+ characters causes fatigue.
   Sources: https://baymard.com/blog/line-length-readability ;
   https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html
   Rule for our pages: left-pane text has `max-width: 70ch` (today about 88 characters per line).
7. **Short sentences and paragraphs.** GOV.UK: split sentences over 25 words, max 5 sentences per
   paragraph. NN/g: 15-20 words per sentence, even for experts. W3C COGA: split any paragraph over
   50 words, one topic per paragraph, lists for 3 or more items. ASD-STE100 (the owner's writing
   rule): max 20 words in a procedural sentence, 25 in a descriptive sentence. The GOV.UK blog also
   quotes comprehension figures (14 words: over 90%; 43 words: under 10%) from a weaker,
   non-peer-reviewed source; use them only as a hint.
   Sources: https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/ ;
   https://www.nngroup.com/articles/plain-language-experts/ ;
   https://www.w3.org/TR/coga-usable/#keep-text-succinct-pattern ; https://www.asd-ste100.org/ ;
   https://insidegovuk.blog.gov.uk/2014/08/04/sentence-length-why-25-words-is-our-limit/
   Rule for our pages: sentences at most 20 words; a semicolon list counts as one sentence.
8. **Experts also prefer plain language.** 80% of people preferred clear English, more so for
   complex topics; NN/g's expert users called dense pages "crazy dense" and wanted less.
   Sources: as in item 7 (GOV.UK clear language; NN/g plain language for experts)
   Rule for our pages: "he is a developer" is no reason for long or dense text.

## 3. Presenting a decision with options

1. **Display format changes the decision strategy** (form, organization and sequence of the
   information shift the accuracy-effort trade-off). A matrix makes comparing one attribute
   across options easy; prose forces the reader to build the matrix in the head.
   Source: Kleinmuntz & Schkade 1993, Psychological Science 4(4),
   https://doi.org/10.1111/j.1467-9280.1993.tb00265.x
   Rule for our pages: when options differ on numbers (scores, files, minutes), show a table with
   one row per option.
2. **Comparison tables: about 5 items or fewer, the same attributes for every item, short cells,
   hide rows where all items are equal.** "If the information isn't complete for all compared
   products, it might as well not be in a comparison table."
   Source: https://www.nngroup.com/articles/comparison-tables/
   Rule for our pages: every option has the same fields (Gets, Cost, Risk), each filled; a field
   that is the same for all options is removed.
3. **Choice overload depends on task difficulty and option complexity more than on count.** The
   2010 meta-analysis found a mean effect near zero; the 2015 meta-analysis (99 observations,
   N=7202) found overload when the task is hard, options are complex, preferences are unclear, or
   the person wants to save effort.
   Sources: Scheibehenne et al. 2010, https://doi.org/10.1086/651235 ;
   Chernev, Böckenholt & Goodman 2015, https://doi.org/10.1016/j.jcps.2014.08.002
   Rule for our pages: 2-4 options; an option label is at most 8 words; complexity goes to Details.
4. **Defaults and recommendations move choices strongly** (meta-analysis of 58 studies, d = 0.68),
   most when they signal endorsement. **Anchoring:** the first value seen pulls the judgment
   toward it.
   Sources: Jachimowicz et al. 2019, https://doi.org/10.1017/bpp.2018.43 ;
   Tversky & Kahneman 1974, https://doi.org/10.1126/science.185.4157.1124
   Rule for our pages: no option is pre-selected; the recommendation is shown as a labeled badge
   and a "My pick" line, never as a pre-checked radio.
5. **Telling people about a default does not remove its effect,** so disclosure is honest and
   costs nothing.
   Source: Bruns et al. 2018, Journal of Economic Psychology 65, https://doi.org/10.1016/j.joep.2018.02.002
   Rule for our pages: the "My pick" line names the pick, its main reason, and the confidence
   (clear / close call) in one line.
6. **A decoy (an option that is worse than the target in every way) shifts choice to the target.**
   Source: Huber, Payne & Puto 1982, https://doi.org/10.1086/208899
   Rule for our pages: every option has a real gain; if an option has no case for it, remove it
   (for example "keep both texts as they are" with gain "no work" is a straw man unless it is a
   real choice).
7. **People judge only from what they see** ("what you see is all there is", Kahneman, *Thinking,
   Fast and Slow*, 2011, ISBN 978-0374275631). The reader cannot weigh a counter-argument that the
   page does not show.
   Rule for our pages: the pick line has a "Pick another if: ..." clause (at most 15 words) that
   names when a different option is better.

## 4. Visual hierarchy and highlighting

1. **Pre-attentive attributes (color, size, position, form) are seen in under a moment, before
   reading,** and they are not equal in strength.
   Sources: Healey & Enns 2012, IEEE TVCG 18(7), https://doi.org/10.1109/TVCG.2011.127 ;
   Few 2004, https://www.perceptualedge.com/articles/ie/visual_perception.pdf
   Rule for our pages: use one strong attribute (color fill) for exactly one thing per question:
   the "My pick" line.
2. **Hierarchy comes from contrast, size and grouping; "if everything is contrasted, then nothing
   stands out."** Max 3 type sizes, max 3 contrast treatments; test with a blur ("squint test").
   Source: https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
   Rule for our pages: a 5 px blur of a screenshot still shows, in order: title, ask, pick, options.
3. **Highlight sparingly:** Baymard says at most 10% of text; NN/g says at most 30% and never bold
   for tone. The fewer the highlights, the more attention each gets.
   Sources: https://baymard.com/blog/highlighting-text-online ;
   https://www.nngroup.com/articles/formatting-long-form-content/
   Rule for our pages: bold only the 2-4 lead words of each bullet and the option labels; bold
   text is at most 10% of the words in the left pane.
4. **Signals help memory for the signaled content only** (titles, headings, previews,
   typographic cues); unsignaled content gains nothing.
   Source: Lorch 1989, Educational Psychology Review 1(3), https://doi.org/10.1007/BF01320135
   Rule for our pages: the signaled words are the decision facts, not the background.
5. **Do not use color alone to carry meaning.**
   Source: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
   Rule for our pages: a risk chip says "Risk: low" in text, not only green.
6. **Callouts and summaries at the top need a distinct heading and look.**
   Source: https://www.nngroup.com/articles/formatting-long-form-content/
   Rule for our pages: one callout per question (the pick); examples are plain blocks, not a
   second colored box that competes with it.

## 5. Progress and flow in multi-step pages

1. **One thing per page** (one decision or one question) helps people understand the ask and
   lets the service save answers as they go.
   Sources: https://www.gov.uk/service-manual/design/form-structure ;
   https://design-system.service.gov.uk/patterns/question-pages/
   Rule for our pages: one decision per step; a question that holds 2 decisions is split.
2. **The page heading is the question;** hint text is one short sentence.
   Source: https://design-system.service.gov.uk/patterns/question-pages/
   Rule for our pages: the title ends with "?" and is at most 12 words; the subtitle is one line.
3. **Progress indicators are often not noticed,** take space and can confuse; GOV.UK says test
   without one first. Survey meta-analysis (32 experiments): a constant progress bar did not
   reduce drop-off; slow-then-fast bars increased it.
   Sources: https://design-system.service.gov.uk/patterns/question-pages/ ;
   Villar, Callegaro & Yang 2013, https://research.google/pubs/where-am-i-a-meta-analysis-of-experiments-on-the-effects-of-progress-indicators-for-web-surveys/
   Rule for our pages: keep only "Question n of N" plus Answered count; the bar is optional.
4. **Wizards suit rare, unfamiliar tasks; name each step by what the user does; mark completed
   steps; let users leave and resume.** Each step must be self-sufficient.
   Source: https://www.nngroup.com/articles/wizards/
   Rule for our pages: step buttons show a 1-3 word topic ("Q1 Memory design"), not "Q1"; each
   question can be answered without reading the Overview.
5. **A "Check answers" page before submit,** with a Change link per answer that returns to it.
   Source: https://design-system.service.gov.uk/patterns/check-answers/
   Rule for our pages: the Finish step lists each question title with the chosen option label
   and note, and a Change link per row.
6. **Save as the user goes; never ask for the same answer twice.**
   Sources: https://www.gov.uk/service-manual/design/form-structure ;
   https://design-system.service.gov.uk/patterns/question-pages/
   Rule for our pages: answers persist on each click (arena.html already uses localStorage).

## 6. Common failures and their fixes

| Failure | Evidence | Fix (testable) |
|---|---|---|
| Wall of text | F-pattern; 20% read (§1.2, §1.3) | Paragraph max 50 words; facts as 2-4 bullets |
| Evidence mixed with the ask | Inverted pyramid (§2.4) | Ask and pick first; scores in a table; process story in Details |
| Jargon and private terms ("seats", "grafts", "promotion") | NN/g experts left a page full of unknown terms, https://www.nngroup.com/articles/plain-language-experts/ ; WCAG 3.1.3 unusual words, https://www.w3.org/WAI/WCAG22/Understanding/unusual-words.html | One plain word, or define it at first use in at most 8 words |
| Ids without meaning (O-076, order 67, #138) | WCAG 3.1.4 abbreviations, https://www.w3.org/WAI/WCAG22/Understanding/abbreviations.html ; NN/g first 2 words (§1.5) | Every id has its meaning next to it: "order 67 (tonight only)" |
| Split panes that must be joined in the head | Split attention (§2.2) | Option trade-offs inside the option card |
| Uncalibrated recommendation | Anchoring, defaults (§3.4) | Pick line with confidence and "Pick another if" |
| Over-highlighting | Baymard 10%, NN/g hierarchy (§4.2, §4.3) | One callout; bold at most 10% |
| Long lines | Baymard, WCAG 1.4.8 (§2.6) | `max-width: 70ch` |

## 7. Arena Q1 against the rules

### 7a. Diagnosis

Measured from `arena/content.md` (word counts by script): What 146 words, Example 65, Why 67,
option A 86 (label 41), B 50, C 45. Total about 470 words: more than 2x the 200-word limit (§1.2).

| Rule | Status | Quote or fact |
|---|---|---|
| Ask first, at most 20 words (§2.4) | Fail | No ask line. The "What" starts with process: "Three seats designed the folder on your split (long-term in git, short-term not in git)." |
| Paragraph at most 50 words (§1.3) | Fail | "What" is one 146-word paragraph with 3 topics: the process, the scores, the Fable design. |
| Sentence at most 20 words (§2.7) | Fail | "The Fable design: one home for each fact (...); one file per owner order ...; a weekly restore drill by a reader with no context." is one sentence of about 79 words. |
| Numbers in a table (§1.6, §3.1) | Fail | 9 scores in prose: "Judge 1 (GPT-6 Astra) gave Fable 46, GPT-6 Astra 61, Opus 35. Judge 2 (Opus) gave Fable 61, GPT-6 Astra 45, Opus 57." The model name is both a judge and a design, so the reader must decode each number. |
| Labels say content (§1.4) | Fail | Block labels are "What", "Example", "Why this is the recommendation". |
| Option label at most 8 words (§3.3) | Fail | Option A label is 41 words: "Fable's design as the base, plus 8 grafts: GPT-6 Astra's scope and end per order, crash path and acceptance tests; ..." |
| Trade-offs next to the radio (§2.2) | Fail | Gain/Cost/Risk are in "Trade-offs and risks" at the bottom of the left pane, below the fold (q1.png); the right pane shows only labels. |
| Calibrated pick (§3.5, §3.7) | Fail | "the Fable design won on both judges' total" - the total margin is 1 point (107 vs 106), and judge 1 put Fable second, 15 points behind. No "pick another if". |
| Plain words, ids explained (§6) | Fail | "seats", "grafts", "your split", "promotion", "crash path", "O-076", "your order 67" appear without a meaning. |
| Line length at most 70ch (§2.6) | Fail | About 88 characters per line in the left pane (q1.png). |
| Examples as steps | Partial | The Example is concrete and good, but 65 words in 4 sentences of mixed times; steps with a time label scan faster. |
| One decision per step (§5.1) | Pass | One decision: the base design. |
| No pre-selected option (§3.4) | Pass | No radio is checked; the badge says "Recommended". |

### 7b. Proposed structure for one question

| Field | Where | Limit | Content |
|---|---|---|---|
| Title | left, top | 12 words, ends "?" | The decision as a question |
| Ask | left, line 1 | 20 words | "Decide: ..." and what the answer changes |
| My pick | left, the one callout | 25 words | Option letter + short name, main reason, confidence (clear / close call), "Pick another if ..." (15 words) |
| Key facts | left | 2-4 bullets, 15 words each | Bold lead words (2-4) carry the fact |
| Numbers | left | table, 2-5 rows | Only when there are more than 3 numbers |
| Example | left | 2-4 steps, 15 words each | Time or trigger label, then what happens |
| Details | left, collapsed | no limit | Process story, full lists, ids, sources |
| Option card | right | label 8 words | Letter, short name, Recommended badge, "Risk: low" chip |
| Gets / Costs / Risk | inside the card | 12 words each | Same 3 fields for every option |
| Option details | inside the card, collapsed | no limit | Full list of what the option contains |

Visible text target: left pane at most 220 words, right pane at most 160, before any Details.

### 7c. Arena Q1 rewritten (all facts kept)

**Left pane**

> **Which memory design do we build in the memory PR?**
>
> **Decide:** the base design for `.agents/memories/`. The memory PR builds it.
>
> > **My pick: A, Fable's design plus 8 fixes.** It is the most concrete design, and the
> > fixes close every gap the judges found. Confidence: close call on scores.
> > **Pick another if:** you want the strictest rules on which text is in force (B).
>
> - **Scores are a near tie:** Fable 107, GPT-6 Astra 106, Opus 92 (2 blind judges).
> - **Judge 1 may favor its own model:** it picked the GPT-6 Astra design; the Opus judge picked Fable.
> - **Both judges found 3 gaps:** scope and end of each order, urgent promotion, prompt injection.
>
> | Design | Judge 1 (GPT-6 Astra) | Judge 2 (Opus) | Total |
> |---|---|---|---|
> | Fable (A) | 46 | 61 | **107** |
> | GPT-6 Astra (B) | 61 | 45 | 106 |
> | Opus (C) | 35 | 57 | 92 |
>
> **Example: a new order, with design A**
> 1. **21:00:** you give an order. The chief writes your words and the time to short-term `inbox.md`.
> 2. **End of day:** a promotion PR moves it to long-term `orders/O-076.md`; the old order gets "Superseded by O-076".
> 3. **After the merge:** the chief deletes the inbox line.
> 4. **New computer:** the chief reads long-term memory from `origin/main` and knows O-076.
>
> ▸ **Details: the Fable design, the 8 fixes, and how the arena ran** (collapsed)
> - How it ran: 3 agents ("seats") each designed the folder on your split (long-term memory in
>   git, short-term not in git); 2 blind judges scored them.
> - The Fable design has 8 parts:
>   - One home for each fact: a promotion moves a fact; it does not copy it.
>   - One file per owner order, with Supersedes and Amends lines.
>   - A generated index.
>   - A small `state.md`.
>   - An `inbox.md` for new orders that are not on main yet.
>   - A memory worktree on `origin/main` (the main checkout is 32 merged PRs behind).
>   - The same ignore line in `.git/info/exclude`, so old branches cannot commit private files.
>   - A weekly restore drill by a reader with no context.
> - The 8 fixes ("grafts") that option A adds:
>   - From GPT-6 Astra: scope and end per order; a crash path; acceptance tests.
>   - From Opus: urgent promotion; fixed fields per file; auto-memory as an inbox.
>   - From judge 2: the injection rule; leaders push at each checkpoint.
> - Why scope and end matter: your order 67 was for "tonight" only.
> - Urgent promotion: merge, approval and privacy rules go to long-term memory at once.
> - Injection rule: only text merged to main by your account counts. An issue or a PR comment is
>   never an order.

**Right pane (one card per option)**

> **A. Fable base + 8 fixes** · Recommended · Risk: low
> - **Gets:** the best total score, with all gaps both judges found closed.
> - **Costs:** the largest first PR: about 25 files and 1 check script.
> - **Risk:** low. The restore drill report shows if something is missing.
>
> **B. GPT-6 Astra base** · Risk: medium
> - **Gets:** the strictest rules on which text is in force (pending, proposed, merged-and-verified).
> - **Costs:** more parts: `events.jsonl`, `runtime.json`, migrations. Judge 2: "over-engineered".
> - **Risk:** medium. A design that is hard to run gets skipped on busy nights.
>
> **C. Opus base, the smallest** · Risk: medium
> - **Gets:** the least work: one journal, rules as one-line index rows.
> - **Costs:** judge 1 found that its newest-date rule can hide an order that arrived late.
> - **Risk:** medium. A lost order shows only when the chief acts against it.

Measured by script (markdown symbols removed): before Details, about 206 words on the left,
table cells included (was 278 words of What, Example and Why prose). The option texts with
Gain/Cost/Risk are about 141 words (was 181), now all in the right-pane cards. The longest visible sentence is 17 words (was about 79). The 9 scores moved
to a table. The weak claim "won on both judges' total" became "close call on scores", with the
counter-case B named. The "split" fact moved to Details because all 3 options share it.
