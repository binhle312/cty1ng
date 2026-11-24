// Build one decision page from a content file.
// Usage: node gen.mjs <content.json> <out.html> [--allow-lint] [--text <page.txt>]
// Exit 1 when the content is not valid, or when it breaks a limit (unless --allow-lint).
// --text writes the page text and one text file per question, for a writing check.
import fs from "node:fs";
import path from "node:path";
import { validate, lint, buildPage, pageText, questionText } from "./lib.mjs";

const args = process.argv.slice(2);
const allow = args.includes("--allow-lint");
const t = args.indexOf("--text");
const textOut = t >= 0 ? args[t + 1] : undefined;
const [src, out] = args.filter((a, k) => !a.startsWith("--") && !(t >= 0 && k === t + 1));
if (!src || !out || (t >= 0 && !textOut)) { console.error("usage: node gen.mjs <content.json> <out.html> [--allow-lint] [--text <page.txt>]"); process.exit(2); }

let content;
try { content = JSON.parse(fs.readFileSync(src, "utf8")); }
catch (e) { console.error(`cannot read ${src}: ${e.message}`); process.exit(1); }

const bad = validate(content);
if (bad.length) {
  for (const error of bad) console.error("LINT " + error);
  process.exit(1);
}

if (textOut) {
  fs.mkdirSync(path.dirname(path.resolve(textOut)), { recursive: true });
  fs.writeFileSync(textOut, pageText(content).join("\n") + "\n");
  console.log(`wrote ${textOut} (the page text, one sentence or item on each line)`);
  const { dir, name } = path.parse(textOut);
  content.questions.forEach((q, i) => {
    const questionOut = path.join(dir, `${name}.q${i + 1}.txt`);
    fs.writeFileSync(questionOut, questionText(q).join("\n") + "\n");
    console.log(`wrote ${questionOut}`);
  });
}

const r = lint(content);
for (const w of r.warnings) console.log("WARN " + w);
for (const e of r.errors) console.log("LINT " + e);
for (const s of r.stats) console.log(`${s.id}: context ${s.contextWords} words, options ${s.choiceWords} words, bold ${s.boldPercent}%`);
if (r.errors.length && !allow) { console.error(`${r.errors.length} limit errors; fix the content or pass --allow-lint for a draft`); process.exit(1); }

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, buildPage(content));
console.log(`wrote ${out} (${content.questions.length} questions, ${r.errors.length} lint errors, ${r.warnings.length} warnings)`);
