import { botFieldProblem } from "@cty1ng/shared/bots";
import { BOT_VALUE_RANGES, HISTORY_STEP_PCT } from "@cty1ng/shared/settings";
import type { UpdateBotData } from "../../lib/api/generated/types.gen.ts";
import type { BotRow } from "./bot-queries.ts";
import {
  type CreateForm,
  emptyForm,
  fieldHead,
  type FormSettings,
  nameTaken,
  type Problems,
  rangeProblem,
  takenNameText,
} from "./create-bot-form.ts";

// The rules of the bot page's two save bars without React (bot-page.md §4, §6): which fields
// changed, their problems, the PATCH body and the leave text. The form is the Create form, so the
// Profile and Model tabs reuse the Create fields; the pins, the model and the effort never change
// here (D7). Each tab saves only its own fields.

export type EditTab = "profile" | "model";

export type UpdateBotBody = UpdateBotData["body"];

// The bot as the form shows it. M2 has only Flat and Upload image (bot-avatar.md §1).
export function editFormOf(bot: BotRow, settings: FormSettings): CreateForm {
  return {
    ...emptyForm(bot.avatar_colour, settings),
    name: bot.name,
    description: bot.description,
    persona_md: bot.persona_md,
    avatar_style: bot.avatar_style === "upload" ? "upload" : "flat",
    avatar:
      bot.avatar_id !== null && bot.avatar_url !== null
        ? { id: bot.avatar_id, url: bot.avatar_url }
        : null,
    model_id: bot.model_id,
    effort: bot.effort,
    tool_choices: { ...bot.tool_settings },
    history_share_pct: bot.history_share_pct,
    request_limit: bot.request_limit,
    max_reply_chars: bot.max_reply_chars,
  };
}

// The tool switches as the server stores them: the effective ones for the bot's model.
export type EffectiveTools = (form: CreateForm) => Record<string, boolean>;

export interface EditContext {
  settings: FormSettings;
  // The names of the other bots, for the taken-name hint. The server also checks Trash (D50).
  otherNames: readonly string[];
}

interface Sides {
  form: CreateForm;
  saved: CreateForm;
  effective: EffectiveTools;
}

// What one changed field needs, so a new field of the Profile or Model tab is one entry in
// `FIELD_RULES`.
interface FieldRule {
  // The changed field, as the save bar counts it and the leave question names it.
  field: string;
  tab: EditTab;
  // The field in the leave question.
  words: string;
  // The form keys behind the field. The style and the image go together: an image kept without
  // its style (or a style without its image) is not the avatar the owner picked.
  keys: readonly (keyof CreateForm)[];
  // A change that the big avatar and the band show before Save ("Not saved", bot-page.md §2).
  avatar: boolean;
  changed: (sides: Sides) => boolean;
  // Checked only when the field changed, keyed by the field the error shows under.
  problem: ((input: { form: CreateForm; ctx: EditContext }) => Problems) | null;
  // Puts the field in the PATCH body (api.md §4).
  write: (input: { body: UpdateBotBody; form: CreateForm; effective: EffectiveTools }) => void;
}

// An empty Name or Description says "Required" on this page (bot-page.md §4.1); the Create page's
// words say what to type (create-bot-page.md E1).
function textProblem({
  field,
  form,
  ctx,
}: {
  field: "name" | "description" | "persona_md";
  form: CreateForm;
  ctx: EditContext;
}): string | null {
  return field !== "persona_md" && form[field].trim() === ""
    ? "Required"
    : botFieldProblem(field, form[field], ctx.settings.limits);
}

// One problem under `field`, or none.
function only(field: string, problem: string | null): Problems {
  return problem === null ? {} : { [field]: problem };
}

// About the style and the image together, so both avatar fields check it, under `avatar_id`.
function avatarProblem({ form }: { form: CreateForm }): Problems {
  return only(
    "avatar_id",
    form.avatar_style === "upload" && form.avatar === null
      ? "Upload an image, or pick Flat."
      : null,
  );
}

