# Decision pages: research and rules (2026-11-19)

Purpose: make quiz pages for a decision (left pane = question, right pane = options) easy to scan and
decide. Each finding has its source and its rule. When `SKILL.md` or `content-format.md` holds the
rule, the "Rule for our pages" line only points there, so each rule has one home. Section 7 gives
the structure of one question.

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
   Rule for our pages: see R1.2 in `SKILL.md` and the limits table of `content-format.md`.
3. **A dense block of text causes the F-pattern:** the eye reads the first lines, then only the
   left edge, and misses facts at the right or lower in a line. Fixes: key points first, headings,
   bullets, bold key terms, cut text.
   Source: https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/
   Rule for our pages: see R1.3 in `SKILL.md` and the limits table of `content-format.md`.
4. **Clear headings give the "layer-cake" pattern,** the most efficient scan: the eye jumps from
   heading to heading and reads only the sections it needs. Headings must describe only their
   section, with the important words first.
   Source: https://www.nngroup.com/articles/layer-cake-pattern-scanning/
   Rule for our pages: see R1.4 in `SKILL.md` and the limits table of `content-format.md`.
5. **Readers often see only the first 2 words (about 11 characters) of a list item or heading.**
   For 35% of tested links, those characters gave no idea of the target.
   Source: https://www.nngroup.com/articles/first-2-words-a-signal-for-scanning/
   Rule for our pages: an option label starts with its key fact, in 2-3 words. For facts and list
   items, see R1.5 in `SKILL.md`.
6. **Numerals stop the scanning eye;** spelled-out numbers do not.
   Source: https://www.nngroup.com/articles/web-writing-show-numbers-as-numerals/
   Rule for our pages: see R1.6 in `SKILL.md` and the warnings of `content-format.md`.

What this means for a decision page: the reader reads the title, the first line and the bold words.
Everything that decides the answer must be in those places.

## 2. Cognitive load, chunking, disclosure, BLUF, text length

