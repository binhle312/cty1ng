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
const sameText = (actual, expected) => actual.replace(/\s+/g, " ").trim() === stripMarkup(expected).replace(/\s+/g, " ").trim();
const voteText = (votes) => votes?.length
  ? votes.map(({ role, name }) => role[0].toUpperCase() + role.slice(1) + ": " + name.replace(/\s+/g, " ").trim())
  : ["No votes"];
async function voteTintsMatch(step, q) {
  for (const [k, option] of q.options.entries()) {
    const badges = step.locator(".opt").nth(k).locator(".votes > span");
    for (const [j, { role }] of (option.votes || []).entries()) {
      const badge = badges.nth(j);
      const token = role === "lead agent" ? "lead" : role;
      if (!(await badge.isVisible()) || !(await badge.evaluate((el, role) => {
        const actual = getComputedStyle(el);
        const color = document.createElement("span").style;
        color.backgroundColor = actual.getPropertyValue(`--${role}-bg`).trim();
        color.color = actual.getPropertyValue(`--${role}-ink`).trim();
        return actual.backgroundColor === color.backgroundColor && actual.color === color.color
          && actual.backgroundColor !== getComputedStyle(el.closest(".opt")).backgroundColor;
      }, token))) return false;
    }
  }
  return true;
}

// 1. Content: shape and limits
const bad = validate(c);
ok(bad.length === 0, "content shape is valid" + (bad.length ? ": " + bad.join("; ") : ""));
if (bad.length) process.exit(1);
const L = lint(c);
for (const e of L.errors) ok(false, "content lint: " + e);
ok(L.errors.length === 0, `content lint: 0 limit errors (${L.warnings.length} warnings)`);
for (const w of L.warnings) info("lint warning: " + w);
for (const s of L.stats) info(`${s.id}: context ${s.contextWords} words, options ${s.choiceWords} words, bold ${s.boldPercent}%`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });
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
ok((await p.locator(".sbtn .no").count()) === N, "the stepper has N .no elements in total");
ok((await p.locator('.sbtn[aria-current="step"]').getAttribute("data-go")) === "0", "Overview is the active step");

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
  const step = p.locator(`.sbtn[data-go="${i + 1}"]`);
  ok((await step.getAttribute("aria-current")) === "step" && await step.locator(".no").isVisible()
    && (await step.locator(".no").innerText()) === String(i + 1), `${id}: its stepper button has aria-current=\"step\" and its expected question number`);
  ok((await s.locator("h1").innerText()).trim() === stripMarkup(q.title), `${id}: shows the question as the title`);
  const ask = s.locator(".ask");
  ok((await ask.isVisible()) && (await ask.innerText()).startsWith("Decide:"), `${id}: shows the ask, "Decide: ..."`);
  const decides = s.locator(".why + .decides");
  const owner = s.locator(".owner");
  ok((await decides.isVisible()) && sameText(await decides.innerText(), `Only this depends on you: ${q.decides}`), `${id}: shows what the reader decides right after Why`);
  ok((await owner.isVisible()) && sameText(await owner.innerText(), `Why you decide: ${q.owner}`), `${id}: shows why the reader decides`);
  const settled = s.locator(".settled");
  if (q.settled.length) {
    const items = await settled.locator("li").allInnerTexts();
    ok((await settled.isVisible()) && sameText(await settled.locator("p").innerText(), "Already decided (no answer needed):")
      && items.length === q.settled.length && items.every((item, k) => sameText(item, q.settled[k])), `${id}: shows what is already decided`);
  } else ok((await settled.count()) === 0, `${id}: omits the empty settled list`);
  if (q.removed?.length) {
    const details = s.locator(".ctx details");
    ok((await details.count()) === 1 && (await details.getAttribute("open")) === null, `${id}: question Details starts closed`);
    const items = await details.locator("ul > li").allTextContents();
    ok(q.removed.every((item) => items.some((text) => sameText(text, `Option removed: ${item}`))), `${id}: Details lists each removed option`);
  }
  const facts = s.locator(".ctx .sec > .facts");
  ok((await facts.locator("li").count()) === q.facts.length && (await facts.isVisible()), `${id}: shows ${q.facts.length} key facts`);
  ok((await s.locator(".example .steps-ex li").count()) === q.example.steps.length && (await s.locator(".example").isVisible()), `${id}: shows the example as ${q.example.steps.length} steps`);
  ok((await s.locator('[data-pick]').count()) === 1 && (await s.locator("[data-pick]").getAttribute("data-key")) === q.pick.key, `${id}: exactly one option marked as my pick (${q.pick.key})`);
  ok((await s.locator(".pick").getAttribute("data-pick-line")) === q.pick.key && /Confidence:/.test(await s.locator(".pick").innerText()) && /Pick another if:/.test(await s.locator(".pick").innerText()), `${id}: pick line names letter, confidence and "Pick another if"`);
  const g = await geo();
  const choiceBottom = await s.locator(".choice").evaluate((el) => el.getBoundingClientRect().bottom);
  const opts = s.locator(".opt");
  const n = await opts.count();
  const showVotes = q.options.some((o) => o.votes?.length);
  ok(n === q.options.length, `${id}: ${n} options`);
  let allIn = true, allFields = true, allDoes = n === q.options.length, votesMatch = n === q.options.length, bottom = 0;
  let cardsMatch = n === q.options.length;
  for (let k = 0; k < n; k++) {
    const o = opts.nth(k);
    const option = q.options[k];
    const b = await o.boundingBox();
    bottom = Math.max(bottom, b.y + b.height);
    if (b.y < g.headerBottom || b.y + b.height > Math.min(g.footerTop, choiceBottom)) allIn = false;
    for (const f of [".gets", ".costs", ".risk", ".tag[class*=risk-]"]) {
      const el = o.locator(f);
      if (!(await el.isVisible()) || !(await el.innerText()).trim()) allFields = false;
    }
    const does = o.locator(".tr > dt:first-child + dd.does");
    if (allDoes && (!(await does.isVisible()) || !sameText(await o.locator(".tr > dt:first-child").innerText(), "Does")
      || !sameText(await does.innerText(), q.options[k].does))) allDoes = false;
    const votes = option.votes || [], row = o.locator(".votes");
    const labels = showVotes ? voteText(votes) : [];
    if (showVotes) {
      const badges = row.locator(":scope > span");
      const texts = await badges.allInnerTexts();
      votesMatch &&= texts.length === labels.length && texts.every((text, j) => sameText(text, labels[j]));
      votesMatch &&= await row.count() === 1 && sameText(await row.innerText(), labels.join(" "));
    } else votesMatch &&= (await row.count()) === 0;
    const cardText = [`${option.key}. ${option.label}`];
    if (option.key === q.pick.key) cardText.push("My pick");
    cardText.push(`Risk: ${option.risk}`, String(k + 1), ...labels,
      "Does", option.does, "Gets", option.gets, "Costs", option.costs, "Risk", option.riskText);
    if (option.details) cardText.push(option.details.summary || `What ${option.key} contains`);
    cardsMatch &&= sameText(await o.innerText(), cardText.join(" "));
    const details = o.locator("details");
    if (q.options[k].details) {
      ok(await details.isVisible() && await details.getAttribute("open") === null, `${id}: option ${q.options[k].key} Details starts closed`);
    }
  }
  maxBottom = Math.max(maxBottom, bottom);
  ok(allFields, `${id}: every option shows Gets, Costs, Risk text and a "Risk: level" chip`);
  ok(allDoes, `${id}: every option shows its Does row first`);
  ok(votesMatch, `${id}: ${showVotes ? "vote rows show the expected names or No votes" : "no vote rows when there are no votes"}`);
  if (showVotes) ok(await voteTintsMatch(s, q), `${id}: each expected voter badge has the computed colours of its role tint variables in the light theme`);
  ok(cardsMatch, `${id}: option card innerText matches the expected text`);
  ok(allIn && g.mainScroll === 0, `${id}: at 1440x900 main.scrollTop is 0, each option card top is at or below the header bottom, and each card bottom is at or above the footer top and the pane bottom (lowest card bottom ${Math.round(bottom)} px, footer top ${Math.round(g.footerTop)} px)`);
  const measure = await s.evaluate((el) => {
    const probe = document.createElement("span"); probe.textContent = "0000000000"; probe.style.cssText = "position:absolute;visibility:hidden;font:16px/1.5 var(--font)";
    el.appendChild(probe); const ch = probe.getBoundingClientRect().width / 10; probe.remove();
    return Math.max(...[...el.querySelectorAll(".ctx .decision > p, .ctx .facts")].map((x) => x.getBoundingClientRect().width / ch));
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
  ok(await step.locator(".ck").isVisible() && !(await step.locator(".no").isVisible()), `${id}: answered step replaces its number with a check`);
  ok((await s.locator(".yours").innerText()) === ("You chose " + choice + (choice === q.pick.key ? ", same" : "")), `${id}: the step's answer badge text matches the expected \"You chose\" label`);
  if (i === 0 || i === 2) { const t = `note for ${id}: test`; await s.locator("textarea").fill(t); notes[id] = t; }
}
info(`lowest option card bottom over all questions: ${Math.round(maxBottom)} px of 900`);
ok((await p.locator("#cA").innerText()) === String(N) && (await p.locator("#cR").innerText()) === "0", "header counts update to all answered");

// 5. Saved state survives a reload (R5.6)
await p.reload();
ok(await p.locator(`section.step[data-step="${N}"]`).isVisible(), "reload returns to the same step");
ok((await p.locator("input[type=radio]:checked").count()) === N, "reload keeps all answers");
ok((await p.locator(".sbtn.done").count()) === N && (await p.locator(`.step[data-step="${N}"] .yours`).isVisible()), "reload restores N .done stepper buttons in total and a visible answer badge on the last question");
ok((await p.locator("#n-Q1").inputValue()) === notes.Q1, "reload keeps the notes");

// 6. Check answers step
await p.click("#next");
const fin = p.locator(`section.step[data-step="${N + 1}"]`);
ok(await fin.isVisible(), "last step is Check your answers");
ok((await fin.locator("tbody tr").count()) === N, `check step lists ${N} rows`);
const clarity = fin.getByRole("group", { name: "Did this page tell you what each question is about?" });
const yes = clarity.getByRole("radio", { name: "Yes", exact: true });
const no = clarity.getByRole("radio", { name: "No", exact: true });
const missing = fin.getByRole("textbox", { name: "What was missing? (optional)" });
ok(await yes.isVisible() && await no.isVisible() && await missing.isVisible(), "finish shows Yes and No radios and the optional missing text box");
ok(!(await yes.isChecked()) && !(await no.isChecked()) && (await missing.inputValue()) === "", "feedback starts blank");
ok((await fin.locator("#copytext").textContent()).endsWith("\nPage clear: (no answer)"), "copy preview shows Page clear: (no answer) before feedback");
let rowsOk = true;
for (let i = 0; i < N; i++) {
  const q = c.questions[i], row = fin.locator(`tr[data-q="Q${i + 1}"]`), o = q.options.find((x) => x.key === answers[`Q${i + 1}`]);
  if (!sameText(await row.locator("td").nth(1).innerText(), q.title)
    || !sameText(await row.locator(".ans").innerText(), `${o.key}. ${o.label}`)) rowsOk = false;
}
ok(rowsOk, "each row shows the question title and the chosen option");
ok((await fin.locator('tr[data-q="Q1"]').innerText()).includes(notes.Q1), "the row shows the note");
await yes.check();
ok((await fin.locator("#copytext").textContent()).endsWith("\nPage clear: yes"), "Yes updates the copy preview");
await yes.press("ArrowRight");
ok(await fin.isVisible() && await no.isChecked(), "the arrow key changes the feedback radio on the finish step");
const feedback = { clear: "no", missing: "The difference between two options.\nAn example would help." };
await missing.fill(feedback.missing);
const expect = copyLines(c, answers, notes, feedback);
ok((await fin.locator("#copytext").textContent()) === expect, "the copy preview updates as the reader enters the missing text");
await p.reload();
ok(await fin.isVisible() && await no.isChecked() && (await missing.inputValue()) === feedback.missing, "reload restores the feedback radio and text on the finish step");
ok((await p.locator("#cA").innerText()) === String(N), "feedback leaves the answer count unchanged");
// The Change link of row Q2 opens step 2; a page with one question has only row Q1.
const back = N >= 2 ? 2 : 1;
await fin.locator(`tr[data-q="Q${back}"] button[data-go]`).click();
ok(await p.locator(`section.step[data-step="${back}"]`).isVisible(), "Change link opens its question");
await p.click('.sbtn[data-go="' + (N + 1) + '"]');
await p.click("#copy");
await p.waitForFunction(() => document.querySelector("#copy-status").textContent !== "");
const clip = await p.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR " + e));
ok(clip === expect, "copied text matches the expected format");
const preview = await fin.locator("#copytext").textContent();
for (let i = 0; i < N; i++) {
  const q = c.questions[i], id = `Q${i + 1}`;
  if (!q.options.some((o) => o.votes?.length)) continue;
  const o = q.options.find(({ key }) => key === answers[id]);
  const labels = voteText(o.votes).map((label) => stripMarkup(label));
  const block = [`${id}: ${o.key} ${stripMarkup(o.label)}`, ...labels.map((label) => `  ${label}`)].join("\n");
  ok(preview.includes(`\n${block}\n`), `${id}: copy preview lists ${labels.join(", ")}`);
  ok(clip.includes(`\n${block}\n`), `${id}: clipboard text lists ${labels.join(", ")}`);
}
ok(clip.endsWith("\nPage clear: no\n  Missing: The difference between two options. An example would help."), "copied text ends with the Page clear and Missing lines");
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
    const s = document.querySelector(`section.step[data-step="${k}"]`);
    const f = Math.min(document.querySelector(".nav").getBoundingClientRect().top, s.querySelector(".choice").getBoundingClientRect().bottom);
    return { bottom: Math.max(...[...s.querySelectorAll(".opt")].map((e) => e.getBoundingClientRect().bottom)), f };
  }, i + 1);
  if (r.bottom > r.f) { in1280 = false; info(`Q${i + 1}: at 1280x800 the lowest option card ends at ${Math.round(r.bottom)} px, ${Math.round(r.bottom - r.f)} px below the visible pane (${Math.round(r.f)} px)`); }
}
ok(in1280, "at 1280x800 the lowest option card bottom is at or above the footer top and the pane bottom");

