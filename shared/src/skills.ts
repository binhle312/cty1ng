import { z } from "zod";
import { SkillId, SkillVersionId } from "./ids.ts";

// Skill format rules (domain-model.md §3.1, conversation-rules.md §9 `SKILL_FORMAT`). They follow
// the Agent Skills standard, so every export is a valid skill folder; they are fixed in code. The
// name and body limits are settings (settings.ts).
export const SKILL_FORMAT = {
  slugMax: 64,
  descriptionMax: 1024,
  // Lowercase letters and digits, single hyphens inside: no hyphen at the start or end, no "--".
  slugPattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  // Page URLs (design/components/skills-page.md §1); every create path refuses them.
  reservedSlugs: ["new", "import"],
} as const;

export type SlugProblem = "empty" | "too_long" | "pattern" | "reserved";

export function slugProblem(slug: string): SlugProblem | null {
  if (slug === "") return "empty";
  if (slug.length > SKILL_FORMAT.slugMax) return "too_long";
  if (!SKILL_FORMAT.slugPattern.test(slug)) return "pattern";
  if (SKILL_FORMAT.reservedSlugs.some((reserved) => reserved === slug)) return "reserved";
  return null;
}

export const SkillSlug = z
  .string()
  .refine((slug) => slugProblem(slug) === null, { message: "Not a valid skill slug" });

// The slug the editor makes from the name until the owner edits it (skills-page.md §4):
// lowercase, accents removed (đ too, which Unicode decomposition leaves), every other character
// a hyphen, no hyphen at the ends, no "--", at most 64 characters. A name with no Latin letters
// or digits gives "".
export function slugFromName(name: string): string {
  const latin = name
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return trimSlug(latin, SKILL_FORMAT.slugMax);
}

// Cuts a slug to `max` characters without leaving a hyphen at the cut.
export function trimSlug(slug: string, max: number): string {
  return slug.slice(0, max).replace(/-+$/, "");
}

// The slug of a copy (skills-page.md §12): `<slug>-copy`, then `-copy-2`, `-copy-3` … for the
// first free one. The base is cut so the suffix always stays.
export function copySlug(slug: string, taken: (candidate: string) => boolean): string {
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? "-copy" : `-copy-${String(n)}`;
    const candidate = `${trimSlug(slug, SKILL_FORMAT.slugMax - suffix.length)}${suffix}`;
    if (!taken(candidate)) return candidate;
  }
}

// The name of a copy: " (copy)" after the name, which is cut so the whole fits `nameMax`.
export function copyName(name: string, nameMax: number): string {
  const suffix = " (copy)";
  return `${name.slice(0, Math.max(0, nameMax - suffix.length)).trimEnd()}${suffix}`;
}

// API shapes (api.md §2, §8). Timestamps are ISO-8601 UTC strings.
const Timestamp = z.string();

export const SkillVersionSummary = z
  .object({
    version: z.number().int().positive(),
    description: z.string(),
    changelog: z.string().nullable(),
    created_at: Timestamp,
  })
  .strict();

export const Skill = z
  .object({
    id: SkillId,
    slug: z.string(),
    name: z.string(),
    author_id: z.string(),
    is_author: z.boolean(),
    row_version: z.number().int().positive(),
    latest_version: SkillVersionSummary,
    bots_using: z.number().int().nonnegative(),
    bots_outdated: z.number().int().nonnegative(),
    deprecated: z.boolean(),
    deprecated_at: Timestamp.nullable(),
    updated_at: Timestamp,
    // The version this skill was cloned from; null when it was not cloned, or when that skill
    // was purged (domain-model.md §3.4).
    cloned_from: z
      .object({ skill_id: SkillId, slug: z.string(), version: z.number().int().positive() })
      .strict()
      .nullable(),
  })
  .strict();
export type Skill = z.infer<typeof Skill>;

// `GET /skills/{id}`: the skill with the body of its latest version.
export const SkillDetail = Skill.extend({ body_md: z.string() }).strict();
export type SkillDetail = z.infer<typeof SkillDetail>;

export const SkillVersion = z
  .object({
    id: SkillVersionId,
    version: z.number().int().positive(),
    description: z.string(),
    body_md: z.string(),
    changelog: z.string().nullable(),
    created_by: z.string(),
    created_at: Timestamp,
    // Bots that use this version (M1: always 0; pins come with M2).
    bots_using: z.number().int().nonnegative(),
  })
  .strict();
export type SkillVersion = z.infer<typeof SkillVersion>;

// A row of `GET /skills/{id}/versions` (api.md §2): no body; one version is read on its own.
export const SkillVersionListItem = SkillVersion.omit({ body_md: true });
export type SkillVersionListItem = z.infer<typeof SkillVersionListItem>;

// A line diff (api.md §2, `GET /skills/{id}/diff`): every line, so the History tab can fold the
// unchanged runs and show them again.
export const DiffLine = z.object({ op: z.enum(["same", "add", "del"]), text: z.string() }).strict();
export type DiffLine = z.infer<typeof DiffLine>;

export const SkillDiff = z
  .object({ description: z.array(DiffLine).nullable(), body: z.array(DiffLine) })
  .strict();
export type SkillDiff = z.infer<typeof SkillDiff>;

// One folder of an import zip (domain-model.md §3.5, skills-page.md §15). `new` and `changed`
// rows can be applied; `unchanged`, `invalid` and `conflict` rows are listed only.
export const SkillImportRow = z
  .object({
    slug: z.string(),
    status: z.enum(["new", "changed", "unchanged", "invalid", "conflict"]),
    // Why a row is invalid or a conflict; null otherwise.
    reason: z.string().nullable(),
    // The name a new skill gets (its slug), or the existing skill's name.
    name: z.string(),
    // `changed`: latest → new version; `unchanged`: the version it equals; `new`: 1.
    from_version: z.number().int().positive().nullable(),
    to_version: z.number().int().positive().nullable(),
    diff: SkillDiff.nullable(),
    // Files in the folder other than SKILL.md: listed, never opened (security.md §2.4).
    skipped_files: z.array(z.string()),
  })
  .strict();
export type SkillImportRow = z.infer<typeof SkillImportRow>;

export const SkillImportPreview = z
  .object({ preview_id: z.string(), file: z.string(), rows: z.array(SkillImportRow) })
  .strict();
export type SkillImportPreview = z.infer<typeof SkillImportPreview>;

export const SkillImportResult = z
  .object({
    created: z.number().int().nonnegative(),
    new_versions: z.number().int().nonnegative(),
    skills: z.array(Skill),
  })
  .strict();
export type SkillImportResult = z.infer<typeof SkillImportResult>;
