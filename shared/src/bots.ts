import { z } from "zod";
import { CASE_FOLDING } from "./case-folding.ts";
import { Effort, UnavailableReason } from "./catalog.ts";
import { BotId, SkillId, SkillVersionId } from "./ids.ts";
import { formatCount, trimSlug } from "./skills.ts";

// Bot name, slug and field rules that the server and the pages share (domain-model.md §2,
// create-bot-page.md §2, §5). The limits are settings (settings.ts); the slug length is a fixed
// format rule.
export const BOT_FORMAT = {
  // With its "-2", "-3" … suffix (D19).
  slugMax: 40,
  // `/bots/new` is the Create page.
  reservedSlugs: ["new"],
  // When a name gives no Latin letters or digits (an emoji name).
  emptySlug: "bot",
} as const;

// Unicode White_Space, the one definition for trim and collapse (M2 plan, decision 5). JS `\s`
// misses U+0085 and counts U+FEFF, so it is not used.
const WHITE_SPACE_RUN = /\p{White_Space}+/gu;
const WHITE_SPACE_ENDS = /^\p{White_Space}+|\p{White_Space}+$/gu;

// How a name is stored: trimmed, each run of white space one space.
export function normaliseBotName(name: string): string {
  return name.replace(WHITE_SPACE_RUN, " ").replace(WHITE_SPACE_ENDS, "");
}

// Names compare by this key (domain-model.md §2 Name key, invariant 12): white space, Unicode
// compatibility forms and case do not count, so "BÁ" and "bá", "ＢＡ" and "ba", "ẞ", "ß" and
// "SS" collide. The last NFKC can make new white space, so trim and collapse run again
// (decision 5), which makes the key of a key the key.
export function botNameKey(name: string): string {
  const folded = caseFold(normaliseBotName(name).normalize("NFKC")).normalize("NFKC");
  return normaliseBotName(folded);
}

function caseFold(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0);
    out += (code === undefined ? undefined : CASE_FOLDING.get(code)) ?? char;
  }
  return out;
}

// The slug base made from the name at create (D19, domain-model.md §2 Slug): accents removed
// ("đ" too), lower case, every run of other characters one "-", no "-" at the ends. Not cut:
// `botSlugCandidate` cuts it so the suffix fits.
export function botSlugBase(name: string): string {
  const latin = name
    .replace(/[đĐ]/g, "d")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return latin === "" ? BOT_FORMAT.emptySlug : latin;
}

// Try `n` of a slug: 1 is the base, 2 adds "-2", … The whole slug is at most 40 characters,
// with no "-" where the base was cut.
export function botSlugCandidate(base: string, n: number): string {
  const suffix = n === 1 ? "" : `-${String(n)}`;
  return trimSlug(base, BOT_FORMAT.slugMax - suffix.length) + suffix;
}

export function isReservedBotSlug(slug: string): boolean {
  return BOT_FORMAT.reservedSlugs.some((reserved) => reserved === slug);
}

// Try `n` of a clone name (domain-model.md §2 Clone name): "{name} (copy)", then "(copy 2)", …
// The base is cut at a grapheme boundary, with trailing white space removed, so the whole name
// fits `max`.
export function cloneNameCandidate(name: string, n: number, max: number): string {
  const suffix = n === 1 ? " (copy)" : ` (copy ${String(n)})`;
  const room = Math.max(0, max - suffix.length);
  let base = "";
  for (const { segment } of new Intl.Segmenter("en", { granularity: "grapheme" }).segment(name)) {
    if (base.length + segment.length > room) break;
    base += segment;
  }
  return normaliseBotName(base) + suffix;
}

export type BotTextField = "name" | "description" | "persona_md";

export interface BotLimits {
  nameMax: number;
  descriptionMax: number;
  personaMax: number;
}

const EMPTY_FIELD: Record<BotTextField, string> = {
  name: "Type a name.",
  description: "Type a description.",
  persona_md: "Write a persona. The bot needs it to work.",
};