// 8. Clear answers, dark mode look
await p.setViewportSize({ width: 1440, height: 900 });
await p.evaluate((k) => window.decisionPage.go(k, false), N + 1);
await p.click("#clear");
ok((await p.locator("input[type=radio]:checked").count()) === 0 && (await p.locator("#cA").innerText()) === "0", "Clear my answers removes all answers");
ok((await missing.inputValue()) === "" && (await fin.locator("#copytext").textContent()).endsWith("\nPage clear: (no answer)"), "Clear my answers removes feedback and updates the copy preview");
ok((await p.locator(".sbtn.done").count()) === 0 && (await p.locator(".yours:not(:empty)").count()) === 0, "after Clear my answers, no .sbtn.done and no non-empty .yours remains");
await p.evaluate(() => window.decisionPage.go(1, false));
const q1 = c.questions[0], different = q1.options.findIndex((o) => o.key !== q1.pick.key);
await p.keyboard.press(String(different + 1));
ok((await p.locator('.step[data-step="1"] .yours').innerText()) === "You chose " + q1.options[different].key, "answer badge omits same for a different pick");
await p.emulateMedia({ colorScheme: "dark" });
await p.evaluate(() => window.decisionPage.go(1, false));
await p.screenshot({ path: path.join(outDir, `${name}-q1-dark.png`) });
for (const [i, q] of c.questions.entries()) {
  if (!q.options.some((o) => o.votes?.length)) continue;
  await p.evaluate((k) => window.decisionPage.go(k, false), i + 1);
  const s = p.locator(`section.step[data-step="${i + 1}"]`);
  ok(await voteTintsMatch(s, q), `Q${i + 1}: each expected voter badge has the computed colours of its role tint variables in the dark theme`);
}
await p.emulateMedia({ colorScheme: "light" });