1. **Working memory holds about 4 chunks** (Cowan 2001, revising Miller's 7 plus or minus 2).
   Source: https://doi.org/10.1017/S0140525X01003922 (abstract: https://pubmed.ncbi.nlm.nih.gov/11515286/)
   Rule for our pages: see R2.1 in `SKILL.md` and the limits table of `content-format.md`.
2. **Extraneous load (effort spent on the format, not the problem) lowers performance**
   (Sweller 1988, cognitive load theory). **Split attention** is one cause: the reader must join
   separated sources in the head (Chandler & Sweller 1991).
   Sources: https://doi.org/10.1207/s15516709cog1202_4 ; https://doi.org/10.1207/s1532690xci0804_2
   Rule for our pages: see R2.2 in `SKILL.md`.
3. **Mayer's principles: coherence** (remove material that is not needed), **signaling** (mark the
   essential words), **spatial contiguity** (put related items near each other).
   Source: Mayer 2008, American Psychologist 63(8), https://doi.org/10.1037/0003-066X.63.8.760
   (index: https://pubmed.ncbi.nlm.nih.gov/19014238/)
   Rule for our pages: see R2.3 in `SKILL.md`.
4. **Inverted pyramid / BLUF: the conclusion first,** then detail in order of importance;
   "the first sentence of every paragraph should be the most important."
   Source: https://www.nngroup.com/articles/inverted-pyramid/
   Rule for our pages: see R2.4 in `SKILL.md` and the limits table of `content-format.md`.
5. **Progressive disclosure:** show the core first, the rest on request; keep to 2 levels; the
   label of the hidden part must say what is inside. GOV.UK: use a Details element for content
   that only some users need, never for content most users need.
   Sources: https://www.nngroup.com/articles/progressive-disclosure/ ;
   https://design-system.service.gov.uk/components/details/
   Rule for our pages: see R2.5 in `SKILL.md`.
6. **Line length 50-75 characters; WCAG AAA max 80.** Long lines look "intimidating", readers
   lose their place and skip; 100+ characters causes fatigue.
   Sources: https://baymard.com/blog/line-length-readability ;
   https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html
   Rule for our pages: see R2.6 in `SKILL.md`.
7. **Short sentences and paragraphs.** GOV.UK: split sentences over 25 words, max 5 sentences per
   paragraph. NN/g: 15-20 words per sentence, even for experts. W3C COGA: split any paragraph over
   50 words, one topic per paragraph, lists for 3 or more items. ASD-STE100 (a controlled-language
   standard): max 20 words in a procedural sentence, 25 in a descriptive sentence. The GOV.UK blog also
   quotes comprehension figures (14 words: over 90%; 43 words: under 10%) from a weaker,
   non-peer-reviewed source; use them only as a hint.
   Sources: https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/ ;
   https://www.nngroup.com/articles/plain-language-experts/ ;
   https://www.w3.org/TR/coga-usable/#keep-text-succinct-pattern ; https://www.asd-ste100.org/ ;
   https://insidegovuk.blog.gov.uk/2014/08/04/sentence-length-why-25-words-is-our-limit/
   Rule for our pages: see R2.7 in `SKILL.md` and the limits table of `content-format.md`.
8. **Experts also prefer plain language.** 80% of people preferred clear English, more so for
   complex topics; NN/g's expert users called dense pages "crazy dense" and wanted less.
   Sources: as in item 7 (GOV.UK clear language; NN/g plain language for experts)
   Rule for our pages: see R2.8 in `SKILL.md`.
9. **Recognition rather than recall.** "Minimize the user's memory load by making elements,
   actions, and options visible." "The user should not have to remember information from one
   part of the interface to another." (Nielsen, heuristic 6, 1994, last reviewed 2024).
   "Recognition is easier than recall because it involves more cues" (Budiu, NN/g, 2024).
   Sources: https://www.nngroup.com/articles/ten-usability-heuristics/ ;
   https://www.nngroup.com/articles/recognition-and-recall/
   Rule for our pages: see R2.9 in `SKILL.md`.

## 3. Presenting a decision with options

1. **Display format changes the decision strategy** (form, organization and sequence of the
   information shift the accuracy-effort trade-off). A matrix makes comparing one attribute
   across options easy; prose forces the reader to build the matrix in the head.
   Source: Kleinmuntz & Schkade 1993, Psychological Science 4(4),
   https://doi.org/10.1111/j.1467-9280.1993.tb00265.x
   Rule for our pages: when options differ on numbers (files, minutes), show a table with one row
   per option.
2. **Comparison tables: about 5 items or fewer, the same attributes for every item, short cells,
   hide rows where all items are equal.** "If the information isn't complete for all compared
   products, it might as well not be in a comparison table."
   Source: https://www.nngroup.com/articles/comparison-tables/
   Rule for our pages: see R3.2 in `SKILL.md` and the `options` rows of `content-format.md`.
3. **Choice overload depends on task difficulty and option complexity more than on count.** The
   2010 meta-analysis found a mean effect near zero; the 2015 meta-analysis (99 observations,
   N=7202) found overload when the task is hard, options are complex, preferences are unclear, or
   the person wants to save effort.
   Sources: Scheibehenne et al. 2010, https://doi.org/10.1086/651235 ;
   Chernev, Böckenholt & Goodman 2015, https://doi.org/10.1016/j.jcps.2014.08.002
   Rule for our pages: see R3.3 in `SKILL.md` and the limits table of `content-format.md`.
4. **Defaults and recommendations move choices strongly** (meta-analysis of 58 studies, d = 0.68),
   most when they signal endorsement. **Anchoring:** the first value seen pulls the judgment
   toward it.
   Sources: Jachimowicz et al. 2019, https://doi.org/10.1017/bpp.2018.43 ;
   Tversky & Kahneman 1974, https://doi.org/10.1126/science.185.4157.1124
   Rule for our pages: see R3.4 in `SKILL.md`.
5. **Telling people about a default does not remove its effect,** so disclosure is honest and
   costs nothing.
   Source: Bruns et al. 2018, Journal of Economic Psychology 65, https://doi.org/10.1016/j.joep.2018.02.002
   Rule for our pages: see R3.5 in `SKILL.md`.
6. **A decoy (an option that is worse than the target in every way) shifts choice to the target.**
   Source: Huber, Payne & Puto 1982, https://doi.org/10.1086/208899
   Rule for our pages: see R3.6 in `SKILL.md` and the warnings of `content-format.md`.
7. **People judge only from what they see** ("what you see is all there is", Kahneman, *Thinking,
   Fast and Slow*, 2011, ISBN 978-0374275631). The reader cannot weigh a counter-argument that the
   page does not show.
   Rule for our pages: see R3.7 in `SKILL.md` and the limits table of `content-format.md`.

## 4. Visual hierarchy and highlighting

1. **Pre-attentive attributes (color, size, position, form) are seen in under a moment, before
   reading,** and they are not equal in strength.
   Sources: Healey & Enns 2012, IEEE TVCG 18(7), https://doi.org/10.1109/TVCG.2011.127 ;
   Few 2004, https://www.perceptualedge.com/articles/ie/visual_perception.pdf
   Rule for our pages: see R4.1 in `SKILL.md`.
2. **Hierarchy comes from contrast, size and grouping; "if everything is contrasted, then nothing
   stands out."** Max 3 type sizes, max 3 contrast treatments; test with a blur ("squint test").
   Source: https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
   Rule for our pages: a 5 px blur of a question screenshot still shows, in order: title, ask, pick,
   options (`SKILL.md` step 10 has the check for a report page).
3. **Highlight sparingly:** Baymard says at most 10% of text; NN/g says at most 30% and never bold
   for tone. The fewer the highlights, the more attention each gets.
   Sources: https://baymard.com/blog/highlighting-text-online ;
   https://www.nngroup.com/articles/formatting-long-form-content/
   Rule for our pages: see R4.3 in `SKILL.md` and the limits table of `content-format.md`.
4. **Signals help memory for the signaled content only** (titles, headings, previews,
   typographic cues); unsignaled content gains nothing.
   Source: Lorch 1989, Educational Psychology Review 1(3), https://doi.org/10.1007/BF01320135
   Rule for our pages: see R4.4 in `SKILL.md`.
5. **Do not use color alone to carry meaning.**
   Source: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
   Rule for our pages: see R4.5 in `SKILL.md`.
6. **Callouts and summaries at the top need a distinct heading and look.**
   Source: https://www.nngroup.com/articles/formatting-long-form-content/
   Rule for our pages: see R4.6 in `SKILL.md`.

## 5. Progress and flow in multi-step pages

1. **One thing per page** (one decision or one question) helps people understand the ask and
   lets the service save answers as they go.
   Sources: https://www.gov.uk/service-manual/design/form-structure ;
   https://design-system.service.gov.uk/patterns/question-pages/
   Rule for our pages: see R5.1 in `SKILL.md`.
2. **The page heading is the question;** hint text is one short sentence.
   Source: https://design-system.service.gov.uk/patterns/question-pages/
   Rule for our pages: see R5.2 in `SKILL.md` and the `page.subtitle` row of `content-format.md`.
3. **Progress indicators are often not noticed,** take space and can confuse; GOV.UK says test
   without one first. Survey meta-analysis (32 experiments): a constant progress bar did not
   reduce drop-off; slow-then-fast bars increased it.
   Sources: https://design-system.service.gov.uk/patterns/question-pages/ ;
   Villar, Callegaro & Yang 2013, https://research.google/pubs/where-am-i-a-meta-analysis-of-experiments-on-the-effects-of-progress-indicators-for-web-surveys/
   Rule for our pages: the numbered stepper marks the current step and each answered question,
   next to the Total, Answered and Remaining counts; there is no progress bar.
4. **Wizards suit rare, unfamiliar tasks; name each step by what the user does; mark completed
   steps; let users leave and resume.** Each step must be self-sufficient.
   Source: https://www.nngroup.com/articles/wizards/
   Rule for our pages: see R5.4 in `SKILL.md` and the limits table of `content-format.md`.
5. **A "Check answers" page before submit,** with a Change link per answer that returns to it.
   Source: https://design-system.service.gov.uk/patterns/check-answers/
   Rule for our pages: see R5.5 in `SKILL.md`.
6. **Save as the user goes; never ask for the same answer twice.**
   Sources: https://www.gov.uk/service-manual/design/form-structure ;
   https://design-system.service.gov.uk/patterns/question-pages/
   Rule for our pages: see R5.6 in `SKILL.md`.

## 6. Common failures and their fixes

| Failure | Evidence | Fix (testable) |
|---|---|---|
| Wall of text | F-pattern; 20% read (§1.2, §1.3) | Paragraph max 50 words; facts as 2-4 bullets |
| Evidence mixed with the ask | Inverted pyramid (§2.4) | Ask and pick first; R1.6 and R3.1 decide when numbers need a table; process story in Details |
| Jargon and private terms ("seats", "grafts", "promotion") | NN/g experts left a page full of unknown terms, https://www.nngroup.com/articles/plain-language-experts/ ; WCAG 3.1.3 unusual words, https://www.w3.org/WAI/WCAG22/Understanding/unusual-words.html | One plain word, or define it at first use in at most 8 words |
| Context only in the author's head: the page names a change but not the old and new words, or a rule but not its purpose | Recognition rather than recall (§2.9) | The overview says what happened; a choice about words quotes both versions; each question screen passes a test by a new session alone |
| A question about something already settled, or an option that defends the author's own change | Owner, 2026-11-24: two rejected pages; on one of them a reader of the page alone missed it, and a reader of the sources found it | Fields `owner`, `settled`, `decides`, `removed`; a source review by a reviewer of the same or a stronger model |
| Ids without meaning (REQ-14, order 12, #42) | WCAG 3.1.4 abbreviations, https://www.w3.org/WAI/WCAG22/Understanding/abbreviations.html ; NN/g first 2 words (§1.5) | Every id has its meaning next to it: "order 12 (for this week only)" |
| Split panes that must be joined in the head | Split attention (§2.2) | Option trade-offs inside the option card |
| Uncalibrated recommendation | Anchoring, defaults (§3.4) | Pick line with confidence and "Pick another if" |
| Over-highlighting | Baymard 10%, NN/g hierarchy (§4.2, §4.3) | One callout; bold at most 10% |
| Long lines | Baymard, WCAG 1.4.8 (§2.6) | `max-width: 70ch` |

## 7. The structure of one question

### 7b. Proposed structure for one question

The word limits of each field are in the limits table of `content-format.md`; this table gives
only the place and the content.

| Field | Where | Content |
|---|---|---|
| Title | left, top | The decision as a question, ends with "?" |
| Ask | left, line 1 | "Decide: ..." |
| Scope | left, under the ask | `why`, `decides`, `owner` and `settled` (see the fields of `content-format.md`) |
| My pick | right, above the options; the one callout | Option letter + short name, main reason, confidence (clear / close call), "Pick another if ..." |
| Key facts | left | 2-4 bullets; bold lead words carry the fact |
| Numbers | left | A table (R1.6, R3.1) |
| Example | left | 2-4 steps: time or trigger label, then what happens |
| Details | left, collapsed | Process story, full lists, ids, sources |
| Option card | right | Letter, short name, "My pick" tag, "Risk: low" chip |
| Does / Gets / Costs / Risk | inside the card | Same 4 fields for every option |
| Option details | inside the card, collapsed | Full list of what the option contains |

Visible word limits: the context words and the option words before any Details (R1.2, the limits
table of `content-format.md`).