export function botFieldMax(field: BotTextField, limits: BotLimits): number {
  switch (field) {
    case "name":
      return limits.nameMax;
    case "description":
      return limits.descriptionMax;
    case "persona_md":
      return limits.personaMax;
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

// The form's message for an empty field or one over its limit; null when it is fine. The name
// is measured as it is stored (normalised). The secret check (D39) runs on the server only.
export function botFieldProblem(
  field: BotTextField,
  value: string,
  limits: BotLimits,
): string | null {
  const text = field === "name" ? normaliseBotName(value) : value;
  if (text.trim() === "") return EMPTY_FIELD[field];
  const max = botFieldMax(field, limits);
  if (text.length <= max) return null;
  if (field === "persona_md") {
    // E2: the owner can keep typing; nothing is cut.
    return `Too long by ${formatCount(text.length - max)} characters. Move long procedures into a skill.`;
  }
  const noun = field === "name" ? "name" : "description";
  return `The ${noun} has ${formatCount(text.length)} characters. The limit is ${formatCount(max)}. Make it shorter.`;
}

// --- API shapes (api.md §4) ---------------------------------------------------------------

// Jelly and Pixel are in the schema of the table, but no slice draws them yet: the API refuses
// them (bot-avatar.md §1).
export const AVATAR_STYLES = ["flat", "jelly", "pixel", "upload"] as const;
export const AvatarStyle = z.enum(AVATAR_STYLES);
export type AvatarStyle = z.infer<typeof AvatarStyle>;
export const BUILT_AVATAR_STYLES: readonly AvatarStyle[] = ["flat", "upload"];

// Any colour as #RRGGBB (bot-avatar.md §5).
export const AvatarColour = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a colour as #RRGGBB.");
// The SHA-256 of the re-encoded file (domain-model.md §2 Avatar files).
export const AvatarId = z.string().regex(/^[0-9a-f]{64}$/);

export const ToolSettingsBody = z.record(z.string(), z.boolean());

export const BotPin = z
  .object({
    skill_id: SkillId,
    skill_slug: z.string(),
    skill_name: z.string(),
    // The pinned version's description, as the bot reads it.
    description: z.string(),
    skill_version_id: SkillVersionId,
    version: z.number().int().positive(),
    latest_version: z.number().int().positive(),
    always_load: z.boolean(),
    deprecated: z.boolean(),
  })
  .strict();
export type BotPin = z.infer<typeof BotPin>;

// One health line, the first that applies (bots.md UI-4.6). M2 has no runs, so it can only be
// "Cannot run" or "Uses a deprecated skill".
export const BotHealth = z.union([
  z.object({ level: z.literal("cannot_run"), reason: UnavailableReason }).strict(),
  z
    .object({
      level: z.literal("needs_attention"),
      reason: z.enum(["failed_runs", "limit_stops", "deprecated_skill", "history_cut"]),
    })
    .strict(),
]);
export type BotHealth = z.infer<typeof BotHealth>;

// The most urgent state (bot-status.md §3). M2 has no conversations or runs: always idle.
export const BotStatus = z.object({ state: z.literal("idle") }).strict();

export const Bot = z
  .object({
    id: BotId,
    slug: z.string(),
    name: z.string(),
    row_version: z.number().int().positive(),
    description: z.string(),
    persona_md: z.string(),
    avatar_style: AvatarStyle,
    avatar_colour: z.string(),
    // Set when the style is upload: the id and the URL of the image.
    avatar_id: AvatarId.nullable(),
    avatar_url: z.string().nullable(),
    model_id: z.string(),
    // Null when the model is no longer in the catalog.
    model_label: z.string().nullable(),
    effort: Effort.nullable(),
    request_limit: z.number().int(),
    max_reply_chars: z.number().int(),
    history_share_pct: z.number().int(),
    // The effective settings (domain-model.md §2), never the stored JSON as it is.
    tool_settings: z.record(z.string(), z.boolean()),
    cloned_from_bot_id: BotId.nullable(),
    available: z.boolean(),
    unavailable_reason: UnavailableReason.nullable(),
    pins: z.array(BotPin),
    pinned_position: z.number().int().positive().nullable(),
    last_activity_at: z.string().nullable(),
    counts: z
      .object({
        skills: z.number().int().nonnegative(),
        skill_updates: z.number().int().nonnegative(),
        projects: z.number().int().nonnegative(),
        conversations: z.number().int().nonnegative(),
      })
      .strict(),
    status: BotStatus,
    health: BotHealth.nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();
export type Bot = z.infer<typeof Bot>;

// `GET /bots/{id}`: the bot and the conversations it is in (none before M3).
export const BotDetail = Bot.extend({
  // Always empty in M2; M3 gives each conversation its shape.
  conversations: z.array(z.object({ id: z.string() }).strict()).max(0),
}).strict();
export type BotDetail = z.infer<typeof BotDetail>;

const Pct = z.number().int();
const Limit = z.number().int();

export const CreateBotPin = z
  .object({
    skill_id: SkillId,
    // Omitted = the latest version.
    skill_version_id: SkillVersionId.optional(),
    always_load: z.boolean(),
  })
  .strict();

export const CreateBotBody = z
  .object({
    name: z.string(),
    description: z.string(),
    persona_md: z.string(),
    avatar_style: AvatarStyle,
    avatar_colour: AvatarColour,
    avatar_id: AvatarId.optional(),
    model_id: z.string(),
    effort: Effort.nullable().optional(),
    history_share_pct: Pct.optional(),
    request_limit: Limit.optional(),
    max_reply_chars: Limit.optional(),
    tool_settings: ToolSettingsBody.optional(),
    pins: z.array(CreateBotPin),
    cloned_from_bot_id: BotId.optional(),
  })
  .strict();
export type CreateBotBody = z.infer<typeof CreateBotBody>;

// `model_id` and `effort` are not here, and unknown fields fail: a PATCH with them is a 422
// (D7, invariant 1).
export const PatchBotBody = z
  .object({
    row_version: z.number().int().positive(),
    name: z.string().optional(),
    description: z.string().optional(),
    persona_md: z.string().optional(),
    avatar_style: AvatarStyle.optional(),
    avatar_colour: AvatarColour.optional(),
    avatar_id: AvatarId.optional(),
    history_share_pct: Pct.optional(),
    request_limit: Limit.optional(),
    max_reply_chars: Limit.optional(),
    tool_settings: ToolSettingsBody.optional(),
  })
  .strict();
export type PatchBotBody = z.infer<typeof PatchBotBody>;

// `GET /bots/{id}/clone-template`: a prefilled create body, without a colour (the page picks one).
export const CloneTemplate = CreateBotBody.omit({ avatar_colour: true })
  .extend({
    effort: Effort.nullable(),
    history_share_pct: Pct,
    request_limit: Limit,
    max_reply_chars: Limit,
    tool_settings: ToolSettingsBody,
    pins: z.array(CreateBotPin.required()),
    cloned_from_bot_id: BotId,
  })
  .strict();
export type CloneTemplate = z.infer<typeof CloneTemplate>;

export const PinnedOrderBody = z
  .object({ bot_ids: z.array(BotId), expected_bot_ids: z.array(BotId) })
  .strict();

export const PinState = z
  .object({ skill_version_id: SkillVersionId, always_load: z.boolean() })
  .strict();
export type PinState = z.infer<typeof PinState>;

export const SetPinBody = z
  .object({
    skill_version_id: SkillVersionId,
    always_load: z.boolean(),
    // The pin as the page saw it; null = it saw no pin.
    expected: PinState.nullable(),
  })
  .strict();

// The ranges that apply to every bot's own values (domain-model.md §10): the same as the
// default settings' ranges. The history share range is a setting.
export const BOT_VALUE_RANGES = {
  request_limit: { min: 1, max: 100 },
  max_reply_chars: { min: 500, max: 20_000 },
} as const;

// Avatar uploads (security.md §2.4): fixed rules; the size limit comes from AVATAR_MAX_BYTES.
export const AVATAR_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const AvatarLimits = z
  .object({ max_bytes: z.number().int().positive(), accepted_types: z.array(z.string()) })
  .strict();
export const AvatarUpload = z.object({ avatar_id: AvatarId, url: z.string() }).strict();
export function avatarUrl(avatarId: string): string {
  return `/api/avatars/${avatarId}.webp`;
}
