// Old guard against the checked-out guard: `tsx scripts/guard-compare.ts [revision]` (default: the
// merge base with origin/main). It prints every group of differences, so a reviewer can read why
// each one exists. All values are synthetic and seeded, so a rerun prints the same result.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { findSensitive as findNew } from "../backend/src/core/guard/sensitive-data.rules.ts";

type Find = typeof findNew;

const GUARD = "backend/src/core/guard/sensitive-data.rules.ts";
const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trim();
const revision = process.argv[2] ?? git("merge-base", "HEAD", "origin/main");

// The old guard, from git, in a temporary file that only this run reads.
const folder = mkdtempSync(join(tmpdir(), "guard-compare-"));
const oldPath = join(folder, "old-guard.ts");
writeFileSync(oldPath, git("show", `${revision}:${GUARD}`));
const OldGuard = z.object({
  findSensitive: z.custom<Find>((value) => typeof value === "function"),
});
const { findSensitive: findOld } = OldGuard.parse(await import(oldPath));

const label = (find: Find, text: string): string =>
  find(text)
    .map((match) => match.kind)
    .join("+") || "free";

// Part 1: every key, separator, value, wrapper and tail.
const KEYS = [
  "password",
  "PASSWORD",
  "dbPassword",
  "DB_PASSWORD",
  "passwd",
  "PASSWORD1",
  "DB_PASSWORD_PROD",
  "DB_PASSWORD_UAT",
  "DB_PASSWORD_ROOT",
  "pwd",
  "PWD",
  "PWD1",
  "OLD_PWD",
  "DB_PWD_2",
  "dbPwd",
  "DB_PASS",
  "DB_PASS1",
  "DB_PASS_PROD",
  "test_pass",
  "require_password",
  '"password"',
  "'password'",
  '\\"password\\"',
  '["password"]',
  "`password`",
  "**password**",
  "**password",
  "setPassword]",
  "password_policy",
  "passwordless",
];
const SEPARATORS = [":", "=", ": ", " = ", ":=", "=>", " := ", " => ", ":**", ":** ", ": *", "=  "];
const VALUES = [
  "true",
  "false",
  "null",
  "TRUE",
  "string",
  "boolean",
  "number",
  "text",
  "varchar(255)",
  "char",
  "string|null",
  "true|false",
  "string|abcd",
  "abc",
  "abcd",
  "ab",
  "hunter22",
  "changeme",
  "$ecret12",
  "$DB_SECRET",
  "${DB_SECRET}",
  "${{ secrets.X }}",
  "${{secrets.X}}",
  "{hunter22}",
  "{false}",
  "{true",
  "/home/owner",
  "~/work",
  "../work",
  "$(pwd)",
  "/hunter22",
  "it's-long",
  "a'bcd",
  "false!",
  "true?",
  "false.",
  "!true!",
  "trueSecret",
  "false alarm",
  "true and more",
  "my long phrase",
  "a b",
  "a bc",
  '{"type":"string"}',
  '{"type": "string"}',
  '{"type":"string","minLength":8}',
  '{"type":"string","default":"hunter22"}',
  '{"value":"hunter22"}',
  '["hunter22"]',
  'useState("")',
  "useState()",
  'useState("hunter22")',
  "useState(null)",
  "useState(undefined)",
  "useState<string | null>(null)",
  'useState<string | null>("hunter22")',
  '{"type":"string","default":1234}',
  '{"type":"string","secret":1234}',
  '{"type":"string","format":"hunter22"}',
  '{"type":"string","format":"password"}',
  '{"type":"string","writeOnly":true}',
  'string = "hunter22"',
  "string = 'hunter22'",
  'string | null = "hunter22"',
  'str = "hunter22"',
  'string = ""',
  'string = "abc"',
  "string = process.env.X",
  "string = getPassword()",
  'string = "${DB_SECRET}"',
  "z.string().min(8)",
  "async",
  "done",
];
const WRAPS: readonly (readonly [string, string])[] = [
  ["", ""],
  ['"', '"'],
  ["'", "'"],
  ["`", "`"],
  ['\\"', '\\"'],
  ["{", "}"],
  ["(", ")"],
  ['"', ""],
  ["'", ""],
  ["`", ""],
];
const TAILS = [
  "",
  " ",
  ",",
  ";",
  ")",
  "}",
  "]",
  "`",
  ").",
  "):",
  "`.",
  ',"a":1',
  ",a:1",
  ",a?:1",
  ",a-b:1",
  "/>",
  ">",
  ">Text",
  ")=>x",
  ")=",
  "!",
  ",x",
  " rest of it",
  "\r",
  ',"password":"hunter22"',
  ",password:hunter22",
  " password: hunter22",
];

// old -> new, then the wrapped value, with the count and the first text.
const groups = new Map<string, Map<string, { count: number; first: string }>>();
let total = 0;
let different = 0;
for (const key of KEYS) {
  for (const separator of SEPARATORS) {
    for (const value of VALUES) {
      for (const [open, close] of WRAPS) {
        for (const tail of TAILS) {
          const text = `${key}${separator}${open}${value}${close}${tail}`;
          total += 1;
          const before = label(findOld, text);
          const after = label(findNew, text);
          if (before === after) continue;
          different += 1;
          const name = `${before} -> ${after}`;
          const shapes = groups.get(name) ?? new Map<string, { count: number; first: string }>();
          groups.set(name, shapes);
          const shape = `${open}${value}${close}`;
          const seen = shapes.get(shape);
          if (seen === undefined) shapes.set(shape, { count: 1, first: text });
          else seen.count += 1;
        }
      }
    }
  }
}

