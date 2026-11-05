---
name: using-the-app
description: What this app is, its words, and how to do each task in it. Use it for every question about how the app works, where something is, or what to do next.
---

# Using the app

This is what you know about the app. You know only what this page says. You cannot see the
owner's screen or data. If the page does not answer a question, say so, and say where the owner
can look.

## What the app is

The app runs on the owner's own computer. One person, the owner, works with AI bots. Each bot
has a role, for example BA (business analyst) or Designer. The owner gives each bot skills:
written ways of working that the bot follows.

## The words

- **Bot**: an AI helper with a name, a persona, an avatar, a model and skills.
- **Persona**: who the bot is and how it works. The owner can edit it.
- **Model** and **effort**: the AI model the bot uses, and how hard it thinks. Both are fixed
  when the bot is made. To try another model, clone the bot.
- **Skill**: a named Markdown playbook. Each save of its description or text makes a new
  version: v1, v2, … A change of the name only does not.
- **Pin**: the skill version a bot uses. A new skill version never moves a pin by itself. The
  owner upgrades each bot when they want.
- **Always load**: the skill is in the bot's prompt on every run. When it is off, the bot loads
  the skill only when it needs it.
- **Deprecated**: a skill that cannot be added to a bot any more. Bots that have it keep it.
- **Trash**: deleted items wait here for 30 days (a setting), then go for good. The app has no
  Trash page yet. Before the 30 days end, the owner can restore an item from a terminal in the
  app's folder: `pnpm --filter backend cli skills restore <slug>` for a skill, or
  `pnpm --filter backend cli bots restore <slug>` for a bot. `cli skills trash` and
  `cli bots trash` list what is in Trash.

## What the owner can do now

- **Skills page**: make a skill, edit it (a Save of the description or text makes a new version;
  a rename alone does not), see its history and compare two versions, restore an old version,
  clone it, deprecate it, and delete a deprecated skill to Trash. Import and export `SKILL.md` folders as a zip.
  An import marks a `SKILL.md` as invalid if the file is over 1 MB or its frontmatter has more than 8,192 characters.
- **Secrets in text**: the app does not save a skill or a bot's text if the text looks like a secret,
  such as a password or an API key with its value. This also applies to a placeholder password.
  The name of a setting with no value is fine, and so is a reference such as `${DB_PASSWORD}` or a
  type such as `password: string`. Remove the value, and save again.
  An import keeps a file that is the same as the saved version as `unchanged`, with no refusal.
- **After a skill save**: "Save as v2" offers to upgrade the bots that use an older version
  (all ticked; untick a bot to keep its version). An upgrade keeps each bot's Always load.
  Creating a skill offers to add it to bots (none ticked). Skip changes nothing.
- **A skill's Bots tab**: see which bots use the skill and at which version, upgrade a bot to the
  newest version, turn Always load on or off, change the version, remove the skill from a bot,
  or add it to another bot.
- **Bots page** (owner menu → Manage bots, or `/bots`): every bot as a card with its model,
  counts and status. Search by name, description or model. Pin a bot with the pin on its card:
  pinned bots come first, here and in the header; drag pinned cards to change their order (or
  Alt+← and Alt+→). Sort the other bots by recent activity or by created time, up or down. The
  ⋯ menu on a card has Details, Clone and Delete; Delete puts the bot in Trash. A click on a
  card opens the bot page.
- **The bot page** (`/bots/<slug>`): the list of bots on the left (pin, unpin and reorder the
  pinned bots there as on the Bots page), the bot on the right, with its model and effort under
  a lock (they never change; Clone picks another). A bot that cannot
  run shows why, with Clone. Tabs:
  - **Profile**: the avatar style and colour, the name, the description and the persona. The big
    avatar and the colour band show a change at once ("Not saved"); Save (or Ctrl+S) applies it
    from the bot's next run. Discard drops the changes.
  - **Skills**: the bot's skills, the version each uses and Always load. "v3 available" opens
    the changes and Upgrade; the ⋯ menu has Change version (any version, also an older one) and
    Remove; + Add gives the bot more skills at their latest version. Changes save at once:
    a removed skill goes from the list at once and comes back with a message if Remove fails.
    While a change of a skill is on its way, the switch, the link and the ⋯ menu of that row are
    off for a moment, until the list shows the change; the same holds on a skill's Bots tab.
  - **Model**: the tools and Advanced (history share, model requests per run, longest reply),
    with their own Save. One tab saves at a time: while the Profile save is on its way, the
    Model Save is off ("Wait until the Profile tab is saved."), and the other way round.
  - **Activity** and **Usage**: empty until bots can talk (conversations come later).
  If the same bot changes in another browser tab while you edit, the page keeps your text and
  says so; copy what you need, then Discard to load the new values. If you Discard or leave
  while a Save is on its way and that Save fails, a message says so.
- **The header**: the bots' avatars at the top of every page, pinned first. Hover an avatar for
  its name and status; click it for the bot card, with Pin and the settings gear. Drag an avatar
  onto the pinned zone to pin it, or out of it to unpin it. With many bots, scroll the header
  sideways or use ‹ and ›; the "+N" chip at the right opens a list of every bot with a search,
  and a click on a bot there shows it in the header with its card. A red "!" on an avatar means the bot cannot run, for example because
  its model has no API key.
- **Make a bot** (+ Create on the Bots page, or the "+" in an empty header): four steps, with a
  live preview card on the right. 1 Basics: name, description, avatar (Flat with a colour, or
  upload an image and crop it). 2 Persona: who the bot is and how it works. 3 Skills: tick
  skills, each at its latest version, and set Always load. 4 Model: the model and effort (fixed
  after Create), the tools, and Advanced (history share, model requests per run, longest
  reply). Create is on step 4. If the app cannot reach the server, Try again sends the same
  request, so it never makes two bots.
- **Clone a bot** (⋯ → Clone on its card): the Create form opens on step 4 with everything
  copied: persona, skills at the same versions, tools and Advanced. The name gets "(copy)" and
  the colour is a free one; bot memory starts empty. Change the model or the effort here: this is
  the way to try a bot on another model.
- **Example content**: `make seed` adds example skills and three bots: Guide (you), BA and
  Designer.

## Not built yet

These parts come in later versions of the app. If the owner asks about them, say that they are
not in the app yet. Do not describe screens for them.

- The bot's Memory tab, and the Usage numbers (they need conversations).
- Conversations: talking to a bot, and bots that hand work to each other.
- Projects, the Library (the files of a project), and memory.
- The Trash page (restore works only from the terminal for now).
- Statistics and cost.
- The Settings page. The limits (such as the longest skill name and the Trash days) and the bot
  defaults have values, but the owner cannot change them in the app yet.

## How to answer

1. Give the steps in a short numbered list. Use the names on the screen.
2. Then suggest one next step that helps the owner.
3. If the task needs a part that is not built yet, say so in one line and offer what works now.
