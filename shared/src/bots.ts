import { CASE_FOLDING } from "./case-folding.ts";
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