// The server wants `avatar_id` exactly when the style is `upload`, so an image goes with its style.
function writeAvatar({ body, form }: { body: UpdateBotBody; form: CreateForm }) {
  body.avatar_style = form.avatar_style;
  if (form.avatar_style === "upload" && form.avatar !== null) body.avatar_id = form.avatar.id;
}

// A switch that one side does not list is off.
function sameSwitches({
  now,
  saved,
}: {
  now: Record<string, boolean>;
  saved: Record<string, boolean>;
}): boolean {
  const keys = new Set([...Object.keys(now), ...Object.keys(saved)]);
  return [...keys].every((key) => (now[key] ?? false) === (saved[key] ?? false));
}

// In the order that the save bar and the leave question name them.
const FIELD_RULES = [
  {
    field: "avatar_style",
    tab: "profile",
    words: "avatar style",
    keys: ["avatar_style", "avatar"],
    avatar: true,
    changed: ({ form, saved }) => form.avatar_style !== saved.avatar_style,
    problem: avatarProblem,
    write: writeAvatar,
  },
  {
    field: "avatar_image",
    tab: "profile",
    words: "image",
    keys: ["avatar_style", "avatar"],
    avatar: true,
    changed: ({ form, saved }) =>
      form.avatar_style === "upload" && form.avatar?.id !== saved.avatar?.id,
    problem: avatarProblem,
    write: writeAvatar,
  },
  {
    field: "avatar_colour",
    tab: "profile",
    words: "colour",
    keys: ["avatar_colour"],
    avatar: true,
    changed: ({ form, saved }) =>
      form.avatar_colour.toUpperCase() !== saved.avatar_colour.toUpperCase(),
    problem: null,
    write: ({ body, form }) => {
      body.avatar_colour = form.avatar_colour;
    },
  },
  {
    field: "name",
    tab: "profile",
    words: "name",
    keys: ["name"],
    avatar: false,
    changed: ({ form, saved }) => form.name !== saved.name,
    problem: ({ form, ctx }) =>
      only(
        "name",
        textProblem({ field: "name", form, ctx }) ??
          (nameTaken(form.name, ctx.otherNames)
            ? takenNameText({ name: form.name, byServer: false })
            : null),
      ),
    write: ({ body, form }) => {
      body.name = form.name;
    },
  },
  {
    field: "description",
    tab: "profile",
    words: "description",
    keys: ["description"],
    avatar: false,
    changed: ({ form, saved }) => form.description !== saved.description,
    problem: ({ form, ctx }) =>
      only("description", textProblem({ field: "description", form, ctx })),
    write: ({ body, form }) => {
      body.description = form.description;
    },
  },
  {
    field: "persona_md",
    tab: "profile",
    words: "persona",
    keys: ["persona_md"],
    avatar: false,
    changed: ({ form, saved }) => form.persona_md !== saved.persona_md,
    problem: ({ form, ctx }) => only("persona_md", textProblem({ field: "persona_md", form, ctx })),
    write: ({ body, form }) => {
      body.persona_md = form.persona_md;
    },
  },
  {
    field: "tool_settings",
    tab: "model",
    words: "tools",
    keys: ["tool_choices"],
    avatar: false,
    changed: ({ form, saved, effective }) =>
      !sameSwitches({ now: effective(form), saved: effective(saved) }),
    problem: null,
    // The whole effective switch map, as the server stores it.
    write: ({ body, form, effective }) => {
      body.tool_settings = effective(form);
    },
  },
  {
    field: "history_share_pct",
    tab: "model",
    words: "history share",
    keys: ["history_share_pct"],
    avatar: false,
    changed: ({ form, saved }) => form.history_share_pct !== saved.history_share_pct,
    problem: ({ form, ctx }) =>
      only(
        "history_share_pct",
        rangeProblem({
          value: form.history_share_pct,
          min: ctx.settings.historyMin,
          max: ctx.settings.historyMax,
          step: HISTORY_STEP_PCT,
        }),
      ),
    write: ({ body, form }) => {
      body.history_share_pct = form.history_share_pct;
    },
  },
  {
    field: "request_limit",
    tab: "model",
    words: "model requests per run",
    keys: ["request_limit"],
    avatar: false,
    changed: ({ form, saved }) => form.request_limit !== saved.request_limit,
    problem: ({ form }) => {
      const range = BOT_VALUE_RANGES.request_limit;
      return only(
        "request_limit",
        rangeProblem({ value: form.request_limit, min: range.min, max: range.max }),
      );
    },
    write: ({ body, form }) => {
      body.request_limit = form.request_limit;
    },
  },
  {
    field: "max_reply_chars",
    tab: "model",
    words: "longest reply",
    keys: ["max_reply_chars"],
    avatar: false,
    changed: ({ form, saved }) => form.max_reply_chars !== saved.max_reply_chars,
    problem: ({ form }) => {
      const range = BOT_VALUE_RANGES.max_reply_chars;
      return only(
        "max_reply_chars",
        rangeProblem({ value: form.max_reply_chars, min: range.min, max: range.max }),
      );
    },
    write: ({ body, form }) => {
      body.max_reply_chars = form.max_reply_chars;
    },
  },
] as const satisfies readonly FieldRule[];

