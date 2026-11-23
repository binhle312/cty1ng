// Headless check of one decision page. Exit 1 on any failure.
// Usage: NODE_PATH=<dir with @playwright/test> node verify.mjs <content.json> <page.html> [--out <dir>] [--name <prefix>]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { lint, validate, copyLines, stripMarkup } from "./lib.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("@playwright/test")); } catch { ({ chromium } = require("playwright")); }

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const [src, page] = pos;
if (!src || !page) { console.error("usage: node verify.mjs <content.json> <page.html> [--out <dir>] [--name <prefix>]"); process.exit(2); }
const outDir = opt("--out", path.dirname(path.resolve(page)));
const name = opt("--name", path.basename(page, ".html"));
const c = JSON.parse(fs.readFileSync(src, "utf8"));
const N = c.questions.length;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else fail++; console.log((cond ? "PASS " : "FAIL ") + msg); };
const info = (msg) => console.log("INFO " + msg);

// 1. Content: shape and limits
const bad = validate(c);
ok(bad.length === 0, "content shape is valid" + (bad.length ? ": " + bad.join("; ") : ""));
const L = lint(c);
for (const e of L.errors) ok(false, "content lint: " + e);
ok(L.errors.length === 0, `content lint: 0 limit errors (${L.warnings.length} warnings)`);
for (const w of L.warnings) info("lint warning: " + w);
for (const s of L.stats) info(`${s.id}: context ${s.contextWords} words, options ${s.choiceWords} words, bold ${s.boldPercent}%`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const p = await ctx.newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("pageerror", (e) => errs.push(String(e)));
p.on("dialog", (d) => d.accept());
const url = pathToFileURL(path.resolve(page)).href;
await p.goto(url);
await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await p.reload();

// A report page has no questions: check the overview, the scroll and the console, then stop.
if (N === 0) {
  const t = await p.locator("main").innerText();
  ok(t.includes(stripMarkup(c.overview.heading)), "report shows its heading");
  for (const b of c.overview.blocks || []) ok(t.includes(stripMarkup(b.title)), `report shows block "${b.title}"`);
  fs.mkdirSync(outDir, { recursive: true });
  await p.screenshot({ path: path.join(outDir, `${name}-overview.png`), fullPage: true });
  await p.setViewportSize({ width: 1280, height: 800 });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll at 1280x800");
  ok(errs.length === 0, "no console errors" + (errs.length ? ": " + JSON.stringify(errs) : ""));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed\nscreenshot: ${path.join(outDir, `${name}-overview.png`)}`);
  process.exit(fail ? 1 : 0);
}

// 2. Structure
ok((await p.title()) === stripMarkup(c.page.title), "page title is " + c.page.title);
ok((await p.locator("section.step").count()) === N + 2, `steps = overview + ${N} questions + check answers (${await p.locator("section.step").count()})`);
ok((await p.locator("input[type=radio]:checked").count()) === 0, "no option is pre-checked (R3.4)");
const counts = await p.locator(".counts").innerText();
ok(/Total\s*\n?\s*\d+/.test(counts) && /Answered/.test(counts) && /Remaining/.test(counts), "header shows Total, Answered, Remaining");
ok((await p.locator(".bar img, .bar progress, [role=progressbar]").count()) === 0, "no progress bar (R5.3)");

// 3. Overview
const ov = p.locator('section.step[data-step="0"]');
ok(await ov.isVisible(), "overview is the first step");
const ovText = await ov.innerText();
ok(ovText.includes(stripMarkup(c.overview.heading)), "overview shows its heading");
for (const b of c.overview.blocks || []) ok(ovText.includes(stripMarkup(b.title)), `overview shows block "${b.title}"`);
const bars = (c.overview.blocks || []).filter((b) => b.type === "bars");
if (bars.length) {
  const box = await ov.locator(".chart svg").first().boundingBox();
  ok(box && box.width > 300 && box.height > 100, `overview chart renders (${box ? Math.round(box.width) + "x" + Math.round(box.height) : "none"})`);
  ok((await ov.locator(".chart rect").count()) === bars.reduce((n, b) => n + b.groups.reduce((m, g) => m + g.bars.length, 0), 0), "chart has one bar per value");
}
ok((await ov.locator("table").last().locator("tbody tr").count()) === N, `overview lists the ${N} questions`);
fs.mkdirSync(outDir, { recursive: true });
await p.screenshot({ path: path.join(outDir, `${name}-overview.png`) });

// 4. Each question at 1440x900
const geo = async () => p.evaluate(() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  return { headerBottom: r(".bar").bottom, footerTop: r(".nav").top, mainScroll: document.querySelector("main").scrollTop };
});
let maxBottom = 0;
const answers = {}, notes = {};
for (let i = 0; i < N; i++) {
  const q = c.questions[i], id = `Q${i + 1}`;
  if (i === 0) await p.keyboard.press("ArrowRight"); else await p.click("#next");
  const s = p.locator(`section.step[data-step="${i + 1}"]`);
  ok(await s.isVisible(), `${id}: step opens (${i === 0 ? "arrow key" : "Next button"})`);
  ok((await s.locator("h1").innerText()).trim() === stripMarkup(q.title), `${id}: shows the question as the title`);
  const ask = s.locator(".ask");
  ok((await ask.isVisible()) && (await ask.innerText()).startsWith("Decide:"), `${id}: shows the ask, "Decide: ..."`);
  ok((await s.locator(".facts li").count()) === q.facts.length && (await s.locator(".facts").isVisible()), `${id}: shows ${q.facts.length} key facts`);
  ok((await s.locator(".example .steps-ex li").count()) === q.example.steps.length && (await s.locator(".example").isVisible()), `${id}: shows the example as ${q.example.steps.length} steps`);
  ok((await s.locator('[data-pick]').count()) === 1 && (await s.locator("[data-pick]").getAttribute("data-key")) === q.pick.key, `${id}: exactly one option marked as my pick (${q.pick.key})`);
  ok((await s.locator(".pick").getAttribute("data-pick-line")) === q.pick.key && /Confidence:/.test(await s.locator(".pick").innerText()) && /Pick another if:/.test(await s.locator(".pick").innerText()), `${id}: pick line names letter, confidence and "Pick another if"`);
  const g = await geo();
  const opts = s.locator(".opt");
  const n = await opts.count();
  ok(n === q.options.length, `${id}: ${n} options`);
  let allIn = true, allFields = true, bottom = 0;
  for (let k = 0; k < n; k++) {
    const o = opts.nth(k);
    const b = await o.locator("label").boundingBox();
    bottom = Math.max(bottom, b.y + b.height);
    if (b.y < g.headerBottom || b.y + b.height > g.footerTop) allIn = false;
    for (const f of [".gets", ".costs", ".risk", ".tag[class*=risk-]"]) {
      const el = o.locator(f);
      if (!(await el.isVisible()) || !(await el.innerText()).trim()) allFields = false;
    }
  }
  maxBottom = Math.max(maxBottom, bottom);
  ok(allFields, `${id}: every option shows Gets, Costs, Risk text and a "Risk: level" chip`);
  ok(allIn && g.mainScroll === 0, `${id}: all option cards are in the first viewport at 1440x900, no scroll (lowest card bottom ${Math.round(bottom)} px, footer top ${Math.round(g.footerTop)} px)`);
  const measure = await s.evaluate((el) => {
    const probe = document.createElement("span"); probe.textContent = "0000000000"; probe.style.cssText = "position:absolute;visibility:hidden;font:16px/1.5 var(--font)";
    el.appendChild(probe); const ch = probe.getBoundingClientRect().width / 10; probe.remove();
    return Math.max(...[...el.querySelectorAll(".ctx > p, .ctx .facts")].map((x) => x.getBoundingClientRect().width / ch));
  });
  ok(measure <= 75, `${id}: context text measure ${measure.toFixed(0)}ch <= 75 (R2.6)`);
  ok((await s.locator("input[type=radio]:checked").count()) === 0, `${id}: no option checked before an answer`);
  if (i === 0) await p.screenshot({ path: path.join(outDir, `${name}-q1.png`) });
  // answer: keyboard digit on odd steps, click on even steps; choose the last option on Q2 to test a non-pick
  const choice = i === 1 ? q.options[q.options.length - 1].key : q.pick.key;
  if (i % 2 === 0) await p.keyboard.press(String(q.options.findIndex((o) => o.key === choice) + 1));
  else await s.locator(`.opt[data-key="${choice}"] label`).click();
  answers[id] = choice;
  ok((await s.locator(`input[value="${choice}"]`).isChecked()), `${id}: answer ${choice} is checked (${i % 2 === 0 ? "key" : "click"})`);
  if (i === 0 || i === 2) { const t = `note for ${id}: test`; await s.locator("textarea").fill(t); notes[id] = t; }
}
info(`lowest option card bottom over all questions: ${Math.round(maxBottom)} px of 900`);
ok((await p.locator("#cA").innerText()) === String(N) && (await p.locator("#cR").innerText()) === "0", "header counts update to all answered");

// 5. Saved state survives a reload (R5.6)
await p.reload();
ok(await p.locator(`section.step[data-step="${N}"]`).isVisible(), "reload returns to the same step");
ok((await p.locator("input[type=radio]:checked").count()) === N, "reload keeps all answers");
ok((await p.locator("#n-Q1").inputValue()) === notes.Q1, "reload keeps the notes");

// 6. Check answers step
await p.click("#next");
const fin = p.locator(`section.step[data-step="${N + 1}"]`);
ok(await fin.isVisible(), "last step is Check your answers");
ok((await fin.locator("tbody tr").count()) === N, `check step lists ${N} rows`);
let rowsOk = true;
for (let i = 0; i < N; i++) {
  const q = c.questions[i], row = fin.locator(`tr[data-q="Q${i + 1}"]`), o = q.options.find((x) => x.key === answers[`Q${i + 1}`]);
  const t = await row.innerText();
  if (!t.includes(stripMarkup(q.title)) || !t.includes(`${o.key}. ${stripMarkup(o.label)}`)) rowsOk = false;
}
ok(rowsOk, "each row shows the question title and the chosen option");
ok((await fin.locator('tr[data-q="Q1"]').innerText()).includes(notes.Q1), "the row shows the note");
// The Change link of row Q2 opens step 2; a page with one question has only row Q1.
const back = N >= 2 ? 2 : 1;
await fin.locator(`tr[data-q="Q${back}"] button[data-go]`).click();
ok(await p.locator(`section.step[data-step="${back}"]`).isVisible(), "Change link opens its question");
await p.click('.sbtn[data-go="' + (N + 1) + '"]');
await p.click("#copy");
await p.waitForTimeout(300);
const clip = await p.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR " + e));
const expect = copyLines(c, answers, notes);
ok(clip === expect, "copied text matches the expected format");
let allQ = true;
for (let i = 1; i <= N; i++) if (!new RegExp(`^Q${i}: [A-Z] `, "m").test(clip)) allQ = false;
ok(allQ, `copied text has a line "Qn: <letter> <label>" for all ${N} questions`);
console.log("---- copied text ----\n" + clip + "\n---------------------");
await p.screenshot({ path: path.join(outDir, `${name}-finish.png`) });

// 7. No horizontal scroll at 1280x800, every step
await p.setViewportSize({ width: 1280, height: 800 });
let hOk = true;
for (let k = 0; k <= N + 1; k++) {
  await p.evaluate((k) => window.decisionPage.go(k, false), k);
  const over = await p.evaluate(() => {
    const m = document.querySelector("main");
    return document.documentElement.scrollWidth > innerWidth || m.scrollWidth > m.clientWidth;
  });
  if (over) { hOk = false; info(`horizontal overflow on step ${k}`); }
}
ok(hOk, "no horizontal scroll at 1280x800 on any step");
let in1280 = true;
for (let i = 0; i < N; i++) {
  await p.evaluate((k) => window.decisionPage.go(k, false), i + 1);
  const r = await p.evaluate((k) => {
    const s = document.querySelector(`section.step[data-step="${k}"]`), f = document.querySelector(".nav").getBoundingClientRect().top;
    return { bottom: Math.max(...[...s.querySelectorAll(".opt > label")].map((e) => e.getBoundingClientRect().bottom)), f };
  }, i + 1);
  if (r.bottom > r.f) { in1280 = false; info(`Q${i + 1}: at 1280x800 the lowest option card ends at ${Math.round(r.bottom)} px, ${Math.round(r.bottom - r.f)} px below the fold (footer top ${Math.round(r.f)} px)`); }
}
info(`options fully in the first viewport at 1280x800: ${in1280 ? "all questions" : "not all (see above)"}`);

// 8. Clear answers, dark mode look
await p.setViewportSize({ width: 1440, height: 900 });
await p.evaluate((k) => window.decisionPage.go(k, false), N + 1);
await p.click("#clear");
ok((await p.locator("input[type=radio]:checked").count()) === 0 && (await p.locator("#cA").innerText()) === "0", "Clear my answers removes all answers");
await p.emulateMedia({ colorScheme: "dark" });
await p.evaluate(() => window.decisionPage.go(1, false));
await p.screenshot({ path: path.join(outDir, `${name}-q1-dark.png`) });
await p.emulateMedia({ colorScheme: "light" });
await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

ok(errs.length === 0, "no console errors" + (errs.length ? ": " + JSON.stringify(errs) : ""));
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
console.log(`screenshots: ${["overview", "q1", "finish", "q1-dark"].map((s) => path.join(outDir, `${name}-${s}.png`)).join(", ")}`);
process.exit(fail ? 1 : 0);
