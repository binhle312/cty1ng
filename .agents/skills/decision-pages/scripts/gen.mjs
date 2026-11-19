// Build one decision page from a content file.
// Usage: node gen.mjs <content.json> <out.html> [--allow-lint]
// Exit 1 when the content is not valid, or when it breaks a limit (unless --allow-lint).
import fs from "node:fs";
import path from "node:path";
import { validate, lint, buildPage } from "./lib.mjs";

const args = process.argv.slice(2);
const allow = args.includes("--allow-lint");
const [src, out] = args.filter((a) => !a.startsWith("--"));
if (!src || !out) { console.error("usage: node gen.mjs <content.json> <out.html> [--allow-lint]"); process.exit(2); }

let content;
try { content = JSON.parse(fs.readFileSync(src, "utf8")); }
catch (e) { console.error(`cannot read ${src}: ${e.message}`); process.exit(1); }

const bad = validate(content);
if (bad.length) { console.error("content is not valid:\n- " + bad.join("\n- ")); process.exit(1); }

const r = lint(content);
for (const w of r.warnings) console.log("WARN " + w);
for (const e of r.errors) console.log("LINT " + e);
for (const s of r.stats) console.log(`${s.id}: context ${s.contextWords} words, options ${s.choiceWords} words, bold ${s.boldPercent}%`);
if (r.errors.length && !allow) { console.error(`${r.errors.length} limit errors; fix the content or pass --allow-lint for a draft`); process.exit(1); }

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, buildPage(content));
console.log(`wrote ${out} (${content.questions.length} questions, ${r.errors.length} lint errors, ${r.warnings.length} warnings)`);