export type EditField = (typeof FIELD_RULES)[number]["field"];

// The form keys of some fields, each once.
function formKeys(rules: readonly FieldRule[]): (keyof CreateForm)[] {
  return [...new Set(rules.flatMap((rule) => rule.keys))];
}

// `into` with the fields of one tab taken from `from`: Discard, a save, or newer values.
export function withTab({
  into,
  from,
  tab,
}: {
  into: CreateForm;
  from: CreateForm;
  tab: EditTab;
}): CreateForm {
  const keys = formKeys(FIELD_RULES.filter((rule) => rule.tab === tab));
  return { ...into, ...Object.fromEntries(keys.map((key) => [key, from[key]])) };
}

// One tab of `mine` with the values of `theirs`, except the fields the owner changed since
// `base`: those keep the owner's text. A Save that succeeds after the owner let the tab go.
export function mergeTab({
  tab,
  base,
  mine,
  theirs,
  effective,
}: {
  tab: EditTab;
  base: CreateForm;
  mine: CreateForm;
  theirs: CreateForm;
  effective: EffectiveTools;
}): CreateForm {
  const kept = changedFields({ tab, form: mine, saved: base, effective });
  const keys = formKeys(FIELD_RULES.filter((rule) => kept.includes(rule.field)));
  return {
    ...withTab({ into: mine, from: theirs, tab }),
    ...Object.fromEntries(keys.map((key) => [key, mine[key]])),
  };
}

export function changedFields({
  tab,
  form,
  saved,
  effective,
}: {
  tab: EditTab;
  form: CreateForm;
  saved: CreateForm;
  effective: EffectiveTools;
}): EditField[] {
  return FIELD_RULES.filter(
    (rule) => rule.tab === tab && rule.changed({ form, saved, effective }),
  ).map((rule) => rule.field);
}

// A change that the big avatar and the band show before Save ("Not saved", bot-page.md §2).
export function avatarChanged(fields: readonly EditField[]): boolean {
  return FIELD_RULES.some((rule) => rule.avatar && fields.includes(rule.field));
}

// The problems of the changed fields only: a lower limit never blocks a saved value that the
// owner does not touch (domain-model.md §10, api.md §4 PATCH).
export function editProblems({
  tab,
  form,
  changed,
  ctx,
}: {
  tab: EditTab;
  form: CreateForm;
  changed: readonly EditField[];
  ctx: EditContext;
}): Problems {
  const out: Problems = {};
  for (const rule of FIELD_RULES) {
    if (rule.tab !== tab || rule.problem === null || !changed.includes(rule.field)) continue;
    Object.assign(out, rule.problem({ form, ctx }));
  }
  return out;
}

