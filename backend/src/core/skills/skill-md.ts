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

// The reason a file is not a skill (shown in the import preview), or the parsed skill.
export function parseSkillMd(text: string): SkillMd | { invalid: string } {
  const normalised = text.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(normalised);
  if (match === null) return { invalid: "The file has no frontmatter between --- lines." };
  // The default core schema: no custom tags (security.md §2.4). An unknown tag is only a
  // warning in the yaml package, so any warning or error makes the file invalid.
  const doc = parseDocument(match[1] ?? "", { schema: "core" });
  if (doc.errors.length > 0 || doc.warnings.length > 0) {
    return { invalid: "The frontmatter is not valid YAML." };
  }
  const data: unknown = doc.toJS();
  const frontmatter = Frontmatter.safeParse(data);
  if (!frontmatter.success) {
    return { invalid: "The frontmatter needs a name and a description, both text." };
  }
  return {
    slug: frontmatter.data.name.trim(),
    description: frontmatter.data.description.trim(),
    bodyMd: (match[2] ?? "").replace(/^\n+/, ""),
  };
}

export function serialiseSkillMd(skill: SkillMd): string {
  const frontmatter = stringify(
    { name: skill.slug, description: skill.description },
    { lineWidth: 0 },
  );
  return `---\n${frontmatter}---\n\n${skill.bodyMd}`;
}
