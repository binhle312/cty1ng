// The start check of `pnpm merge:check` (plan delta r1 §3; owner, 2026-11-20, order 131: trust the
// computer, check the basics). Pure: the CLI reads the facts and passes them in.
//
// - Before snapshot 1: the origin is this repository on github.com, the clone has its full history
//   (not shallow, no grafts file), and no git setting under `diff.`, `submodule.` or `extensions.`
//   can change the diff, except two known values. A fact that git could not read is a problem too.
// - The git environment: no inherited `GIT_` variable reaches git, and replace objects are off.
// - After snapshot 1: each policy file here has the path, the blob id and the executable bit of
//   the base tip of that snapshot, and no other file is in the policy folders.
//
// It finds a local setting that changed by mistake. It does not defend against a person who
// controls the machine (not claimed, order 131).
import type { Repo } from "./merge-check-snapshot.ts";
import { REPOSITORY } from "./merge-list.ts";

export type StartFacts = {
  // `git config --get remote.origin.url`: the value as written, before a URL rewrite.
  originUrl: string | undefined;
  // `git rev-parse --is-shallow-repository`.
  shallow: string | undefined;
  // True when the file of `git rev-parse --git-path info/grafts` exists.
  grafts: boolean | undefined;
  // `git config --list -z --includes`: "key\nvalue" entries, each ended by a NUL.
  config: string | undefined;
};

const ORIGIN =
  /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?$/;
// The settings that can change what `git diff` gives; each key is lower case in `config --list`.
const WATCHED = ["diff.", "submodule.", "extensions."];
const ALLOWED = new Map([
  ["extensions.worktreeconfig", "true"],
  ["extensions.objectformat", "sha1"],
]);

// The GitHub repository that an origin URL names, or undefined.
export function originRepo(url: string): Repo | undefined {
  const match = ORIGIN.exec(url);
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  return { owner: match[1], name: match[2] };
}

export function startProblems(facts: StartFacts): string[] {
  const problems: string[] = [];
  const unread = (fact: string): string => `git could not read ${fact}`;
  if (facts.originUrl === undefined) problems.push(unread("the origin remote"));
  else {
    const repo = originRepo(facts.originUrl);
    if (repo === undefined || `${repo.owner}/${repo.name}` !== REPOSITORY) {
      problems.push(`the origin remote is not https://github.com/${REPOSITORY}`);
    }
  }
  const shallow = facts.shallow?.trim();
  if (facts.grafts === undefined || (shallow !== "true" && shallow !== "false")) {
    problems.push(unread("if the clone has its full history"));
  } else if (shallow === "true" || facts.grafts) {
    problems.push("the clone is shallow or has a grafts file; merge:check needs the full history");
  }
  if (facts.config === undefined) problems.push(unread("the git settings"));
  else {
    for (const entry of facts.config.split("\0")) {
      if (entry === "") continue;
      const end = entry.indexOf("\n");
      const key = end === -1 ? entry : entry.slice(0, end);
      const value = end === -1 ? undefined : entry.slice(end + 1);
      const lower = key.toLowerCase();
      if (!WATCHED.some((prefix) => lower.startsWith(prefix))) continue;
      if (ALLOWED.has(lower) && ALLOWED.get(lower) === value) continue;
      problems.push(`the git setting ${key} can change the diff; remove it`);
    }
  }
  return problems;
}

// The environment of each git call: no inherited `GIT_` variable, and no replace objects.
export function gitEnvironment(parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(parent)) {
    if (!key.startsWith("GIT_")) env[key] = value;
  }
  env.GIT_NO_REPLACE_OBJECTS = "1";
  return env;
}

// A file of the base tip (`git ls-tree -r`) and a file here (the file system and
// `git hash-object --no-filters`, so no setting of git changes the bytes or the mode).
export type TreeEntry = { path: string; mode: string; blob: string };
export type LocalEntry = { path: string; executable: boolean; blob: string };

export function policyProblems(input: {
  tree: readonly TreeEntry[];
  local: readonly LocalEntry[];
}): string[] {
  const problems: string[] = [];
  const local = new Map(input.local.map((entry) => [entry.path, entry]));
  for (const entry of input.tree) {
    const here = local.get(entry.path);
    if (here === undefined) {
      problems.push(`${entry.path} is missing here`);
      continue;
    }
    local.delete(entry.path);
    const mode = here.executable ? "100755" : "100644";
    if (entry.mode !== mode) {
      problems.push(`${entry.path} has the mode ${mode} here and ${entry.mode} at the base tip`);
    } else if (entry.blob !== here.blob) {
      problems.push(`${entry.path} has other bytes here`);
    }
  }
  for (const path of local.keys()) problems.push(`${path} is not in the base tip`);
  return problems;
}

// A file under the policy paths here, from the file system. A link or another kind of file gets no
// blob id (`plain` is false), so it never matches the base tip.
export type LocalFile = { path: string; executable: boolean; plain: boolean };
export type FsEntry = { kind: "dir" | "file" | "other"; executable: boolean };
// The file system calls of the walk; the CLI passes `lstatSync` and `readdirSync`. `lstat` gives
// undefined for a path that does not exist.
export type PolicyFs = {
  lstat: (path: string) => FsEntry | undefined;
  readdir: (path: string) => Buffer[];
};
export type PolicyWalk = { ok: true; files: LocalFile[] } | { ok: false; reason: string };

// Each file under the policy paths, tracked or not, in byte order of the names.
export function walkPolicy(roots: readonly string[], fs: PolicyFs): PolicyWalk {
  const files: LocalFile[] = [];
  const walk = (path: string): void => {
    // A policy path that is missing here has no entry; the base tip list names it.
    const entry = fs.lstat(path);
    if (entry === undefined) return;
    if (entry.kind === "dir") {
      const names = fs.readdir(path).map((name) => name.toString("utf8"));
      for (const name of names.sort()) walk(`${path}/${name}`);
    } else {
      files.push({ path, executable: entry.executable, plain: entry.kind === "file" });
    }
  };
  for (const root of roots) walk(root);
  return { ok: true, files };
}
