import { botFieldProblem } from "@cty1ng/shared/bots";
import { BOT_VALUE_RANGES, HISTORY_STEP_PCT } from "@cty1ng/shared/settings";
import type { UpdateBotData } from "../../lib/api/generated/types.gen.ts";
import type { BotRow } from "./bot-queries.ts";
import {
  type CreateForm,
  emptyForm,
  type FormSettings,
  nameTaken,
  type Problems,
  rangeProblem,
} from "./create-bot-form.ts";

// The rules of the bot page's two save bars without React (bot-page.md §4, §6): which fields
// changed, their problems, the PATCH body and the leave text. The form is the Create form, so the
// Profile and Model tabs reuse the Create fields; the pins, the model and the effort never change
// here (D7). Each tab saves only its own fields.

export type EditTab = "profile" | "model";

export type UpdateBotBody = UpdateBotData["body"];

// One changed field, as the save bar counts it and the leave question names it.
export type EditField =
  | "avatar_style"
  | "avatar_image"
  | "avatar_colour"
  | "name"
  | "description"
  | "persona_md"
  | "tool_settings"
  | "history_share_pct"
  | "request_limit"
  | "max_reply_chars";

const FIELD_WORDS: Record<EditField, string> = {
  avatar_style: "avatar style",
  avatar_image: "image",
  avatar_colour: "colour",
  name: "name",
  description: "description",
  persona_md: "persona",
  tool_settings: "tools",
  history_share_pct: "history share",
  request_limit: "model requests per run",
  max_reply_chars: "longest reply",
};

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

function profileOf(form: CreateForm) {
  return {
    avatar_style: form.avatar_style,
    avatar: form.avatar,
    avatar_colour: form.avatar_colour,
    name: form.name,
    description: form.description,
    persona_md: form.persona_md,
  };
}

function setupOf(form: CreateForm) {
  return {
    tool_choices: form.tool_choices,
    history_share_pct: form.history_share_pct,
    request_limit: form.request_limit,
    max_reply_chars: form.max_reply_chars,
  };
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
  return { ...into, ...(tab === "profile" ? profileOf(from) : setupOf(from)) };
}

// The form keys behind each changed field.
const FORM_KEYS = {
  avatar_style: ["avatar_style"],
  avatar_image: ["avatar"],
  avatar_colour: ["avatar_colour"],
  name: ["name"],
  description: ["description"],
  persona_md: ["persona_md"],
  tool_settings: ["tool_choices"],
  history_share_pct: ["history_share_pct"],
  request_limit: ["request_limit"],
  max_reply_chars: ["max_reply_chars"],
} as const satisfies Record<EditField, readonly (keyof CreateForm)[]>;

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
  const keys = kept.flatMap((field) => FORM_KEYS[field]);
  return {
    ...withTab({ into: mine, from: theirs, tab }),
    ...Object.fromEntries(keys.map((key) => [key, mine[key]])),
  };
}

// The tool switches as the server stores them: the effective ones for the bot's model.
export type EffectiveTools = (form: CreateForm) => Record<string, boolean>;

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
  const out: EditField[] = [];
  if (tab === "profile") {
    if (form.avatar_style !== saved.avatar_style) out.push("avatar_style");
    if (form.avatar_style === "upload" && form.avatar?.id !== saved.avatar?.id) {
      out.push("avatar_image");
    }
    if (form.avatar_colour.toUpperCase() !== saved.avatar_colour.toUpperCase()) {
      out.push("avatar_colour");
    }
    if (form.name !== saved.name) out.push("name");
    if (form.description !== saved.description) out.push("description");
    if (form.persona_md !== saved.persona_md) out.push("persona_md");
    return out;
  }
  if (!sameSwitches({ now: effective(form), saved: effective(saved) })) out.push("tool_settings");
  if (form.history_share_pct !== saved.history_share_pct) out.push("history_share_pct");
  if (form.request_limit !== saved.request_limit) out.push("request_limit");
  if (form.max_reply_chars !== saved.max_reply_chars) out.push("max_reply_chars");
  return out;
}

