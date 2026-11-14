import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// `db:check` on a copy of the committed migrations (testing.md §4): the copy passes, and a hand
// edit of its SQL fails. The committed folder is never changed.
const root = resolve(import.meta.dirname, "..");
const backend = join(root, "backend");
let folder = "";

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "cty1ng-db-check-"));
  cpSync(join(backend, "migrations"), folder, { recursive: true });
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

function edit({ file, from, to }: { file: string; from: string; to: string }): void {
  const path = join(folder, file);
  const text = readFileSync(path, "utf8");
  if (!text.includes(from)) throw new Error(`${file} has no ${from}`);
  writeFileSync(path, text.replace(from, to));
}

function dbCheck() {
  return spawnSync(process.execPath, [join(root, "scripts/db-check.ts")], {
    cwd: backend,
    env: { ...process.env, DB_CHECK_MIGRATIONS: folder },
    encoding: "utf8",
  });
}

describe("db:check", () => {
  it("passes on the committed migrations", () => {
    const run = dbCheck();
    expect(run.stdout).toContain("db:check: schema and migrations agree");
    expect(run.status).toBe(0);
  });

  it("fails when a migration drops a NOT NULL by hand", () => {
    edit({
      file: "0002_bots.sql",
      from: "`description` text NOT NULL,",
      to: "`description` text,",
    });
    const run = dbCheck();
    expect(run.stderr).toContain("bots: only the migrations have: `description` text");
    expect(run.status).toBe(1);
  });

  it("fails when a migration renames an index by hand", () => {
    edit({ file: "0001_skills.sql", from: "`skills_slug_unique`", to: "`skills_slug_key`" });
    const run = dbCheck();
    expect(run.stderr).toContain(
      "skills_slug_unique: schema.ts has it, the migrations do not make it",
    );
    expect(run.status).toBe(1);
  });
});