// One save of one tab (api.md §4 PATCH): `row_version` and the changed fields only.
export function patchBody({
  tab,
  form,
  changed,
  rowVersion,
  effective,
}: {
  tab: EditTab;
  form: CreateForm;
  changed: readonly EditField[];
  rowVersion: number;
  effective: EffectiveTools;
}): UpdateBotBody {
  const body: UpdateBotBody = { row_version: rowVersion };
  for (const rule of FIELD_RULES) {
    if (rule.tab === tab && changed.includes(rule.field)) rule.write({ body, form, effective });
  }
  return body;
}

// The tab of a field that the server named, so its error shows under it. A field with no rule
// (`avatar_id`) is on the Profile tab.
const TAB_OF_FIELD = new Map<string, EditTab>(FIELD_RULES.map((rule) => [rule.field, rule.tab]));

export function tabOfField(field: string): EditTab {
  return TAB_OF_FIELD.get(fieldHead(field)) ?? "profile";
}

function joinWords(words: readonly string[]): string {
  const the = words.map((w) => `the ${w}`);
  if (the.length <= 1) return the.join("");
  return `${the.slice(0, -1).join(", ")} and ${the.at(-1) ?? ""}`;
}

// The leave question names the changed fields (project-settings-page.md §5).
export function leaveText(fields: readonly EditField[]): string {
  const words = FIELD_RULES.filter((rule) => fields.includes(rule.field)).map((rule) => rule.words);
  const it = words.length === 1 ? "it" : "them";
  return `You changed ${joinWords(words)}. The app has not saved ${it} yet. Stay and save, or let ${it} go.`;
}

// The toast for a Save that failed after the owner let its tab go or left the page
// (bot-page.md §4.1): nothing on the page shows the failure then.
export function lostSaveText({
  botName,
  sentName,
  error,
}: {
  botName: string;
  sentName: string;
  error: { code: string; message: string; field?: string | undefined } | null;
}): string {
  if (error?.code === "stale_write") {
    return `${botName} changed in another place, so the app did not save your change.`;
  }
  if (error?.code === "name_taken") {
    return `Could not save ${botName}: ${sentName.trim()} is taken by another bot, maybe one in Trash.`;
  }
  if (error?.field !== undefined) {
    return `Could not save ${botName}: ${error.message}`;
  }
  return `Could not save ${botName}. Try again.`;
}

// What a Profile or Model save writes (frontend-conventions.md §1, "Answers write only what
// their request owns"): the PATCH fields, the avatar URL the server makes from `avatar_id`, and
// `row_version` with `updated_at`. A new PATCH field fails to compile until it is here.
type SavedFields = Pick<
  BotRow,
  Exclude<keyof UpdateBotBody, "row_version"> | "avatar_url" | "row_version" | "updated_at"
>;

// The page's bot after the answer of its own save. Everything else on the row (pins, the pinned
// position, health, counts, activity) does not raise `row_version`, so the page's copy may be
// newer than the answer and stays. An answer that is not newer than the page's bot changes
// nothing: an event or a refresh came first.
export function withSaveAnswer({ bot, answer }: { bot: BotRow; answer: BotRow }): BotRow {
  if (answer.id !== bot.id || answer.row_version <= bot.row_version) return bot;
  const saved: SavedFields = {
    name: answer.name,
    description: answer.description,
    persona_md: answer.persona_md,
    avatar_style: answer.avatar_style,
    avatar_colour: answer.avatar_colour,
    avatar_id: answer.avatar_id,
    avatar_url: answer.avatar_url,
    history_share_pct: answer.history_share_pct,
    request_limit: answer.request_limit,
    max_reply_chars: answer.max_reply_chars,
    tool_settings: answer.tool_settings,
    row_version: answer.row_version,
    updated_at: answer.updated_at,
  };
  return { ...bot, ...saved };
}
