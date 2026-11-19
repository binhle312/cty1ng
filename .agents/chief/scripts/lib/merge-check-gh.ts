// The gh reads of `pnpm merge:check`: the PR head, its changed files, its CI checks, and the texts
// that the classify step needs. The caller passes the command runner, so tests use a fake gh. Zod
// parses each answer; an answer that does not parse means "cannot check".
import { z } from "zod";
import { MEMORY_FOLDER } from "./merge-list.ts";
import { type CiCheck, type FileStatus, MAX_FILES, type PrFile, needsText } from "./merge-check.ts";

export type Run = (args: readonly string[]) => { status: number; stdout: string };
export type PrRead =
  | { ok: true; head: string; files: PrFile[]; checks: CiCheck[] }
  | { ok: false; reason: string; memory: boolean };

const SHA = z.string().regex(/^[0-9a-f]{40}$/);
const CHECK = z.union([
  z.object({
    __typename: z.literal("CheckRun"),
    name: z.string(),
    status: z.string(),
    conclusion: z.string().nullable(),
  }),
  z.object({ __typename: z.literal("StatusContext"), context: z.string(), state: z.string() }),
]);
const VIEW = z.object({
  headRefOid: SHA,
  baseRefOid: SHA,
  changedFiles: z.number().int().nonnegative(),
  statusCheckRollup: z.array(CHECK).nullable(),
});
const STATUSES = [
  "added",
  "removed",
  "modified",
  "renamed",
  "copied",
  "changed",
  "unchanged",
] as const satisfies readonly FileStatus[];
const FILE = z.object({
  filename: z.string().min(1),
  status: z.enum(STATUSES),
  previous_filename: z.string().min(1).optional(),
});
const CONTENT = z.object({ encoding: z.literal("base64"), content: z.string() });

// A check passes when it ended as success, skipped or neutral (a job without its secret skips).
const PASS = new Set(["SUCCESS", "SKIPPED", "NEUTRAL"]);
function checkOf(check: z.infer<typeof CHECK>): CiCheck {
  if (check.__typename === "StatusContext") {
    const state =
      check.state === "SUCCESS" ? "pass" : check.state === "PENDING" ? "pending" : "fail";
    return { name: check.context, state };
  }
  if (check.status !== "COMPLETED" || check.conclusion === null) {
    return { name: check.name, state: "pending" };
  }
  return { name: check.name, state: PASS.has(check.conclusion) ? "pass" : "fail" };
}

class Failed extends Error {}

function parseJson<T>(input: { schema: z.ZodType<T>; text: string; what: string }): T {
  const { schema, text, what } = input;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Failed(`gh gave bad JSON for ${what}`);
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Failed(`gh gave an unexpected answer for ${what}`);
  return parsed.data;
}

export function readPr(number: number, run: Run): PrRead {
  let memory = false;
  const gh = (args: string[], what: string): string => {
    const result = run(args);
    if (result.status !== 0) throw new Failed(`gh failed to read ${what}`);
    return result.stdout;
  };
  try {
    const view = parseJson({
      schema: VIEW,
      text: gh(
        [
          "pr",
          "view",
          String(number),
          "--json",
          "headRefOid,baseRefOid,changedFiles,statusCheckRollup",
        ],
        "the PR",
      ),
      what: "the PR",
    });
    // `--jq '.[]'` writes one file object on each line, for each page.
    const lines = gh(
      ["api", "--paginate", `repos/{owner}/{repo}/pulls/${number}/files`, "--jq", ".[]"],
      "the files",
    )
      .split("\n")
      .filter((line) => line.trim() !== "");
    const raw = lines.map((line) => parseJson({ schema: FILE, text: line, what: "a file" }));
    if (raw.length >= MAX_FILES)
      throw new Failed(`${raw.length} files; the GitHub API gives 3,000 at most`);
    if (raw.length !== view.changedFiles) {
      throw new Failed(`gh gave ${raw.length} files, but the PR has ${view.changedFiles}`);
    }
    memory = raw.every((f) => f.filename.startsWith(MEMORY_FOLDER));
    const textAt = (path: string, ref: string): string => {
      const encoded = path.split("/").map(encodeURIComponent).join("/");
      const answer = parseJson({
        schema: CONTENT,
        text: gh(["api", `repos/{owner}/{repo}/contents/${encoded}?ref=${ref}`], path),
        what: `the text of ${path}`,
      });
      return Buffer.from(answer.content, "base64").toString("utf8");
    };
    const files = raw.map((f): PrFile => {
      const file: PrFile = {
        path: f.filename,
        previousPath: f.previous_filename,
        status: f.status,
      };
      const old = f.previous_filename ?? f.filename;
      if (!needsText(f.filename) && !needsText(old)) return file;
      return {
        ...file,
        ...(f.status === "added" ? {} : { baseText: textAt(old, view.baseRefOid) }),
        ...(f.status === "removed" ? {} : { headText: textAt(f.filename, view.headRefOid) }),
      };
    });
    return {
      ok: true,
      head: view.headRefOid,
      files,
      checks: (view.statusCheckRollup ?? []).map(checkOf),
    };
  } catch (error) {
    if (error instanceof Failed) return { ok: false, reason: error.message, memory };
    throw error;
  }
}