// 9. Swipe: dispatch the wheel events together so no browser scheduling gap splits a gesture.
const swipe = async (start, deltas) => p.evaluate(({ start, deltas }) => {
  if (start !== null) window.decisionPage.go(start, false);
  const main = document.querySelector("main");
  return deltas.map(([deltaX, deltaY = 0]) => {
    main.dispatchEvent(new WheelEvent("wheel", { deltaX, deltaY, bubbles: true }));
    const live = document.querySelector(".edge.live");
    const wrap = main.querySelector(".step:not([hidden]) > .wrap");
    return { step: window.decisionPage.state().step, edge: live?.id,
      progress: live?.style.getPropertyValue("--p"), slide: getComputedStyle(wrap).animationName,
      drag: wrap.style.transform, overscroll: getComputedStyle(document.documentElement).overscrollBehaviorX };
  });
}, { start, deltas });
await p.emulateMedia({ reducedMotion: "no-preference" });
const animations = await p.evaluate(() => {
  // Q1 is already answered. Clear it first so a new pick changes both the count and the check.
  window.decisionPage.go(document.querySelectorAll("section.step").length - 1, false);
  document.getElementById("clear").click();
  window.decisionPage.go(1, false);
  const radio = document.querySelector('.step[data-step="1"] .opt input');
  radio.click();
  return ["#cA", ".sbtn.done .ck path", ".opt.just-picked", ".pick.pop", ".yours.pop"].map((selector) => {
    const el = document.querySelector(selector);
    return el ? getComputedStyle(el).animationName : "";
  });
});
ok(animations.join(",") === "tick,just-done,pop-option,pop-box,pop-in", "after a new answer, the five sampled elements have the computed animation names tick, just-done, pop-option, pop-box and pop-in");
const movesLeft = await p.evaluate(async () => {
  window.decisionPage.go(0, false);
  const main = document.querySelector("main");
  const wrap = main.querySelector(".step:not([hidden]) > .wrap");
  await Promise.all(wrap.getAnimations().map((anim) => anim.finished));
  const before = wrap.getBoundingClientRect().left;
  main.dispatchEvent(new WheelEvent("wheel", { deltaX: 25, bubbles: true }));
  wrap.getBoundingClientRect();
  await Promise.all(wrap.getAnimations().map((anim) => anim.finished));
  return wrap.getBoundingClientRect().left < before;
});
ok(movesLeft, "a partial forward swipe moves the page left");
await p.waitForTimeout(200);
const [partial, forward, ...tail] = await swipe(0, [[25, 3], [25, 3], [6], [13], [12], [11], [10], [9]]);
ok(partial.step === 0 && partial.edge === "edge-r" && Number(partial.progress) === .5, "short horizontal swipe: the .edge.live element has the id edge-r and --p 0.5, and the step stays");
ok(forward.step === 1 && forward.slide === "in-next" && forward.overscroll === "none" && tail.every(({ step }) => step === 1), "forward swipe advances one step with animation name in-next and no horizontal overscroll or extra momentum steps");
await p.waitForTimeout(200);
const [second] = await swipe(null, [[60]]);
ok(second.step === 2, "a new swipe after 200 ms advances one more step");
await p.waitForFunction(() => !document.querySelector(".edge.live, .wrap.drag"));
await p.waitForTimeout(180);
const [reverse] = await swipe(1, [[-60]]);
ok(reverse.step === 0 && reverse.edge === "edge-l" && reverse.slide === "in-prev", "reverse swipe returns to Overview with animation name in-prev, and the .edge.live element has the id edge-l");
await p.waitForTimeout(180);
ok((await swipe(0, [[-60]]))[0].step === 0, "swipe cannot go back from Overview");
await p.waitForTimeout(180);
ok((await swipe(N + 1, [[60]]))[0].step === N + 1, "swipe cannot go forward from Check answers");
await p.waitForTimeout(180);
ok((await swipe(0, [[55, 80]]))[0].step === 0, "vertical scroll leaves the step unchanged");
await p.waitForTimeout(180);
await p.emulateMedia({ reducedMotion: "reduce" });
const [quietPartial, quiet] = await swipe(0, [[25], [25]]);
ok(quiet.step === 1 && quiet.slide === "none" && !quiet.edge && !quietPartial.edge && quietPartial.drag === "", "reduced motion: the partial sample has an empty inline transform; the committed sample is on step 1 with animation name none; neither sample returns a .edge.live id");
const q1Radio = p.locator('.step[data-step="1"] .opt input').first();
await q1Radio.focus();
await p.keyboard.press("ArrowLeft");
ok(await ov.locator("h1").evaluate((el) => document.activeElement === el), "arrow navigation focuses the incoming heading when it hides the focused radio");
const stepper = p.locator('.sbtn[data-go="0"]');
await stepper.focus();
await p.keyboard.press("ArrowRight");
ok(await stepper.evaluate((el) => document.activeElement === el), "arrow navigation keeps focus on the visible stepper button");
await q1Radio.focus();
await p.waitForTimeout(200);
await swipe(1, [[-60]]);
ok(await ov.locator("h1").evaluate((el) => document.activeElement === el), "swipe focuses the incoming heading when it hides the focused radio");
await p.evaluate(() => window.decisionPage.go(1, false));
const backButton = p.locator("#back");
await backButton.focus();
await p.keyboard.press("ArrowLeft");
ok(await backButton.isDisabled() && await ov.locator("h1").evaluate((el) => document.activeElement === el), "arrow navigation focuses the Overview heading when Back becomes disabled");