console.log(`# Base ${revision}, compared with the checked-out guard`);
console.log(`\n## Forms: ${String(total)} inputs, ${String(different)} differ`);
for (const [name, shapes] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  const count = [...shapes.values()].reduce((sum, shape) => sum + shape.count, 0);
  console.log(`\n### ${name}: ${String(count)} inputs, ${String(shapes.size)} shapes`);
  for (const shape of [...shapes.values()].sort((a, b) => b.count - a.count)) {
    console.log(`  ${String(shape.count).padStart(6)}  ${JSON.stringify(shape.first)}`);
  }
}

// Part 2: random values from each alphabet. The old guard reads `api_key = <value>`, because it
// counted the `=` of `API_KEY=<value>` as a part of the value. The new guard reads `API_KEY=`.
const SAMPLES = 20_000;
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = LOWER.toUpperCase();
const DIGITS = "0123456789";
const ALPHABETS: Readonly<Record<string, string>> = {
  base62: LOWER + UPPER + DIGITS,
  base64: `${LOWER}${UPPER}${DIGITS}+/`,
  base64url: `${LOWER}${UPPER}${DIGITS}_-`,
  "lowercase and digits": LOWER + DIGITS,
  "capitals and digits": UPPER + DIGITS,
  "base32 capitals": `${UPPER}234567`,
  "mixed-case letters": LOWER + UPPER,
  hex: "0123456789abcdef",
};

// mulberry32: small, and the same on every machine.
const seededRandom = (start: number) => {
  let seed = start;
  return (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
};
const percent = (count: number): string => `${((100 * count) / SAMPLES).toFixed(3)}%`;

console.log(`\n## Random values: ${String(SAMPLES)} for each row`);
console.log("| Alphabet | Length | Old refuses | New refuses | Old refuses, new frees | Example |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const [name, alphabet] of Object.entries(ALPHABETS)) {
  for (const length of [24, 32, 40, 64]) {
    const next = seededRandom(length * 1_000 + alphabet.length);
    let oldRefuses = 0;
    let newRefuses = 0;
    let escaped = 0;
    let example = "";
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      const value = Array.from(
        { length },
        () => alphabet[Math.floor(next() * alphabet.length)],
      ).join("");
      const before = findOld(`api_key = ${value}`).length > 0;
      const after = findNew(`API_KEY=${value}`).length > 0;
      if (before) oldRefuses += 1;
      if (after) newRefuses += 1;
      if (before && !after) {
        escaped += 1;
        if (example === "") example = value;
      }
    }
    console.log(
      `| ${name} | ${String(length)} | ${percent(oldRefuses)} | ${percent(newRefuses)} | ${percent(escaped)} | ${example} |`,
    );
  }
}

// Part 3: the Markdown and seed text in the repository.
const files = git("ls-files", "*.md", "*.mdx", "seed/*", ".agents/*")
  .split("\n")
  .filter((file) => /\.(md|mdx|txt)$/.test(file));
const matchKey = (match: { kind: string; line: number; ending: string }): string =>
  `${match.kind}:${String(match.line)}:${match.ending}`;
let added = 0;
let removed = 0;
console.log(`\n## Tracked text: ${String(files.length)} files`);
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const before = findOld(text);
  const after = findNew(text);
  const had = new Set(before.map(matchKey));
  const has = new Set(after.map(matchKey));
  for (const match of after.filter((found) => !had.has(matchKey(found)))) {
    added += 1;
    console.log(`  added   ${file}:${String(match.line)} ${match.kind}`);
  }
  for (const match of before.filter((found) => !has.has(matchKey(found)))) {
    removed += 1;
    console.log(`  removed ${file}:${String(match.line)} ${match.kind}`);
  }
}
console.log(`  ${String(added)} added, ${String(removed)} removed`);

// Part 4: rules that must hold for every input of part 1, in the checked-out guard.
const answer = (text: string): string =>
  findNew(text)
    .map((match) => `${match.kind}:${match.ending}`)
    .join("+") || "free";
const FREE_KEYS = /policy|less|test_pass/;
const SECRETS_AFTER = TAILS.filter((tail) => tail.includes("hunter22"));
let separatorInputs = 0;
let separatorDifferences = 0;
let secretInputs = 0;
let secretsLost = 0;
for (const key of KEYS) {
  for (const value of VALUES) {
    for (const [open, close] of WRAPS) {
      const token = `${open}${value}${close}`;
      // A separator gives the same answer as a colon: it is never a part of the value.
      for (const separator of [":=", "=>", ":**", " := ", " => ", ":** "]) {
        for (const tail of TAILS) {
          separatorInputs += 1;
          const text = `${key}${separator}${token}${tail}`;
          if (answer(text) !== answer(`${key}: ${token}${tail}`)) separatorDifferences += 1;
        }
      }
      // A free value does not hide a later key. It says nothing about text with no key: that stays
      // free (security.md §2.13).
      if (FREE_KEYS.test(key)) continue;
      for (const separator of [":", "=", ": ", ":=", "=>", ":**"]) {
        for (const tail of SECRETS_AFTER) {
          secretInputs += 1;
          if (findNew(`${key}${separator}${token}${tail}`).length === 0) secretsLost += 1;
        }
      }
    }
  }
}
console.log("\n## Rules");
console.log(
  `  A separator differs from a colon: ${String(separatorDifferences)} of ${String(separatorInputs)}`,
);
console.log(`  A free value hides a later key: ${String(secretsLost)} of ${String(secretInputs)}`);

rmSync(folder, { recursive: true });
