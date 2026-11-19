// The checks behind `pnpm check:status`: each PR merged into `main` on or after SINCE has a link
// in a row of the Done table of docs/status.md. A PR cannot record its own merge, so the next PR
// adds the row (workflows/pull-request.md, "Before each push", step 6). Pure: the caller reads
// the git history and the file.

// The start date. The code work starts on 2026-10-30 (M0, #45), and from #45 each PR merges with
// a merge commit; the specification PRs before it are recorded in grouped rows
// (plans/p3-check-status.md, probe 3).
export const SINCE = "2026-10-30";

const PULL_LINK = "https://github.com/binhle312/cty1ng/pull/";
const LINK_PATTERN = new RegExp(`\\]\\(${PULL_LINK.replaceAll(".", "\\.")}(\\d+)\\)`, "g");

export type Merged = { pr: number; date: string; sha: string };

// Reads `git log --first-parent --format=%H%x09%cI%x09%s` lines. A merge commit has the subject
// "Merge pull request #N from …", and a squash merge ends its subject with "(#N)". `date` is the
// date part of the committer date as the commit records it, so each machine gives the same date.
export function mergedPrs(log: string): Merged[] {
  const merged: Merged[] = [];
  for (const line of log.split("\n")) {
    const [sha, committed, subject] = line.split("\t");
    if (sha === undefined || committed === undefined || subject === undefined) continue;
    const number =
      /^Merge pull request #(\d+) from /.exec(subject)?.[1] ?? /\(#(\d+)\)$/.exec(subject)?.[1];
    if (number === undefined) continue;
    merged.push({ pr: Number(number), date: committed.slice(0, 10), sha });
  }
  return merged;
}

// The PR numbers that the rows of the Done table link, and a problem for each data row that is
// not `| YYYY-MM-DD | … |`. A broken row counts no link.
export function doneRows(statusMd: string): { prs: Set<number>; problems: string[] } {
  const prs = new Set<number>();
  const start = statusMd.search(/^## Done$/m);
  if (start === -1) return { prs, problems: ["docs/status.md has no ## Done section"] };
  const rest = statusMd.slice(start + "## Done".length);
  const next = rest.search(/^## /m);
  const problems: string[] = [];
  for (const line of (next === -1 ? rest : rest.slice(0, next)).split("\n")) {
    if (!line.startsWith("|") || line.startsWith("| Date |") || /^\|[\s|-]+\|$/.test(line))
      continue;
    if (!/^\| \d{4}-\d{2}-\d{2} \| .+ \|$/.test(line)) {
      problems.push(`docs/status.md Done row is not "| YYYY-MM-DD | … |": ${line}`);
      continue;
    }
    for (const match of line.matchAll(LINK_PATTERN)) prs.add(Number(match[1]));
  }
  return { prs, problems };
}

// A memory promotion PR changes only long-term memory, and it needs no Done row
// (`.agents/memories/README.md`, "Promote"; AGENTS.md §9). One file outside that folder makes it
// an ordinary PR.
export const PROMOTION_FOLDER = ".agents/memories/long-term/";

export function isPromotion(files: readonly string[]): boolean {
  return files.length > 0 && files.every((file) => file.startsWith(PROMOTION_FOLDER));
}

// `changedFiles` gives the files of a merged PR; the caller reads them from git, and only for a PR
// with no Done row. With no `changedFiles`, no PR counts as a promotion.
export function checkStatus(input: {
  merged: readonly Merged[];
  statusMd: string;
  since: string;
  changedFiles?: (merged: Merged) => readonly string[];
}): string[] {
  const done = doneRows(input.statusMd);
  const changedFiles = input.changedFiles;
  const missing = input.merged
    .filter((m) => m.date >= input.since && !done.prs.has(m.pr))
    .filter((m) => changedFiles === undefined || !isPromotion(changedFiles(m)))
    .map(
      (m) =>
        `#${m.pr} (merged ${m.date}, ${m.sha.slice(0, 7)}) has no Done row in docs/status.md. ` +
        `Add: | ${m.date} | [#${m.pr}](${PULL_LINK}${m.pr}) merged. |`,
    );
  return [...done.problems, ...missing];
}
