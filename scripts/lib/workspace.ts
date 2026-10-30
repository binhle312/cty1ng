import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The package folders listed under `packages:` in pnpm-workspace.yaml that exist under `root`.
// Entries are plain folder names; a glob is refused so a package is never skipped silently.
export function workspacePackages(root: string): string[] {
  const yaml = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  const block = /^packages:\n((?:[ \t]+-[^\n]*\n?)+)/m.exec(yaml)?.[1] ?? "";
  const names = [...block.matchAll(/^[ \t]+-[ \t]+["']?([^"'\s#]+)/gm)].map((m) => m[1] ?? "");
  for (const name of names) {
    if (/[*?{[]/.test(name))
      throw new Error(`pnpm-workspace.yaml: use folder names, not globs (${name})`);
  }
  return names.filter((name) => existsSync(join(root, name)));
}
