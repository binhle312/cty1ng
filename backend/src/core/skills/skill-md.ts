import { parseDocument, stringify } from "yaml";
import { z } from "zod";

// The SKILL.md format (domain-model.md §3.1, D5): YAML frontmatter between `---` lines, then the
// Markdown body. The frontmatter `name` is the slug; `description` is per version. Other keys of
// the Agent Skills standard (license, metadata …) are allowed and ignored, because only the
// name, the description and the body are stored.

export interface SkillMd {
  slug: string;
  description: string;
  bodyMd: string;
}

const Frontmatter = z.looseObject({ name: z.string(), description: z.string() });

// A security check, fixed in code (owner, 2026-11-05). The parse time grows with the square of the
// keys, and the server waits for it. A zip holds up to 200 files, so the limit must stay cheap at
// 200 times its cost: about 30 ms for each file. The limit holds the longest description with
// every character escaped (about 4 KB) and other keys.
const FRONTMATTER_MAX_CHARS = 8_192;

// The reason a file is not a skill (shown in the import preview), or the parsed skill.
export function parseSkillMd(text: string): SkillMd | { invalid: string } {
  // The `---` lines may end in CRLF. Only the frontmatter is normalised; the body keeps its line
  // endings.
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(text);
  if (match === null) return { invalid: "The file has no frontmatter between --- lines." };
  const yaml = match[1] ?? "";
  if (yaml.length > FRONTMATTER_MAX_CHARS) {
    return { invalid: "The frontmatter is larger than 8 KB." };
  }
  // The default core schema: no custom tags (security.md §2.4). An unknown tag is only a
  // warning in the yaml package, so any warning or error makes the file invalid.
  const doc = parseDocument(yaml.replace(/\r\n/g, "\n"), { schema: "core" });
  if (doc.errors.length > 0 || doc.warnings.length > 0) {
    return { invalid: "The frontmatter is not valid YAML." };
  }
  // toJS() can still throw, for example on too many nested aliases (a YAML bomb).
  let data: unknown;
  try {
    data = doc.toJS({ maxAliasCount: 20 });
  } catch {
    return { invalid: "The frontmatter is not valid YAML." };
  }
  const frontmatter = Frontmatter.safeParse(data);
  if (!frontmatter.success) {
    return { invalid: "The frontmatter needs a name and a description, both text." };
  }
  // The description and the body are kept as written, so an export imports as `unchanged`; only
  // the one blank line that `serialiseSkillMd` puts after the frontmatter is dropped.
  return {
    slug: frontmatter.data.name.trim(),
    description: frontmatter.data.description,
    bodyMd: (match[2] ?? "").replace(/^\r?\n/, ""),
  };
}

export function serialiseSkillMd(skill: SkillMd): string {
  const frontmatter = stringify(
    { name: skill.slug, description: skill.description },
    { lineWidth: 0 },
  );
  return `---\n${frontmatter}---\n\n${skill.bodyMd}`;
}
