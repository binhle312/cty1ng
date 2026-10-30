import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// DESIGN.md and .impeccable/design.json are the Impeccable skill's snapshot of the Command dark
// theme (docs/workflow.md §2). They repeat the token colours; the token file owns them. This
// check fails when a snapshot colour differs from the token file, so the skill never works from
// old values. Both files are optional: Impeccable runs without them.
export const TOKEN_FILE = "frontend/src/themes/command.css";
export const DESIGN_MD = "DESIGN.md";
export const DESIGN_JSON = ".impeccable/design.json";

const HEX = /#[0-9a-f]{3,8}\b/gi;

// The colour tokens of the Command dark block: name → lower-case hex.
export function darkColours(css: string): Map<string, string> {
  const start = css.indexOf('[data-mode="dark"]');
  const block = start === -1 ? "" : css.slice(start, css.indexOf("}", start));
  const colours = new Map<string, string>();
  for (const match of block.matchAll(/--token-([a-z-]+):\s*(#[0-9a-f]{3,8})\s*;/gi)) {
    colours.set(match[1] ?? "", (match[2] ?? "").toLowerCase());
  }
  return colours;
}

// The `colors:` map of DESIGN.md's front matter: name → lower-case hex. A Windows checkout may
// give the file CRLF line endings, so they are normalised first.
export function snapshotColours(markdown: string): Map<string, string> {
  const text = markdown.replace(/\r\n?/g, "\n");
  const frontMatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
  const colours = new Map<string, string>();
  let inColours = false;
  for (const line of frontMatter.split("\n")) {
    if (!line.startsWith(" ")) inColours = line.trim() === "colors:";
    else if (inColours) {
      const match = /^\s+([a-z-]+):\s*"?(#[0-9a-f]{3,8})"?\s*$/i.exec(line);
      if (match) colours.set(match[1] ?? "", (match[2] ?? "").toLowerCase());
    }
  }
  return colours;
}

export function checkDesignSnapshot(root: string): string[] {
  const tokenPath = join(root, TOKEN_FILE);
  const mdPath = join(root, DESIGN_MD);
  const jsonPath = join(root, DESIGN_JSON);
  if (!existsSync(mdPath) && !existsSync(jsonPath)) return [];
  if (!existsSync(tokenPath)) return [`${DESIGN_MD}: ${TOKEN_FILE} does not exist`];

  const tokens = darkColours(readFileSync(tokenPath, "utf8"));
  const problems: string[] = [];
  if (existsSync(mdPath)) {
    const snapshot = snapshotColours(readFileSync(mdPath, "utf8"));
    for (const [name, value] of tokens) {
      const listed = snapshot.get(name);
      if (listed === undefined) {
        problems.push(`${DESIGN_MD}: colour \`${name}\` is in ${TOKEN_FILE} but not in DESIGN.md`);
      } else if (listed !== value) {
        problems.push(`${DESIGN_MD}: \`${name}\` is ${listed}; ${TOKEN_FILE} has ${value}`);
      }
    }
    for (const name of snapshot.keys()) {
      if (!tokens.has(name)) {
        problems.push(`${DESIGN_MD}: colour \`${name}\` is not a token in ${TOKEN_FILE}`);
      }
    }
  }
  if (existsSync(jsonPath)) {
    const values = new Set(tokens.values());
    const used = new Set(
      readFileSync(jsonPath, "utf8")
        .match(HEX)
        ?.map((h) => h.toLowerCase()),
    );
    for (const hex of used) {
      if (!values.has(hex)) {
        problems.push(`${DESIGN_JSON}: ${hex} is not a Command dark token value in ${TOKEN_FILE}`);
      }
    }
  }
  return problems;
}
