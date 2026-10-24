# Create bot page

> **Status: agreed in the M2 Bots UI design review, round 9 (2026-10-23 and 2026-10-24),
> steps 4a (CS1–CS4), 4b (E1–E6) and CS4b–CS4c (tools).** Previews:
> `../previews/command-dark/create-bot.png` (CS1–CS4), `create-bot-errors.png` (E1–E6),
> `create-bot-tools.png` (CS4b, CS4c), `clone-bot.png` (CL1, CL2, step 4c). Requirements:
> `../../requirements/bots.md` UI-5. The colour row changed in step 5b (2026-10-24,
> `bot-avatar.md` §5).

**+ Create** on the Bots page, the header empty state ("Hey, add your bot here 👋") and the left
bar first run open this page. It is a page of its own, with no bot list. **← Back** returns to
the page the owner came from.

## 1. Layout

```
← Back   New bot     [1 Basics]──[2 Persona]──[3 Skills]──[4 Model]        (stepper)
┌──────────────────────────────────────┐  ┌────────────────────────────┐
│ Form of the current step             │  │ Live preview card          │
│                                      │  │  band, avatar, name, pill, │
│                                      │  │  description               │
│                                      │  │  Basics   · Edit           │
│                                      │  │  Persona  · Filling in     │
│                                      │  │  Skills   · Not filled yet │
│                                      │  │  Model    · Not filled yet │
└──────────────────────────────────────┘  └────────────────────────────┘
Step 2 of 4.                                              Back   Next / Create
```

- **Stepper:** four steps. Each step is a link: the owner can go back to any step, and forward
  to a step when all the steps before it are valid. A finished step shows ✓. A step with an
  error shows a red "!" (E3).
- **Form** on the left, **live preview card** on the right. The card changes while the owner
  types. Its top part is how the bot looks in the header, the lists and conversations.
- **Footer:** "Step n of 4." on the left; Cancel (step 1) or Back, then Next, at the far right
  (`buttons.md`). Step 4 has **Create** in place of Next.
- There is **no Review step**. The preview card is the review, with one Edit link per section.

## 2. Steps

### Step 1 · Basics (CS1)

| Field | Rules |
| --- | --- |
| Name | 1–32 characters, counter "12 / 32". Hint: "A short role name. You see it in the header, in mentions and in the status." Unique among bots, Trash included; upper and lower case are the same |
| Description | 1–160 characters, a 3-line box, counter. Hint: "What the bot does and when to ask it, in one line. Other bots read it to choose who helps." (D18) |
| Avatar style | 4 cards: **Flat** (default), Jelly, Pixel, + Upload image. The cards show the chosen colour. Upload uses the crop card (`bot-avatar.md` §6; upload rules in `../../security.md` §2.4) |
| Colour | The colour row of `bot-avatar.md` §5: 10 swatches from the theme, **Custom** and **Random**. The default is a random swatch that no other bot uses. Used colours are not shown |

### Step 2 · Persona (CS2)

One field: **Persona**, 1–8,000 characters, Write / Preview tabs (Markdown), counter. Hint: "Who
the bot is, its goal, how it works and its rules. The bot reads it in every run. Put long
procedures in skills." An empty box shows the persona template as placeholder: role, goal,
steps, rules with reasons, output, example.

### Step 3 · Skills (CS3)

Optional. Rows in the bot-list card pattern: tick box, name, description, latest version, and a
search box. A ticked row moves to the top and shows the **Always load** switch, off by default
(D16). The list has a fixed height of about 7 rows and scrolls inside the card. Deprecated skills
are not in the list. Each ticked skill gets its latest version.

Loading: one `GET /skills` returns every skill with name, description and latest version (no
bodies, no paging). The search filters in the browser.

### Step 4 · Model (CS4, CS4b, CS4c)

In this order:

1. **Model** menu, grouped by provider. A model with no API key is grey with the reason and an
   "Add a key" link to Settings. **Effort** menu, only when the model has efforts, set to
   `default_effort`. Note under both: "You cannot change the model or the effort after you
   create the bot. To use another one later, clone the bot." (D7)
2. **Tools** (§3).
3. **Advanced**, always open, with no chevron:

   | Field | Default | Rule |
   | --- | --- | --- |
   | History: {n} % of context | 40 % | Slider 10–80 %, step 5, with the live label "≈ 400k tokens of 1M. 600k are left for work." (D32) |
   | Model requests per run | 30 | A run stops at this number of model calls |
   | Longest reply | 6,000 | In characters. A longer reply is cut |

The defaults are settings (`../../domain-model.md` §10), not numbers in the code.

## 3. Tools list (CS4b, CS4c)

One list, under the title **Tools**, with no legend line: the badges say what each tool is (owner,
2026-10-24). Until provider tools work, a dashed chip "{Provider} tools: later milestone" sits at
the right of the title. Each row has a switch, the tool name, a badge,
and one line that says what the tool does, what it costs, and what changes when it is off.

| Badge | Meaning | Default |
| --- | --- | --- |
| **Internal** | Run by this app | On |
| **{Provider}** (for example Anthropic) | Run on the provider's servers | Off |

**Order:** tools with only the Internal badge, then tools that both can do (§3.1), then
provider-only tools. Inside each group, by the date the tool was added to the catalog, oldest
first. An amber ⚠ marks a tool that can send data out of the app.

