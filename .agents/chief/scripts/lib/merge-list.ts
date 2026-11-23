// The PRs that no standing permission of the owner covers (`AGENTS.md` §7): one list, which
// `pnpm merge:check` reads and `pnpm check:memory` compares with its copies in `AGENTS.md` and
// R-002. Pure: data and two small functions.
//
// A path rule is an exact file, a folder prefix that ends in "/", or a name pattern with one "*"
// in its last part. It matches dotfiles (Node `path.matchesGlob` does not: `workspace/.env`).

export type ListItem = {
  // The words of the `AGENTS.md` sentence, in its order.
  text: string;
  paths: readonly string[];
  // What a person must still read in the diff, because no path shows it.
  notByPath: string | undefined;
};

// A memory PR changes only this folder; the chief merges it (owner, 2026-11-19, order 108).
export const MEMORY_FOLDER = ".agents/chief/memories/";

// The GitHub repository of this clone, "owner/name". The start check of `merge:check` refuses a
// clone whose origin is another repository (plan delta r1 §3; owner, 2026-11-20, order 131).
export const REPOSITORY = "binhle312/cty1ng";

// A `package.json` change is a dependency change when one of these fields changes. `scripts` is
// here because a PR can point `merge:check` at a stub or add an install hook.
export const PACKAGE_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "overrides",
  "pnpm",
  "packageManager",
  "scripts",
  "peerDependenciesMeta",
  "dependenciesMeta",
  "bundledDependencies",
  "bundleDependencies",
] as const;

export const DEPENDENCY_TEXT = "a dependency";

// The CI checks that must pass before the chief merges: the job names of the CI workflow file
// (a test keeps the two the same). A check that is missing, skipped, pending or red means no
// merge line.
export const REQUIRED_CHECKS = [
  "lint",
  "typecheck",
  "test",
  "check:index",
  "check:events",
  "check:memory",
  "db:check",
  "records:counts",
  "audit",
  "check:breaks static",
  "check:status",
  "gen:api fresh",
  "build + check:bundle",
  "e2e",
] as const;

// A required check counts only as a check run of this app (GitHub Actions) from this workflow file
// (option A, DQ-1020). A status context or another app never stands in for a required job. Rules,
// not settings (AGENTS.md §10). The probe of 2026-11-20 read both values from the GitHub API.
export const CI_APP_ID = 15368;
export const CI_WORKFLOW = ".github/workflows/ci.yml";

// The only files that a memory PR may add or change (option A, deny by default): a `.md` file of
// `long-term/` whose folders are lower case words and whose name starts with a letter or a digit.
// Each other path or status needs the owner (DQ-1021, DQ-1025; plan delta r1 §2.1).
export const MEMORY_PATH =
  /^\.agents\/chief\/memories\/long-term\/([a-z0-9][a-z0-9-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.md$/;
// Memory files that the owner merges in each memory PR: the audit commands and the audit checklist
// (DQ-949; the second read of the option A plan).
export const MEMORY_PROTECTED: readonly string[] = [
  `${MEMORY_FOLDER}long-term/restore.md`,
  `${MEMORY_FOLDER}long-term/audit.md`,
];

export const MERGE_LIST: readonly ListItem[] = [
  { text: "`AGENTS.md`", paths: ["AGENTS.md", "CLAUDE.md"], notByPath: undefined },
  { text: "`docs/decisions/`", paths: ["docs/decisions/"], notByPath: undefined },
  {
    text: "the public API shape",
    paths: ["frontend/src/lib/api/generated/"],
    notByPath: "a route or schema change of the backend API with no new generated client",
  },
  {
    text: "security-sensitive code",
    paths: [
      // The filter of .github/workflows/security-review.yml.
      "backend/src/adapters/workspace/",
      "backend/src/adapters/http/",
      "backend/src/adapters/log/",
      "backend/src/adapters/avatars/",
      "backend/src/core/guard/",
      "backend/src/app/config.ts",
      "frontend/src/components/ui/markdown*",
      ".env.example",
      ".github/workflows/",
      // The callers of the sensitive data guard.
      "backend/src/core/bots/bot.rules.ts",
      "backend/src/core/skills/skill.rules.ts",
      "backend/src/core/skills/skill-import.service.ts",
      // Uploads, the bind host, the origin and host checks, secrets.
      "backend/src/core/bots/avatars.service.ts",
      "backend/src/app/compose.ts",
      "backend/src/app/main.ts",
      "frontend/vite.config.ts",
      ".gitignore",
      "backend/src/adapters/model/",
      // The hooks and allow rules of each agent session, the key-name pattern of the log
      // redaction, and the port of the avatar files (review round 3).
      ".claude/settings.json",
      "shared/src/catalog.ts",
      "backend/src/core/ports/avatar-files.ts",
    ],
    notByPath:
      "a removed call of the sensitive data guard in another file; SSE event payloads; Markdown rendering outside markdown.tsx; anything else that touches secrets",
  },
  { text: "a migration", paths: ["backend/migrations/"], notByPath: undefined },
  {
    text: DEPENDENCY_TEXT,
    // A `package.json` counts only when a field of PACKAGE_FIELDS changes (merge-check.ts).
    paths: ["pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"],
    notByPath: undefined,
  },
  {
    text: "the memory check",
    paths: [
      ".agents/chief/scripts/check-memory*",
      ".agents/chief/scripts/lib/check-memory*",
      ".agents/chief/scripts/lib/owner-quotes*",
      // It sets the exit code of check:memory.
      "scripts/lib/report.ts",
    ],
    notByPath: undefined,
  },
  {
    text: "a rule about merges, approvals or permissions outside `.agents/chief/memories/`",
    paths: [
      ".agents/chief/scripts/lib/merge-list.ts",
      ".agents/chief/scripts/merge-check*",
      ".agents/chief/scripts/lib/merge-check*",
      "scripts/lib/check-status.ts",
      "docs/workflows/merge-bar.md",
    ],
    notByPath: "such a rule in another file",
  },
];

export function matchesPath(rule: string, path: string): boolean {
  if (rule.endsWith("/")) return path.startsWith(rule);
  const star = rule.indexOf("*");
  if (star === -1) return path === rule;
  const prefix = rule.slice(0, star);
  const suffix = rule.slice(star + 1);
  if (!path.startsWith(prefix) || !path.endsWith(suffix)) return false;
  if (path.length < prefix.length + suffix.length) return false;
  // The star stays inside the last part of the path.
  return !path.slice(prefix.length, path.length - suffix.length).includes("/");
}

// The first item whose path rules match `path`, or undefined.
export function listedItem(path: string, items = MERGE_LIST): ListItem | undefined {
  return items.find((item) => item.paths.some((rule) => matchesPath(rule, path)));
}

// The words of the list as the `AGENTS.md` sentence joins them: "a, b, …, or z".
export function listSentence(items = MERGE_LIST): string {
  const texts = items.map((item) => item.text);
  if (texts.length < 2) return texts.join("");
  return `${texts.slice(0, -1).join(", ")}, or ${texts.at(-1) ?? ""}`;
}
