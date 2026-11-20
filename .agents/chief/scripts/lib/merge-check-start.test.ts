// The start check of merge:check (plan delta r1 §3; owner, 2026-11-20, order 131): the facts of
// the local clone before snapshot 1, the git environment, and the policy files against the base
// tip. The CLI tests run each fact end to end; these tests give each rule its own case. All data
// is synthetic.
import { describe, expect, it } from "vitest";
import {
  type StartFacts,
  gitEnvironment,
  type FsEntry,
  type PolicyFs,
  policyProblems,
  startProblems,
  walkPolicy,
} from "./merge-check-start.ts";
import { REPOSITORY } from "./merge-list.ts";

const GOOD: StartFacts = {
  originUrl: `https://github.com/${REPOSITORY}.git`,
  shallow: "false\n",
  grafts: false,
  config: "core.bare\nfalse\0extensions.worktreeconfig\ntrue\0extensions.objectformat\nsha1\0",
};
const problems = (extra: Partial<StartFacts>): string =>
  startProblems({ ...GOOD, ...extra }).join("\n");

describe("startProblems", () => {
  it("passes a full clone of the repository with no setting that changes the diff", () => {
    expect(startProblems(GOOD), "good clone").toEqual([]);
    for (const url of [
      `git@github.com:${REPOSITORY}.git`,
      `ssh://git@github.com/${REPOSITORY}.git`,
      `https://github.com/${REPOSITORY}`,
    ]) {
      expect(startProblems({ ...GOOD, originUrl: url }), `origin form ${url}`).toEqual([]);
    }
  });

  it("refuses an origin that is not the repository on github.com", () => {
    for (const url of [
      "https://github.com/someone/cty1ng.git",
      `ssh://git@example.org/${REPOSITORY}.git`,
      `https://github.com.example.org/${REPOSITORY}.git`,
      `https://example.org/github.com/${REPOSITORY}.git`,
      "",
    ]) {
      expect(problems({ originUrl: url }), `origin ${url}`).toContain("the origin remote is not");
    }
  });

  it("refuses a shallow clone and a grafts file", () => {
    expect(problems({ shallow: "true\n" }), "shallow").toContain("the full history");
    expect(problems({ grafts: true }), "grafts").toContain("the full history");
  });

  it("refuses each diff, submodule or extensions setting outside the allowlist", () => {
    for (const entry of [
      "diff.ignoresubmodules\nall",
      "diff.zzz\n1",
      "diff.flag",
      "submodule.lib.ignore\nall",
      "extensions.objectformat\nsha256",
      "extensions.worktreeconfig\nfalse",
      "extensions.zzz\ntrue",
    ]) {
      const key = entry.split("\n")[0] ?? "";
      expect(problems({ config: `core.bare\nfalse\0${entry}\0` }), `setting ${key}`).toContain(
        `the git setting ${key}`,
      );
    }
  });

  it("cannot check a fact that git could not read", () => {
    for (const fact of ["originUrl", "shallow", "grafts", "config"] as const) {
      expect(problems({ [fact]: undefined }), `unread ${fact}`).toContain("git could not read");
    }
    expect(problems({ shallow: "maybe\n" }), "unknown shallow answer").toContain(
      "git could not read",
    );
  });
});

describe("gitEnvironment", () => {
  it("removes each inherited GIT_ variable and turns replace objects off", () => {
    expect(
      gitEnvironment({ PATH: "/bin", GIT_DIR: "/x", GIT_ZZZ: "1", GIT_NO_REPLACE_OBJECTS: "0" }),
      "env",
    ).toEqual({ PATH: "/bin", GIT_NO_REPLACE_OBJECTS: "1" });
  });
});

describe("policyProblems", () => {
  const BLOB = "a".repeat(40);
  const tree = [{ path: "scripts/x.ts", mode: "100644", blob: BLOB }];
  it("passes when each path, blob and executable bit is the same", () => {
    expect(
      policyProblems({ tree, local: [{ path: "scripts/x.ts", executable: false, blob: BLOB }] }),
      "same",
    ).toEqual([]);
  });

  it("names a file whose blob, executable bit or presence differs", () => {
    const cases: [string, { path: string; executable: boolean; blob: string }[]][] = [
      ["blob", [{ path: "scripts/x.ts", executable: false, blob: "b".repeat(40) }]],
      ["executable bit", [{ path: "scripts/x.ts", executable: true, blob: BLOB }]],
      ["missing", []],
      [
        "extra",
        [
          { path: "scripts/x.ts", executable: false, blob: BLOB },
          { path: "scripts/y.ts", executable: false, blob: BLOB },
        ],
      ],
    ];
    for (const [name, local] of cases) {
      expect(policyProblems({ tree, local }).join("\n"), `policy ${name}`).toContain("scripts/");
    }
    expect(
      policyProblems({
        tree: [{ path: "scripts/l", mode: "120000", blob: BLOB }],
        local: [{ path: "scripts/l", executable: false, blob: BLOB }],
      }).join("\n"),
      "a link in the tree",
    ).toContain("scripts/l");
  });
});

// Plan delta r2 §5 (DQ-1042, DQ-1044): names as bytes, "no entry" only for a top path, and a read
// error gives a reason (exit 2), not an exception.
describe("walkPolicy", () => {
  const DIR: FsEntry = { kind: "dir", executable: false };
  const FILE: FsEntry = { kind: "file", executable: false };
  const fsOf = (
    tree: Record<string, FsEntry | "gone">,
    dirs: Record<string, Buffer[]>,
  ): PolicyFs => ({
    lstat: (path) => {
      const entry = tree[path];
      return entry === undefined || entry === "gone" ? undefined : entry;
    },
    readdir: (path) => {
      const names = dirs[path];
      if (names === undefined) throw Object.assign(new Error("denied"), { code: "EACCES" });
      return names;
    },
  });
  const said = (walk: ReturnType<typeof walkPolicy>): string =>
    walk.ok ? `ok ${walk.files.map((file) => file.path).join(",")}` : `stop ${walk.reason}`;

  it("lists each file of a folder and allows a missing top path", () => {
    const fs = fsOf({ scripts: DIR, "scripts/a.ts": FILE }, { scripts: [Buffer.from("a.ts")] });
    expect(said(walkPolicy(["scripts", "package.json"], fs)), "files").toBe("ok scripts/a.ts");
  });

  it("stops for an entry of readdir that lstat does not find", () => {
    const fs = fsOf({ scripts: DIR, "scripts/a.ts": "gone" }, { scripts: [Buffer.from("a.ts")] });
    expect(said(walkPolicy(["scripts"], fs)), "gone entry").toMatch(/^stop .*scripts\/a\.ts/);
  });

  it("stops for a name with a byte that is not printable ASCII", () => {
    for (const name of [Buffer.from([0x78, 0xff]), Buffer.from("x y.ts")]) {
      const fs = fsOf({ scripts: DIR }, { scripts: [name] });
      expect(said(walkPolicy(["scripts"], fs)), `name ${name.toString("hex")}`).toMatch(
        /^stop .*cannot keep exactly/,
      );
    }
  });

  it("stops with a reason when a folder cannot be read", () => {
    const fs = fsOf({ scripts: DIR }, {});
    expect(said(walkPolicy(["scripts"], fs)), "unreadable folder").toMatch(
      /^stop .*could not read scripts/,
    );
  });
});