await p.emulateMedia({ reducedMotion: "no-preference" });
const guarded = await p.evaluate(() => {
  const originalNow = performance.now;
  let now = originalNow.call(performance) + 200;
  performance.now = () => now;
  try {
    const main = document.querySelector("main");
    const wrap = main.querySelector(".step:not([hidden]) > .wrap");
    const wheel = (deltaX, ctrlKey = false) => main.dispatchEvent(new WheelEvent("wheel", { deltaX, ctrlKey, bubbles: true }));
    const step = () => window.decisionPage.state().step;
    wheel(35);
    const dragged = wrap.classList.contains("drag") && wrap.style.transform !== "";
    now += 100;
    wheel(0, true);
    const cleared = dragged && !wrap.classList.contains("drag") && wrap.style.transform === "";
    now += 100;
    wheel(0, true);
    now += 60;
    wheel(15);
    const partialStep = step();

    window.decisionPage.go(0, false);
    now += 200;
    wheel(50);
    const committedStep = step();
    now += 100;
    wheel(0, true);
    now += 100;
    wheel(0, true);
    now += 60;
    wheel(50);
    return { cleared, partialStep, committedStep, finalStep: step() };
  } finally {
    performance.now = originalNow;
  }
});
ok(guarded.cleared, "Ctrl-wheel clears the partial drag at 100 ms");
ok(guarded.partialStep === 0, "35 px and 15 px stay below the swipe threshold across Ctrl-wheel at 100 and 200 ms");
ok(guarded.committedStep === 1 && guarded.finalStep === 1, "the step is 1 right after the committed swipe and again after the last sampled wheel event");