Internal tools (phase 1):

| Tool | Line | When off |
| --- | --- | --- |
| Files | List, read and write files in the conversation Library | The bot only talks. View images and Hand off turn off too |
| View images | Look at PNG, JPEG and WebP files in the Library | Grey and off when the model does not read images (catalog flag `reads_images`) |
| Skills | Load a skill when it needs one. Draft a new skill for you to approve | Only skills set to Always load reach the bot |
| Hand off | Ask you to pass files to another bot | |
| Memory | Remember and update facts, with Undo | The bot still reads memory, but cannot save |

Provider tools come from the catalog for the chosen model (`../../domain-model.md` §4). For an
Anthropic model today: Web search, Web fetch, Code execution (⚠), MCP connector (⚠), Advisor,
Tool search. Until a model is picked, the list says "Provider tools show here after you pick a
model". Provider tool switches work from the milestone that builds them (D53, D55); until then
the rows show "later milestone" and stay off.

### 3.1 A tool that both can do (CS4c)

When the app has an internal tool for a job that a provider tool also does, the catalog gives both
tools the same **job** name. The list shows **one row** for the job, with both badges and a
choice **Off · Internal · {Provider}**. Only one can be on, so a run never gets two tools for one
job (D55).

## 4. Preview card

| Part | Content |
| --- | --- |
| Top | Band (a plain fade of the bot colour, `bot-page.md` §5) and avatar in the chosen style and colour, name, pill, description |
| Pill | "Not created yet"; "Ready to create" when every step is valid; "Creating" while sending |
| Sections | Basics, Persona (first 3 lines), Skills (ticked skills with version and "always load"), Model (model, effort, Advanced values) |

| Section state | Look |
| --- | --- |
| Current step | `primary` tag "Filling in" |
| Done | The values and an Edit link |
| Not reached | Faded, "Not filled yet" |
| Has an error | Red (!) icon, no text (E3) |

## 5. Errors and sending (E1–E6)

| Card | When | What the owner sees |
| --- | --- | --- |
| E1 | A field is wrong | A red message under the field, with the fix in the words. A size error shows at once (the counter turns red). A taken name shows when the owner leaves the field, checked against the bot list that the page has. An empty required field shows after Next. Next stays on: a click with errors keeps the owner on the step and moves focus to the first error |
| E2 | Persona over the limit | The owner can keep typing (nothing is cut). "Too long by {n} characters. Move long procedures into a skill." Empty: "Write a persona. The bot needs it to work." after Next |
| E3 | The server finds problems on Create | Nothing is created and the input stays. Steps with a problem get a red "!" in the stepper; their preview sections get a red (!) icon. A click opens that step, where the message is under the field. Create is off (40 %) until they are fixed |
| E4 | Sending | Create is off with a spinner and "Creating". Back is off and the form is read-only. The preview card has no current section and no Edit links; its pill says Creating. A double click sends one request |
| E5 | Create failed (no connection, server error) | A red banner under the stepper: "Could not create the bot. The app could not reach the server. Your input is kept." and Try again. No stack trace and no internal text. Try again sends the same request with the same retry key, so a retry never makes two bots (`../../api.md` §4) |
| E6 | Leave with input | Cancel, ← Back, the rail or a header bot opens "Leave without creating? {name} is not created. What you typed in the 4 steps is lost." with Stay and **Leave** (`danger`). Esc = Stay. With nothing typed, the owner leaves at once. No draft is saved. The browser's own question covers a closed tab or a reload |

The limits (name 32, description 160, persona 8,000, history 10–80 %) are settings with these
defaults (`../../domain-model.md` §10).

After a successful Create, the bot page opens on the Profile tab with a toast.

## 6. Clone (CL1, CL2)

**Clone** (the bot ⋯ menu, or the banner of a bot
that cannot run) opens this page filled from `GET /bots/{id}/clone-template` (UI-4.4).

- **CL1, normal clone.** The page opens on **step 4, Model**, because a change of model is the
  usual reason to clone (BT-3). Every step shows ✓, so **Create** works at once. A banner under
  the stepper says **Cloning {name}**, "Everything is copied, with the same skill versions and
  tools. Two things are new: bot memory starts empty, and the colour is a free one.", and the
  link **Open {name}** (UI-5.4).
- **Copied:** description, avatar style (and the uploaded image), persona, skills with the same
  versions and Always load, tool switches, Advanced values, model and effort. **New:** the name
  "{name} (copy)", a colour that the page picks by the default rule (`bot-avatar.md` §5), and empty bot memory.
- Model and effort can change here, because this is a new bot.
- Cancel or Leave creates nothing (E6).
- **CL2, the model is gone.** For a bot that cannot run because its model is no longer offered,
  the banner says "{name} cannot run: its model is no longer offered. Pick a new model.
  Everything else is copied." The Model field starts empty with the error under it ("{model} is
  no longer offered. Pick another model."), step 4 has the red "!" and the preview Model section
  the red (!) (E1, E3). Effort is off until a model is picked. The Tools list shows only internal
  tools until then. Create is at 40 % until a model is picked.
- **A skill version in Trash** (D49): that skill row on step 3 shows the red "!", and the owner
  picks another version or unticks it.
