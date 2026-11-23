# Content format for decision pages

A page comes from one JSON file. `scripts/gen.mjs` reads it, checks the shape and the limits, and
writes one self-contained HTML file. You write text only: no HTML. The kit escapes all text.

## Inline markup

Two marks only, in every text field:

- `` `code` `` for file names, commands, ids and exact values. A code span counts as 1 word.
  A span of 48 characters or less does not wrap.
- `**bold**` for the lead words of a fact or a list item. Use nothing else.

Any other character prints as text. `<b>`, Markdown links and headings print as written.

## File shape

```json
{
  "page": { "title": "...", "date": "YYYY-MM-DD", "subtitle": "...", "storageKey": "..." },
  "overview": { "heading": "...", "lead": "...", "blocks": [ ... ] },
  "questions": [ { ... }, { ... } ]
}
```

| Field | Required | What it is |
|---|---|---|
| `page.title` | yes | The page name in the top bar and the browser tab, 2-4 words. |
| `page.date` | no | Shown next to the title and in the copied answers. |
| `page.subtitle` | no | One grey line on the overview: the scope or source. |
| `page.storageKey` | yes | A unique key for the saved answers. Use a new key for each page. |
| `overview.heading` | yes | The overview title: what the page is and how many questions. |
| `overview.lead` | no | The bottom line first: the state and the main finding, at most 30 words. |
| `overview.blocks` | no | Status blocks (below). The kit adds a table of all questions and picks. |
| `questions` | yes | The question steps, in order. An empty list makes a report page: the overview alone, with no steps and no answers. |

### Overview blocks

Each block has `type`, `title` and `place` (`left`, `right` or `full`; default `full`).
Give the title the finding, not the type: "A leads each round; round 2 by 1", not "Chart".

| `type` | Extra fields |
|---|---|
| `text` | `paragraphs`: list of strings. |
| `list` | `items`: list of strings. Start each item with `**lead words:**`. |
| `table` | `columns`, `rows` (list of lists), `align` (`"left"` or `"right"` per column; numbers right), `note`. |
| `bars` | `max` (the scale end), `groups`: `[{ "label", "note", "bars": [{ "label", "value", "highlight" }] }]`, `alt`. |

Use `bars` only when the chart shows real status that a table cannot show at a glance. Bars
start at 0. Mark one series with `"highlight": true`; it takes the one accent colour, and
every bar has a direct label, so the chart needs no legend.

### One question

```json
{
  "topic": "Cache design",
  "title": "Which cache design do we build first?",
  "ask": "the cache design for the build server. The next PR builds it.",
  "why": "Every build reads this cache, so a wrong design slows every build.",
  "pick": { "key": "A", "reason": "...", "confidence": "close call", "another": "you want the smallest first PR (B)." },
  "facts": ["**A near tie:** design A scored 107, design B 106, design C 92.", "..."],
  "table": { "title": "Scores per reviewer (max 70 each)", "columns": ["Design", "Reviewer 1", "Reviewer 2", "Total"],
             "align": ["left", "right", "right", "right"], "rows": [["A", "46", "61", "**107**"], ["..."]] },
  "example": { "title": "a cold build, with design A", "steps": [{ "when": "09:00", "text": "..." }] },
  "options": [
    { "key": "A", "label": "Shared cache with 8 fixes", "gets": "...", "costs": "...",
      "risk": "low", "riskText": "...", "details": { "summary": "What A contains", "items": ["..."] } }
  ],
  "details": { "summary": "Details: the 8 fixes and how we scored", "items": ["...", ["sub item", "sub item"]] }
}
```

| Field | Shown as | Notes |
|---|---|---|
| `topic` | The step button, after the number | 1-3 words, at most 16 characters. |
| `title` | The page heading | The decision as a question. Ends with `?`. |
| `ask` | First line: **Decide:** + your text | Write the text that follows "Decide:". |
| `why` | One grey line under the ask | Why the answer matters: what it changes. One sentence. |
| `pick` | The one coloured box, above the options | `key` names an option. `reason` is the main reason. `confidence` is `clear` or `close call`. `another` completes "Pick another if: ..." and names the other letter. |
| `facts` | 2-4 bullets | Each starts with 2-4 bold lead words that carry the fact. |
| `table` | A table under the facts | Optional. Use it when the facts hold more than 3 numbers. 2-5 rows. |
| `example` | Ordered steps with a time or trigger label | `title` completes "Example: ...". 2-4 steps. |
| `options` | One card per option | 2-4 options. Every option has every field. `risk` is `low`, `medium` or `high`. |
| `options[].details` | A closed "What A contains" | Optional. The full list of what the option holds. |
| `details` | One closed section at the end | Optional. The story, full lists, ids and sources. Nothing that changes the choice. |

In `details.items`, a list inside the list is a sub-list of the item before it.

The kit numbers the questions Q1, Q2, ... in file order. Option keys are single capital letters.
Put the options in the order that reads best; the pick does not need to be first. No option
is pre-checked.

## Limits

`scripts/gen.mjs` refuses a page that breaks a limit (pass `--allow-lint` for a draft). `scripts/verify.mjs`
fails it. The source for each limit is the rule id in `research.md` (next to this file).

| Limit | Value | Rule |
|---|---|---|
| Title | 12 words, ends with `?` | R5.2 |
| Topic | 3 words, 16 characters | R5.4 |
| Ask (lead sentence) | 20 words | R2.4 |
| Why | 25 words, 1 sentence | R5.2 |
| Pick reason | 25 words | R7b |
| Pick another if | 15 words | R3.7 |
| Facts | 2-4 bullets, 15 words each, bold lead of 2-4 words | R2.1, R7b, R1.5, R4.3 |
| Table | 2-5 rows, every row as wide as the header | R3.2 |
| Example | 2-4 steps, 15 words each, label 3 words | R7b |
| Options | 2-4 | R3.3 |
| Option label | 8 words | R3.3 |
| Gets, Costs, Risk text | 12 words each | R7b |
| Visible context words (title to details label, table cells included) | 220 | R1.2 |
| Visible option words | 160 | R1.2 |
| Any visible sentence | 20 words (a semicolon list is one sentence) | R2.7 |
| A sentence inside Details | 25 words | R2.7, STE |
| A paragraph or bullet | 50 words | R1.3 |
| Bold words | 10% of the visible context words | R4.3 |
| Overview lead | 30 words | R2.4 |
| Block title, table title, example title, details label | 8 words | R1.4 |

Warnings do not stop a build. Read each one and fix it, or keep it for a reason you can say:

- An option whose gain is "No work", "None" or "Nothing" (R3.6: a decoy pushes the reader to
  the pick). Name its real case, or remove the option and say so in the details.
- Facts with more than 3 data numbers and no table (R1.6).
- An unbalanced backtick or `**`.

## Commands

```bash
node scripts/gen.mjs content.json page.html            # check, then write the page
node scripts/gen.mjs content.json page.html --allow-lint   # a draft over the limits
NODE_PATH=<node_modules with @playwright/test> node scripts/verify.mjs content.json page.html [--out dir] [--name prefix]
```

`scripts/verify.mjs` writes four screenshots next to the page: `<name>-overview.png`, `<name>-q1.png`,
`<name>-finish.png` and `<name>-q1-dark.png`.