// A change that the big avatar and the band show before Save ("Not saved", bot-page.md §2).
export function avatarChanged(fields: readonly EditField[]): boolean {
  return fields.some((f) => f === "avatar_style" || f === "avatar_image" || f === "avatar_colour");
}

export interface EditContext {
  settings: FormSettings;
  // The names of the other bots, for the taken-name hint. The server also checks Trash (D50).
  otherNames: readonly string[];
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
  const put = (field: string, problem: string | null) => {
    if (problem !== null) out[field] = problem;
  };
  const limits = ctx.settings.limits;
  // An empty Name or Description says "Required" on this page (bot-page.md §4.1); the Create
  // page's words say what to type (create-bot-page.md E1).
  const text = (field: "name" | "description" | "persona_md") =>
    field !== "persona_md" && form[field].trim() === ""
      ? "Required"
      : botFieldProblem(field, form[field], limits);
  if (tab === "profile") {
    if (changed.includes("name")) {
      put("name", text("name"));
      if (out.name === undefined && nameTaken(form.name, ctx.otherNames)) {
        out.name = `${form.name.trim()} is taken by another bot. Pick another name.`;
      }
    }
    if (changed.includes("description")) {
      put("description", text("description"));
    }
    if (changed.includes("persona_md")) {
      put("persona_md", text("persona_md"));
    }
    if (form.avatar_style === "upload" && form.avatar === null) {
      out.avatar_id = "Upload an image, or pick Flat.";
    }
    return out;
  }
  const s = ctx.settings;
  if (changed.includes("history_share_pct")) {
    put(
      "history_share_pct",
      rangeProblem(form.history_share_pct, s.historyMin, s.historyMax, HISTORY_STEP_PCT),
    );
  }
  if (changed.includes("request_limit")) {
    const range = BOT_VALUE_RANGES.request_limit;
    put("request_limit", rangeProblem(form.request_limit, range.min, range.max));
  }
  if (changed.includes("max_reply_chars")) {
    const range = BOT_VALUE_RANGES.max_reply_chars;
    put("max_reply_chars", rangeProblem(form.max_reply_chars, range.min, range.max));
  }
  return out;
}

// One save of one tab (api.md §4 PATCH): `row_version` and the changed fields only. An image goes
// with its style, because the server wants `avatar_id` exactly when the style is `upload`.
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
  const has = (field: EditField) => changed.includes(field);
  if (tab === "profile") {
    if (has("avatar_style") || has("avatar_image")) {
      body.avatar_style = form.avatar_style;
      if (form.avatar_style === "upload" && form.avatar !== null) body.avatar_id = form.avatar.id;
    }
    if (has("avatar_colour")) body.avatar_colour = form.avatar_colour;
    if (has("name")) body.name = form.name;
    if (has("description")) body.description = form.description;
    if (has("persona_md")) body.persona_md = form.persona_md;
    return body;
  }
  if (has("tool_settings")) body.tool_settings = effective(form);
  if (has("history_share_pct")) body.history_share_pct = form.history_share_pct;
  if (has("request_limit")) body.request_limit = form.request_limit;
  if (has("max_reply_chars")) body.max_reply_chars = form.max_reply_chars;
  return body;
}

// The tab of a field that the server named, so its error shows under it.
export function tabOfField(field: string): EditTab {
  const head = field.split(/[.[]/)[0] ?? field;
  return ["tool_settings", "history_share_pct", "request_limit", "max_reply_chars"].includes(head)
    ? "model"
    : "profile";
}

function joinWords(words: readonly string[]): string {
  const the = words.map((w) => `the ${w}`);
  if (the.length <= 1) return the.join("");
  return `${the.slice(0, -1).join(", ")} and ${the.at(-1) ?? ""}`;
}

// The leave question names the changed fields (project-settings-page.md §5).
export function leaveText(fields: readonly EditField[]): string {
  const words = [...new Set(fields.map((f) => FIELD_WORDS[f]))];
  const it = words.length === 1 ? "it" : "them";
  return `You changed ${joinWords(words)}. The app has not saved ${it} yet. Stay and save, or let ${it} go.`;
}
