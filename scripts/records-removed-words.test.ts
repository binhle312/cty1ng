import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type LedgerFile } from "./lib/records-counts.ts";
import { removedWords } from "./lib/records-removed-words.ts";

const LIVE = "docs/delivery-quality.md";
const ARCHIVE = "docs/delivery-quality-archive.md";
const HEADER = "| Issue ID | Source | Fix and verification |\n| --- | --- | --- |";

function ledger(rows: string[], path = LIVE): LedgerFile {
  return { path, text: [HEADER, ...rows, ""].join("\n") };
}

function reportRows(input: { before: string[]; after: string[] }): string[] {
  return removedWords({ base: [ledger(input.before)], head: [ledger(input.after)] });
}

describe("records:removed-words", () => {
  it("pairs a row moved to the archive", () => {
    const report = removedWords({
      base: [ledger(["| DQ-001 | review | proof checked proof |"]), ledger([], ARCHIVE)],
      head: [ledger([]), ledger(["| DQ-001 | review | proof checked |"], ARCHIVE)],
    });
    expect(report, "loss across ledger files").toEqual([
      `DQ-001 ${LIVE} -> ${ARCHIVE} [Fix and verification]: proof`,
    ]);
  });

  it("counts removed repeated words", () => {
    const report = reportRows({
      before: ["| DQ-001 | review | proof\tproof checked proof retained context here |"],
      after: ["| DQ-001 | review | retained context here proof |"],
    });
    expect(report, "repeated words in old order").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [Fix and verification]: proof checked proof`,
    ]);
  });

  it("reports removed words in their old order", () => {
    const report = reportRows({
      before: ["| DQ-001 | review | zebra kept amber |"],
      after: ["| DQ-001 | review | kept |"],
    });
    expect(report, "the order of removed words").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [Fix and verification]: zebra amber`,
    ]);
  });

  it("locates the removed phrase when words repeat", () => {
    const report = reportRows({
      before: ["| DQ-001 | safety check fails then safety check passes | proof |"],
      after: ["| DQ-001 | then safety check passes | proof |"],
    });
    expect(report, "loss at the first safety check").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [Source]: safety check fails`,
    ]);
  });

  it("reports removed words when only a cell shrinks", () => {
    const report = reportRows({
      before: ["| DQ-001 | old origin | needs proof |"],
      after: ["| DQ-001 | origin | needs a longer proof |"],
    });
    expect(report, "a short cell in a longer row").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [Source]: old`,
    ]);
  });

  it("finds the issue heading with extra spaces", () => {
    const padded = (row: string): LedgerFile => ({
      path: LIVE,
      text: `|  Issue ID  | Source | Fix and verification |\n| --- | --- | --- |\n${row}\n`,
    });
    const report = removedWords({
      base: [padded("| DQ-001 | old origin | needs proof |")],
      head: [padded("| DQ-001 | origin | needs a longer proof |")],
    });
    expect(report, "cells by a padded heading").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [Source]: old`,
    ]);
  });

  it("compares the raw row under a padded heading with no separator line", () => {
    const loose = (value: string): LedgerFile => ({
      path: LIVE,
      text: `|  Issue ID  | Source |\n\n| DQ-001 | ${value} |\n`,
    });
    const report = removedWords({ base: [loose("old")], head: [loose("replacement")] });
    expect(report, "raw row under a padded loose heading").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [raw row]: old`,
    ]);
  });

  it("compares the raw row under a heading with no separator line", () => {
    const loose = (value: string): LedgerFile => ({
      path: LIVE,
      text: `| Issue ID | Source |\n\n| DQ-001 | ${value} |\n`,
    });
    const report = removedWords({ base: [loose("old")], head: [loose("replacement")] });
    expect(report, "raw row under a loose heading").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [raw row]: old`,
    ]);
  });

  it("reports removed words when only the raw line shrinks", () => {
    const report = reportRows({
      before: ["| DQ-001 | old     | proof   |"],
      after: ["| DQ-001 | new | proof |"],
    });
    expect(report, "loss when only padding shrinks").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [Source]: old`,
    ]);
  });

  it("reports removals from the growing cell too", () => {
    const report = removedWords({
      base: [ledger(["| DQ-001 | previous origin | draft proof |"])],
      head: [
        {
          path: LIVE,
          text: "| Issue ID | Fix and verification | Source |\n| --- | --- | --- |\n| DQ-001 | a longer review proof with examples | origin |\n",
        },
      ],
    });
    expect(report, "loss from both cells by heading").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [Source]: previous`,
      `DQ-001 ${LIVE} -> ${LIVE} [Fix and verification]: draft`,
    ]);
  });

  it("measures shortening in UTF-8 bytes", () => {
    const report = reportRows({
      before: ["| DQ-001 | review | café |"],
      after: ["| DQ-001 | review | cafe |"],
    });
    expect(report, "a loss of bytes at the same string length").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [Fix and verification]: café`,
    ]);
  });

  it("reports removed words from a malformed legacy row", () => {
    const report = reportRows({
      before: ["| DQ-001 | review | a stray | separator |"],
      after: ["| DQ-001 | review | a | separator |"],
    });
    expect(report, "loss from the raw row").toEqual([`DQ-001 ${LIVE} -> ${LIVE} [raw row]: stray`]);
  });

  it("reports removed words from a growing legacy row", () => {
    const report = reportRows({
      before: ["| DQ-001 | old source | stray | tail |"],
      after: ["| DQ-001 | source | stray | much longer tail |"],
    });
    expect(report, "loss from a growing raw row").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [raw row]: old`,
    ]);
  });

  it("reports a removed word from a legacy row of equal byte length", () => {
    const report = reportRows({
      before: ["| DQ-001 | old | stray | tail |"],
      after: ["| DQ-001 | new | stray | tail |"],
    });
    expect(report, "loss from a raw row of equal byte length").toEqual([
      `DQ-001 ${LIVE} -> ${LIVE} [raw row]: old`,
    ]);
  });

  it("omits an aligned row that did not shorten", () => {
    const report = reportRows({
      before: ["| DQ-001 | review | proof |", "| DQ-002 | review | old proof |"],
      after: ["| DQ-001 | review | draft |", "| DQ-002 | review | proof |"],
    });
    expect(report, "only the shorter row").toEqual([
      `DQ-002 ${LIVE} -> ${LIVE} [Fix and verification]: old`,
    ]);
  });

  it("omits an unpaired row", () => {
    const report = reportRows({
      before: ["| DQ-001 | review | proof |", "| DQ-002 | review | earlier proof |"],
      after: ["| DQ-002 | review | proof |", "| DQ-003 | review | new proof |"],
    });
    expect(report, "only the paired row").toEqual([
      `DQ-002 ${LIVE} -> ${LIVE} [Fix and verification]: earlier`,
    ]);
  });

  it("fails for an invalid commit", () => {
    const dir = mkdtempSync(join(tmpdir(), "removed-words-cli-"));
    try {
      const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
      git("init", "--quiet");
      mkdirSync(join(dir, "docs"));
      writeFileSync(join(dir, LIVE), ledger(["| DQ-001 | review | prior proof |"]).text);
      writeFileSync(join(dir, ARCHIVE), ledger([]).text);
      git("add", "docs");
      git(
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--quiet",
        "-m",
        "fixture",
      );
      const script = fileURLToPath(new URL("./records-removed-words.ts", import.meta.url));
      const result = spawnSync(
        process.execPath,
        ["--import", import.meta.resolve("tsx"), script, "HEAD", "missing-commit"],
        { cwd: dir, encoding: "utf8" },
      );
      expect(result, "invalid commit refusal").toMatchObject({
        status: 1,
        stdout: "",
        stderr: "records:removed-words: cannot resolve commit missing-commit\n",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a duplicate issue id", () => {
    const row = "| DQ-001 | review | proof |";
    const compare = () =>
      removedWords({ base: [ledger([row])], head: [ledger([row]), ledger([row], ARCHIVE)] });
    expect(compare, "duplicate ID across ledger files").toThrow(
      `DQ-001 is in both ${LIVE} and ${ARCHIVE}`,
    );
  });
});