const sampleSwipes = (cases) => p.evaluate((cases) => {
  const originalNow = performance.now;
  let now = originalNow.call(performance);
  const main = document.querySelector("main");
  const shift = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--shift"));
  performance.now = () => now;
  try {
    return cases.map(([start, deltas]) => {
      now += 200;
      window.decisionPage.go(start, false);
      for (const delta of deltas) {
        const init = typeof delta === "number" ? { deltaX: delta } : delta;
        main.dispatchEvent(new WheelEvent("wheel", { ...init, bubbles: true }));
        now += 16;
      }
      const wrap = main.querySelector(".step:not([hidden]) > .wrap");
      return { step: window.decisionPage.state().step, drag: wrap.style.transform,
        edge: document.querySelector(".edge.live")?.id, shift };
    });
  } finally {
    performance.now = originalNow;
  }
}, cases);
await p.reload();
const [slowdown, renewed, cancelled, endPull] = await sampleSwipes([
  [0, [20, 20, 20, 6, 13, 12, 11, 10, 9]],
  [0, [10, 20, 30, 25, 12, 8, 6, 4, 3, 9, 20, 30, 25]],
  [0, [50, 3, 9, { ctrlKey: true }, 42]],
  [N + 1, [25]],
]);
ok(slowdown.step === 1, "the uneven slow-down sample ends on step 1");
ok(renewed.step === 2, "the second swipe sample ends on step 2");
ok(cancelled.step === 1, "the Ctrl-wheel sample ends on step 1");
const endOffset = Number(endPull.drag.match(/^translateX\((-?[\d.]+)px\)$/)?.[1]);
ok(Math.abs(endOffset + endPull.shift / 6) <= 0.1 && !endPull.edge,
  "the last-step pull has an inline translateX within 0.1 px of -shift/6 and no .edge.live id");
await p.emulateMedia({ reducedMotion: "reduce" });
await p.reload();
const [quietEndPull] = await sampleSwipes([[N + 1, [25]]]);
ok(quietEndPull.drag === "", "the reduced-motion last-step pull has an empty inline transform");
await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

ok(errs.length === 0, "no console errors" + (errs.length ? ": " + JSON.stringify(errs) : ""));
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
console.log(`screenshots: ${["overview", "q1", "finish", "q1-dark"].map((s) => path.join(outDir, `${name}-${s}.png`)).join(", ")}`);
process.exit(fail ? 1 : 0);
