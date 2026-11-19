// Decision page kit: content lint and page builder. ES module, no dependencies.
// Input: a content object (see content-format.md). Output: one self-contained HTML page.
// Rule ids in comments (R1.2, R3.4, ...) point to sections of references/research.md.

// ---------- Text helpers ----------

export const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Safe inline markup: escape all text first, then allow only `code` and **bold**.
export function inline(s) {
  const parts = String(s ?? "").split("`");
  if (parts.length % 2 === 0) return boldOnly(esc(s)); // unbalanced backtick: no code spans
  return parts.map((p, i) => (i % 2 ? `<code${p.length <= 48 ? ' class="nw"' : ""}>${esc(p)}</code>` : boldOnly(esc(p)))).join("");
}
function boldOnly(h) {
  return h.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
}

// Plain text for counting: a code span counts as one word.
export function plain(s) {
  return String(s ?? "").replace(/`[^`]*`/g, "CODE").replace(/\*\*/g, "");
}
export const stripMarkup = (s) => String(s ?? "").replace(/\*\*/g, "").replace(/`/g, "");
export function countWords(s) {
  return plain(s).split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}
// A semicolon list counts as one sentence (R2.7).
export function sentences(s) {
  return plain(s)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(#§\/])/)
    .map((x) => x.trim())
    .filter(Boolean);
}
export function boldWords(s) {
  const m = String(s ?? "").match(/\*\*([^*]+?)\*\*/g) || [];
  return m.reduce((n, b) => n + countWords(b), 0);
}

// ---------- Limits (each traces to references/research.md) ----------

export const LIMITS = {
  titleWords: [12, "R5.2 the heading is the question, at most 12 words, ends with ?"],
  topicWords: [3, "R5.4 step buttons name the topic in 1-3 words"],
  topicChars: [16, "R5.4 short step names keep the step bar on one or two rows"],
  askWords: [20, "R2.4 BLUF: the ask is the first line, at most 20 words"],
  whyWords: [25, "R5.2 hint text is one short sentence"],
  pickReasonWords: [25, "R7b the pick line is at most 25 words"],
  pickAnotherWords: [15, "R3.7 'Pick another if' is at most 15 words"],
  factsMin: [2, "R2.1 2-4 bullets"],
  factsMax: [4, "R2.1 working memory holds about 4 chunks"],
  factWords: [15, "R7b each fact bullet is at most 15 words"],
  leadBoldMin: [2, "R1.5 the first 2 words carry the fact"],
  leadBoldMax: [4, "R4.3 bold only the 2-4 lead words"],
  tableRowsMin: [2, "R7b a numbers table has 2-5 rows"],
  tableRowsMax: [5, "R3.2 comparison tables: about 5 items or fewer"],
  stepsMin: [2, "R7b the example has 2-4 steps"],
  stepsMax: [4, "R7b the example has 2-4 steps"],
  stepWords: [15, "R7b each example step is at most 15 words"],
  whenWords: [3, "R7b the step label is a time or trigger"],
  optionsMin: [2, "R3.3 2-4 options"],
  optionsMax: [4, "R3.3 2-4 options; R2.1 4 chunks"],
  labelWords: [8, "R3.3 an option label is at most 8 words"],
  fieldWords: [12, "R7b Gets, Costs and Risk are at most 12 words each"],
  contextWords: [220, "R1.2 people read about 20% of a page: at most 220 visible words of context"],
  choiceWords: [160, "R1.2 at most 160 visible words in the options"],
  sentenceWords: [20, "R2.7 visible sentences at most 20 words"],
  detailSentenceWords: [25, "R2.7 / STE descriptive sentences at most 25 words (inside Details)"],
  paragraphWords: [50, "R1.3 / W3C COGA: split any paragraph or bullet over 50 words"],
  boldPercent: [10, "R4.3 bold text is at most 10% of the visible words"],
  leadWords: [30, "R2.4 the page lead is short: at most 30 words"],
  blockTitleWords: [8, "R1.4 block labels say their content, briefly"],
};
const L = (k) => LIMITS[k][0];

const RISKS = ["low", "medium", "high"];
const CONFIDENCE = ["clear", "close call"];
const STRAWMAN = /^(no work|nothing|none|no change)\.?$/i;

// ---------- Validation (shape) ----------

export function validate(c) {
  const e = [];
  const need = (cond, msg) => { if (!cond) e.push(msg); };
  need(c && typeof c === "object", "content must be an object");
  if (e.length) return e;
  need(c.page && c.page.title && c.page.storageKey, "page.title and page.storageKey are required");
  need(c.overview && c.overview.heading, "overview.heading is required");
  need(Array.isArray(c.questions), "questions must be an array (empty for a report page)");
  (c.overview?.blocks || []).forEach((b, i) => {
    need(["text", "list", "table", "bars"].includes(b.type), `overview.blocks[${i}].type must be text, list, table or bars`);
    need(b.title, `overview.blocks[${i}].title is required`);
    need(!b.place || ["left", "right", "full"].includes(b.place), `overview.blocks[${i}].place must be left, right or full`);
    if (b.type === "table") need(Array.isArray(b.columns) && Array.isArray(b.rows), `overview.blocks[${i}] table needs columns and rows`);
    if (b.type === "bars") need(Array.isArray(b.groups) && b.max > 0, `overview.blocks[${i}] bars needs groups and max`);
  });
  (c.questions || []).forEach((q, i) => {
    const id = `questions[${i}]`;
    for (const f of ["topic", "title", "ask", "why", "facts", "example", "options", "pick"]) need(q[f], `${id}.${f} is required`);
    if (q.example) need(Array.isArray(q.example.steps) && q.example.title, `${id}.example needs title and steps`);
    if (Array.isArray(q.options)) {
      const keys = q.options.map((o) => o.key);
      need(new Set(keys).size === keys.length, `${id} option keys must be unique`);
      q.options.forEach((o, k) => {
        for (const f of ["key", "label", "gets", "costs", "risk", "riskText"]) need(o[f], `${id}.options[${k}].${f} is required (R3.2 same fields for every option)`);
        need(/^[A-Z]$/.test(o.key || ""), `${id}.options[${k}].key must be one capital letter`);
      });
      if (q.pick) need(keys.includes(q.pick.key), `${id}.pick.key must name an option`);
    }
    if (q.pick) for (const f of ["key", "reason", "confidence", "another"]) need(q.pick[f], `${id}.pick.${f} is required (R3.5, R3.7)`);
    if (q.table) need(Array.isArray(q.table.columns) && Array.isArray(q.table.rows) && q.table.title, `${id}.table needs title, columns and rows`);
  });
  return e;
}

// ---------- Lint (limits) ----------

export function lint(c) {
  const errors = [], warnings = [], stats = [];
  const max = (where, text, key) => {
    const n = countWords(text);
    if (n > L(key)) errors.push(`${where}: ${n} words > ${L(key)} (${LIMITS[key][1]})`);
    return n;
  };
  const sent = (where, text, key = "sentenceWords") => {
    for (const s of sentences(text)) {
      const n = countWords(s);
      if (n > L(key)) errors.push(`${where}: sentence of ${n} words > ${L(key)} (${LIMITS[key][1]}): "${s.slice(0, 70)}..."`);
    }
    const n = countWords(text);
    if (n > L("paragraphWords")) errors.push(`${where}: ${n} words in one paragraph > ${L("paragraphWords")} (${LIMITS.paragraphWords[1]})`);
  };
  const markup = (where, text) => {
    const t = String(text ?? "");
    if ((t.split("`").length - 1) % 2) warnings.push(`${where}: unbalanced backtick; shown as plain text`);
    if ((t.split("**").length - 1) % 2) warnings.push(`${where}: unbalanced ** marker`);
  };
  const range = (where, n, lo, hi) => {
    if (n < L(lo) || n > L(hi)) errors.push(`${where}: ${n} items, need ${L(lo)}-${L(hi)} (${LIMITS[hi][1]})`);
  };
  const detailItems = (where, items) => (items || []).forEach((it, k) => {
    if (Array.isArray(it)) detailItems(`${where}[${k}]`, it);
    else { markup(`${where}[${k}]`, it); sent(`${where}[${k}]`, it, "detailSentenceWords"); }
  });

  // Overview
  const ov = c.overview || {};
  if (ov.lead) { max("overview.lead", ov.lead, "leadWords"); sent("overview.lead", ov.lead); }
  (ov.blocks || []).forEach((b, i) => {
    const w = `overview.blocks[${i}] "${b.title}"`;
    max(`${w} title`, b.title, "blockTitleWords");
    for (const p of b.paragraphs || []) { markup(w, p); sent(w, p); }
    for (const it of b.items || []) { markup(w, it); sent(w, it); }
    if (b.note) sent(`${w} note`, b.note);
    if (b.type === "table") b.rows.forEach((r, k) => { if (r.length !== b.columns.length) errors.push(`${w}: row ${k + 1} has ${r.length} cells, need ${b.columns.length}`); });
  });

  // Questions
  (c.questions || []).forEach((q, i) => {
    const id = `Q${i + 1}`;
    let ctx = 0, bold = 0;
    const count = (where, text, key) => { markup(where, text); ctx += key ? max(where, text, key) : countWords(text); bold += boldWords(text); };

    count(`${id}.title`, q.title, "titleWords");
    if (!/\?\s*$/.test(q.title || "")) errors.push(`${id}.title: must end with "?" (${LIMITS.titleWords[1]})`);
    if (countWords(q.topic) > L("topicWords")) errors.push(`${id}.topic: ${countWords(q.topic)} words > ${L("topicWords")} (${LIMITS.topicWords[1]})`);
    if (String(q.topic || "").length > L("topicChars")) errors.push(`${id}.topic: ${String(q.topic).length} characters > ${L("topicChars")} (${LIMITS.topicChars[1]})`);
    count(`${id}.ask`, q.ask, "askWords"); ctx += 1; // the "Decide:" label
    sent(`${id}.ask`, q.ask);
    count(`${id}.why`, q.why, "whyWords");
    if (sentences(q.why).length > 1) errors.push(`${id}.why: ${sentences(q.why).length} sentences, need 1 (${LIMITS.whyWords[1]})`);

    // Pick
    const p = q.pick || {};
    const pickOpt = (q.options || []).find((o) => o.key === p.key);
    ctx += 3 + countWords(pickOpt ? pickOpt.label : ""); // "My pick: A." + label
    count(`${id}.pick.reason`, p.reason, "pickReasonWords"); sent(`${id}.pick.reason`, p.reason);
    count(`${id}.pick.another`, p.another, "pickAnotherWords"); ctx += 3; // "Pick another if:"
    if (!CONFIDENCE.includes(p.confidence)) errors.push(`${id}.pick.confidence: "${p.confidence}" must be one of ${CONFIDENCE.join(", ")} (R3.5)`);
    ctx += 1 + countWords(p.confidence || "");

    // Facts
    const facts = q.facts || [];
    range(`${id}.facts`, facts.length, "factsMin", "factsMax");
    facts.forEach((f, k) => {
      count(`${id}.facts[${k}]`, f, "factWords"); sent(`${id}.facts[${k}]`, f);
      const m = String(f).match(/^\*\*([^*]+?)\*\*/);
      const n = m ? countWords(m[1]) : 0;
      if (!m) errors.push(`${id}.facts[${k}]: must start with bold lead words (${LIMITS.leadBoldMax[1]})`);
      else if (n < L("leadBoldMin") || n > L("leadBoldMax")) errors.push(`${id}.facts[${k}]: bold lead has ${n} words, need ${L("leadBoldMin")}-${L("leadBoldMax")} (${LIMITS.leadBoldMax[1]})`);
    });
    // Data numbers only: 2+ digits, not an id ("#42", "order 12", "round 3", "REQ-578").
    const nums = facts.join(" ").replace(/`[^`]*`/g, "").match(/(?<![\w#§-])(?<!(?:order|round|rule|judge|Q) )\d{2,}(?:\.\d+)?(?![\w-])/gi) || [];
    if (nums.length > 3 && !q.table) warnings.push(`${id}: facts hold ${nums.length} numbers and there is no table (R1.6 put more than 3 numbers in a table)`);

    // Table
    if (q.table) {
      const t = q.table;
      count(`${id}.table.title`, t.title, "blockTitleWords");
      range(`${id}.table rows`, t.rows.length, "tableRowsMin", "tableRowsMax");
      for (const h of t.columns) count(`${id}.table`, h);
      t.rows.forEach((r, k) => {
        if (r.length !== t.columns.length) errors.push(`${id}.table: row ${k + 1} has ${r.length} cells, need ${t.columns.length}`);
        for (const cell of r) count(`${id}.table`, String(cell));
      });
    }

    // Example
    const ex = q.example || { steps: [] };
    count(`${id}.example.title`, ex.title, "blockTitleWords"); ctx += 1; // "Example:"
    range(`${id}.example steps`, ex.steps.length, "stepsMin", "stepsMax");
    ex.steps.forEach((s, k) => {
      count(`${id}.example.steps[${k}].when`, s.when, "whenWords");
      count(`${id}.example.steps[${k}].text`, s.text, "stepWords"); sent(`${id}.example.steps[${k}]`, s.text);
    });

    // Details label (visible); details body is collapsed and not counted
    if (q.details) { count(`${id}.details.summary`, q.details.summary, "blockTitleWords"); detailItems(`${id}.details`, q.details.items); }

    // Options
    const opts = q.options || [];
    range(`${id}.options`, opts.length, "optionsMin", "optionsMax");
    let choice = 0;
    opts.forEach((o) => {
      const w = `${id}.option ${o.key}`;
      for (const [f, key] of [["label", "labelWords"], ["gets", "fieldWords"], ["costs", "fieldWords"], ["riskText", "fieldWords"]]) {
        markup(`${w}.${f}`, o[f]); choice += max(`${w}.${f}`, o[f], key); sent(`${w}.${f}`, o[f]);
      }
      choice += 2; // "Risk: low" chip
      if (!RISKS.includes(o.risk)) errors.push(`${w}.risk: "${o.risk}" must be one of ${RISKS.join(", ")} (R4.5 the chip says the level in words)`);
      if (STRAWMAN.test(String(o.gets).trim())) warnings.push(`${w}.gets: "${o.gets}" is no real gain; remove the option or name its case (R3.6 decoys)`);
      if (o.details) detailItems(`${w}.details`, o.details.items);
    });

    if (ctx > L("contextWords")) errors.push(`${id}: ${ctx} visible context words > ${L("contextWords")} (${LIMITS.contextWords[1]})`);
    if (choice > L("choiceWords")) errors.push(`${id}: ${choice} visible option words > ${L("choiceWords")} (${LIMITS.choiceWords[1]})`);
    const pct = ctx ? Math.round((1000 * bold) / ctx) / 10 : 0;
    if (pct > L("boldPercent")) errors.push(`${id}: bold is ${pct}% of visible context words > ${L("boldPercent")}% (${LIMITS.boldPercent[1]})`);
    stats.push({ id, contextWords: ctx, choiceWords: choice, boldPercent: pct });
  });
  return { errors, warnings, stats };
}

// ---------- Copy text (shared by page and verify) ----------

export function copyLines(c, answers, notes) {
  const n = c.questions.filter((q, i) => answers[`Q${i + 1}`]).length;
  const out = [`${c.page.title}${c.page.date ? ", " + c.page.date : ""}: my answers (${n} of ${c.questions.length})`];
  c.questions.forEach((q, i) => {
    const id = `Q${i + 1}`, a = answers[id];
    const o = q.options.find((x) => x.key === a);
    out.push(o ? `${id}: ${o.key} ${stripMarkup(o.label)}` : `${id}: (no answer)`);
    const nt = String(notes[id] || "").replace(/\s+/g, " ").trim();
    if (nt) out.push(`  Note: ${nt}`);
  });
  return out.join("\n");
}

// ---------- Styles ----------
// Tokens: one ground, one ink, one accent. The accent fill marks one thing per question: my pick (R4.1).
// Type: three sizes, 24 / 16 / 14 (R4.2). System font stack, no network.

const CSS = `
:root{
 --ground:#f5f6f7;--surface:#ffffff;--raised:#eef0f2;--border:#dfe2e6;--rule:#e9ebee;--control:#b9bec5;
 --text:#16181b;--muted:#545a63;--accent:#1b56c4;--accent-ink:#17489f;--pick-bg:#e6eefc;--bar:#878e98;
 --low-bg:#def3e5;--low-ink:#14532d;--med-bg:#fbefd5;--med-ink:#704404;--high-bg:#fbe1df;--high-ink:#8a1f1a;
 --code:#eceef1;
 --font:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
 --mono:ui-monospace,"SF Mono","Cascadia Mono",Consolas,"Liberation Mono",monospace;
 color-scheme:light dark;
}
@media (prefers-color-scheme:dark){:root{
 --ground:#0f1012;--surface:#17191c;--raised:#202327;--border:#2c3035;--rule:#25282c;--control:#4b5057;
 --text:#eceef0;--muted:#a8aeb7;--accent:#5b8ff0;--accent-ink:#a3c1ff;--pick-bg:#18284a;--bar:#7b828c;
 --low-bg:#12301d;--low-ink:#94e2ad;--med-bg:#3a2a0c;--med-ink:#f3c879;--high-bg:#3e1816;--high-ink:#ffaba4;
 --code:#24272c;
}}
*{box-sizing:border-box}
[hidden]{display:none!important}
html,body{height:100%}
body{margin:0;background:var(--ground);color:var(--text);font:16px/1.5 var(--font);display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;
 font-variant-numeric:tabular-nums;scrollbar-color:var(--control) transparent}
::selection{background:var(--pick-bg);color:var(--text)}
h1,h2,h3,p,ul,ol,dl,dd,figure{margin:0}
h1{font-size:24px;line-height:1.25;font-weight:650;text-wrap:balance}
h2{font-size:16px;line-height:1.4;font-weight:650}
code{font-family:var(--mono);font-size:14px;background:var(--code);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}
code.nw{white-space:nowrap;overflow-wrap:normal}
p,li{text-wrap:pretty}
strong{font-weight:650}
.muted{color:var(--muted)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button{font:inherit;color:inherit}

/* Top bar: where am I, how much is left (R5.3, R5.4) */
.bar{background:var(--surface);border-bottom:1px solid var(--border)}
.bar-in{max-width:1440px;margin:0 auto;padding:8px 32px 6px}
.bar-row{display:flex;align-items:baseline;gap:20px}
.bar-title{font-weight:650}
.bar-title .muted{font-weight:400;margin-left:6px}
.where{font-weight:400;color:var(--muted)}
.counts{margin-left:auto;display:flex;gap:18px;font-size:14px;color:var(--muted)}
.counts b{color:var(--text);font-size:16px;margin-left:4px}
.steps ol{list-style:none;padding:0;margin:6px 0 0 -8px;display:flex;flex-wrap:wrap;gap:2px}
.sbtn{font-size:14px;line-height:20px;padding:3px 8px;border-radius:6px;border:1px solid transparent;background:none;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.sbtn:hover{background:var(--raised);color:var(--text)}
.sbtn[aria-current="step"]{background:var(--raised);border-color:var(--control);color:var(--text);font-weight:650}
.sbtn .ck{display:none;width:14px;height:14px;margin:0 -2px}
.sbtn .no{min-width:9px;text-align:center}
.sbtn.done{color:var(--text)}
.sbtn.done .ck{display:inline-block}
.sbtn.done .no{display:none}

/* Main area scrolls; the choice column stays in view (R2.2 trade-offs next to the radio) */
main{overflow:auto;scroll-padding-top:16px}
.wrap{max-width:1680px;margin:0 auto;padding:16px 24px 32px}
/* Question step (owner, 2026-11-19): 12 columns, left 7 and right 5; the left scrolls by itself,
   the answers on the right stay in place. Text lines in the left keep at most 72ch (R2.6). */
.step.q{height:100%}
.step.q .wrap{height:100%;box-sizing:border-box;padding:16px 24px 0}
.q-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:32px;height:100%;align-items:stretch}
.ctx{min-height:0;overflow-y:auto;padding:0 16px 32px 0;scroll-padding-top:16px}
.ctx>:not(table):not(.tbl){max-width:72ch}
.ctx>*+*{margin-top:16px}
.ctx h1{outline:none}
.ask{font-size:16px}
.ask strong{font-weight:650}
.why{color:var(--muted)}
.facts{padding-left:20px}
.facts li+li{margin-top:6px}
.facts li::marker{color:var(--muted)}
.ctx .blk{margin-top:24px}
.ctx h2{margin-bottom:8px}

/* Tables: rules and alignment, numbers right (R3.1, R1.6) */
table{border-collapse:collapse;width:100%}
.ctx table{width:auto;min-width:60%}
.ctx td,.ctx th{padding-right:24px}
caption{text-align:left;font-weight:650;padding-bottom:6px}
th{font-size:14px;font-weight:500;color:var(--muted);text-align:left;padding:4px 12px 6px 0;border-bottom:1px solid var(--border)}
td{padding:6px 12px 6px 0;border-bottom:1px solid var(--rule);vertical-align:top}
th.num,td.num{text-align:right}
th:last-child,td:last-child{padding-right:0}

/* Example as ordered steps with a time label */
.steps-ex{list-style:none;padding:0;display:grid;grid-template-columns:max-content 1fr;gap:6px 16px}
.steps-ex li{display:contents}
.steps-ex .when{color:var(--muted);white-space:nowrap}

/* Details: one per question, label says what is inside (R2.5) */
details>summary{cursor:pointer;font-weight:650;width:max-content;max-width:100%}
details>summary:hover{text-decoration:underline;text-underline-offset:3px}
details[open]>summary{margin-bottom:8px}
.more ul{padding-left:20px}
.more li+li{margin-top:4px}
.more ul ul{margin-top:4px}

/* Choice column */
.choice{min-height:0;overflow-y:auto;padding:0 4px 32px 0}
.pick{background:var(--pick-bg);border-radius:8px;padding:14px 16px}
.pick>*+*{margin-top:6px}
.pick .head{font-weight:650}
.pick .head .lbl{color:var(--accent-ink)}
fieldset{border:0;margin:12px 0 0;padding:0;min-width:0}
.opt{background:var(--surface);border:1px solid var(--border);border-radius:8px}
.opt+.opt{margin-top:8px}
.opt:hover{border-color:var(--control)}
.opt:has(input:checked){border-color:var(--text);outline:1px solid var(--text);outline-offset:-2px}
.opt>label{display:grid;grid-template-columns:20px 1fr;gap:2px 12px;padding:12px 14px;cursor:pointer}
.opt input{width:18px;height:18px;margin:3px 0 0;accent-color:var(--text);cursor:pointer}
.ohead{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.olabel{font-weight:650}
.otags{margin-left:auto;display:flex;gap:6px;align-items:baseline}
.tag{font-size:14px;line-height:20px;padding:0 7px;border-radius:4px;white-space:nowrap}
.tag-pick{color:var(--accent-ink);border:1px solid var(--accent);line-height:18px}
.risk-low{background:var(--low-bg);color:var(--low-ink)}
.risk-medium{background:var(--med-bg);color:var(--med-ink)}
.risk-high{background:var(--high-bg);color:var(--high-ink)}
kbd{font:14px/18px var(--font);color:var(--muted);border:1px solid var(--control);border-radius:4px;padding:0 5px;min-width:20px;text-align:center}
.tr{grid-column:2;display:grid;grid-template-columns:max-content 1fr;gap:1px 10px;margin-top:4px}
.tr dt{font-size:14px;color:var(--muted);line-height:24px}
.opt details{padding:0 14px 8px 46px;margin-top:-6px}
.opt details>summary{font-weight:500;color:var(--muted);font-size:14px;line-height:20px}
.note{margin-top:12px}
.note label{font-size:14px;color:var(--muted)}
textarea{display:block;width:100%;margin-top:4px;font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--control);border-radius:6px;padding:6px 10px;resize:vertical}

/* Overview and finish */
.page-head{max-width:72ch}
.page-head>*+*{margin-top:8px}
.ov-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px 48px;margin-top:28px;align-items:start}
.ov-grid .full{grid-column:1/-1}
.ov-grid .col{display:grid;gap:32px;min-width:0}
.ov-grid h2{margin-bottom:8px}
.ov-grid ul{padding-left:20px}
.ov-grid li+li{margin-top:6px}
.ov-grid .note-line{margin-top:8px;font-size:14px;color:var(--muted)}
.chart svg{display:block;width:100%;max-width:560px;height:auto;color:var(--text)}
.chart text{font:14px var(--font);fill:currentColor}
.chart .g{font-weight:650}
.chart .bar-hi{fill:var(--accent)}
.chart .bar-lo{fill:var(--bar)}
.chart .base{stroke:var(--border)}
.link{background:none;border:0;padding:0;color:var(--accent-ink);text-decoration:underline;text-underline-offset:3px;cursor:pointer;text-align:left}
.fin-actions{display:flex;gap:12px;margin-top:20px}
.copy-prev{margin-top:16px}
.copy-prev pre{font:14px/1.5 var(--mono);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;white-space:pre-wrap;margin:6px 0 0;max-width:100ch}
.fin-table td.ans{white-space:nowrap}
.fin-table td.none{color:var(--muted)}

/* Footer nav: same place on every step */
.nav{background:var(--surface);border-top:1px solid var(--border)}
.nav-in{max-width:1440px;margin:0 auto;padding:10px 32px;display:flex;align-items:center;gap:16px}
.keys{font-size:14px;color:var(--muted);margin-left:auto}
.btn{height:40px;padding:0 18px;border-radius:6px;border:1px solid var(--control);background:var(--surface);cursor:pointer;font-weight:500}
.btn:hover{background:var(--raised)}
.btn.primary{background:var(--text);color:var(--surface);border-color:var(--text);font-weight:650}
.btn.primary:hover{opacity:.88}
.btn:disabled{opacity:.4;cursor:default}
`;

// ---------- Render ----------

const CHECK = `<svg class="ck" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function renderTable(t, { caption = true, cls = "" } = {}) {
  const al = (k) => (t.align && t.align[k] === "right" ? ' class="num"' : "");
  return `<table${cls ? ` class="${cls}"` : ""}>${caption ? `<caption>${inline(t.title)}</caption>` : ""}<thead><tr>${t.columns.map((h, k) => `<th scope="col"${al(k)}>${inline(h)}</th>`).join("")}</tr></thead><tbody>${t.rows
    .map((r) => `<tr>${r.map((cell, k) => `<td${al(k)}>${inline(String(cell))}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function renderItems(items) {
  let h = "<ul>";
  (items || []).forEach((it, k) => {
    if (Array.isArray(it)) return;
    const next = items[k + 1];
    h += `<li>${inline(it)}${Array.isArray(next) ? renderItems(next) : ""}</li>`;
  });
  return h + "</ul>";
}

// Horizontal bars, direct labels, one hue for the highlighted series (no legend needed).
function renderBars(b) {
  const W = 560, labelW = 112, x0 = 120, valW = 44, scaleW = W - x0 - valW, rowH = 24, headH = 28, gapH = 14;
  let y = 0, svg = "";
  for (const g of b.groups) {
    svg += `<text class="g" x="0" y="${y + 18}">${esc(g.label)}</text>`;
    if (g.note) svg += `<text x="${W}" y="${y + 18}" text-anchor="end">${esc(g.note)}</text>`;
    y += headH;
    for (const bar of g.bars) {
      const w = Math.max(1, Math.round((scaleW * bar.value) / b.max));
      svg += `<text x="${labelW}" y="${y + 16}" text-anchor="end">${esc(bar.label)}</text>`;
      svg += `<rect class="${bar.highlight ? "bar-hi" : "bar-lo"}" x="${x0}" y="${y + 4}" width="${w}" height="16" rx="2"/>`;
      svg += `<text x="${x0 + w + 6}" y="${y + 16}">${esc(String(bar.value))}</text>`;
      y += rowH;
    }
    svg += `<line class="base" x1="${x0}" y1="${y - rowH + 22}" x2="${x0}" y2="${y - g.bars.length * rowH + 2}"/>`;
    y += gapH;
  }
  const label = b.alt || `${b.title}. ` + b.groups.map((g) => `${g.label}: ` + g.bars.map((x) => `${x.label} ${x.value}`).join(", ")).join("; ");
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${y}" role="img" aria-label="${esc(label)}">${svg}</svg></figure>`;
}

function renderBlock(b) {
  let body = "";
  if (b.type === "text") body = (b.paragraphs || []).map((p) => `<p>${inline(p)}</p>`).join("");
  else if (b.type === "list") body = renderItems(b.items);
  else if (b.type === "table") body = renderTable(b, { caption: false });
  else if (b.type === "bars") body = renderBars(b);
  return `<section class="blk"><h2>${inline(b.title)}</h2>${body}${b.note ? `<p class="note-line">${inline(b.note)}</p>` : ""}</section>`;
}

// Overview blocks sit in a left or right column, or span the full width (place: left | right | full).
function cols(blocks) {
  const at = (pl) => blocks.filter((b) => (b.place || "full") === pl).map(renderBlock).join("");
  const l = at("left"), r = at("right"), f = blocks.filter((b) => (b.place || "full") === "full").map((b) => renderBlock(b).replace('class="blk"', 'class="blk full"')).join("");
  return (l || r ? `<div class="col">${l}</div><div class="col">${r}</div>` : "") + f;
}

function renderOverview(c) {
  const ov = c.overview;
  const qrows = c.questions.map((q, i) => {
    const o = q.options.find((x) => x.key === q.pick.key);
    return `<tr><td>Q${i + 1}</td><td><button type="button" class="link" data-go="${i + 1}">${inline(q.title)}</button></td><td>${esc(o.key)}. ${inline(o.label)}</td><td>${esc(q.pick.confidence)}</td></tr>`;
  }).join("");
  const qtable = !c.questions.length ? "" : `<section class="blk full"><h2>The ${c.questions.length} questions and my picks</h2><table><thead><tr><th scope="col">#</th><th scope="col">Question</th><th scope="col">My pick</th><th scope="col">Confidence</th></tr></thead><tbody>${qrows}</tbody></table></section>`;
  return `<section class="step" data-step="0" aria-labelledby="h-ov" hidden><div class="wrap">
<header class="page-head"><h1 id="h-ov" tabindex="-1">${inline(ov.heading)}</h1>${ov.lead ? `<p>${inline(ov.lead)}</p>` : ""}${c.page.subtitle ? `<p class="muted">${inline(c.page.subtitle)}</p>` : ""}</header>
<div class="ov-grid">${cols(ov.blocks || [])}${qtable}</div>
</div></section>`;
}

function renderQuestion(q, i) {
  const id = `Q${i + 1}`, n = i + 1;
  const pickOpt = q.options.find((o) => o.key === q.pick.key);
  const facts = `<ul class="facts">${q.facts.map((f) => `<li>${inline(f)}</li>`).join("")}</ul>`;
  const table = q.table ? `<div class="blk">${renderTable(q.table)}</div>` : "";
  const ex = `<section class="blk example"><h2>Example: ${inline(q.example.title)}</h2><ol class="steps-ex">${q.example.steps
    .map((s) => `<li><span class="when">${inline(s.when)}</span><span>${inline(s.text)}</span></li>`)
    .join("")}</ol></section>`;
  const details = q.details ? `<details class="blk more"><summary>${inline(q.details.summary)}</summary>${renderItems(q.details.items)}</details>` : "";
  const ctx = `<article class="ctx" aria-labelledby="h-${id}">
<h1 id="h-${id}" tabindex="-1">${inline(q.title)}</h1>
<p class="ask"><strong>Decide:</strong> ${inline(q.ask)}</p>
<p class="why">${inline(q.why)}</p>
${facts}${table}${ex}${details}
</article>`;
  const pick = `<section class="pick" aria-label="My pick" data-pick-line="${esc(pickOpt.key)}">
<p class="head"><span class="lbl">My pick:</span> ${esc(pickOpt.key)}. ${inline(pickOpt.label)}</p>
<p>${inline(q.pick.reason)} Confidence: <strong>${esc(q.pick.confidence)}</strong>.</p>
<p><strong>Pick another if:</strong> ${inline(q.pick.another)}</p>
</section>`;
  const opts = q.options.map((o, k) => {
    const isPick = o.key === q.pick.key;
    const rid = `r-${id}-${o.key}`;
    return `<div class="opt" data-key="${esc(o.key)}"${isPick ? " data-pick" : ""}>
<label for="${rid}"><input type="radio" id="${rid}" name="${id}" value="${esc(o.key)}">
<span class="ohead"><span class="olabel">${esc(o.key)}. ${inline(o.label)}</span><span class="otags">${isPick ? '<span class="tag tag-pick">My pick</span>' : ""}<span class="tag risk-${esc(o.risk)}">Risk: ${esc(o.risk)}</span><kbd title="Press ${k + 1} to choose ${esc(o.key)}">${k + 1}</kbd></span></span>
<dl class="tr"><dt>Gets</dt><dd class="gets">${inline(o.gets)}</dd><dt>Costs</dt><dd class="costs">${inline(o.costs)}</dd><dt>Risk</dt><dd class="risk">${inline(o.riskText)}</dd></dl>
</label>${o.details ? `<details><summary>${inline(o.details.summary || "What " + o.key + " contains")}</summary>${renderItems(o.details.items)}</details>` : ""}
</div>`;
  }).join("\n");
  const choice = `<aside class="choice" aria-label="Your answer to ${id}">
${pick}
<fieldset><legend class="sr">Choose one option for ${id}</legend>
${opts}
</fieldset>
<div class="note"><label for="n-${id}">Note (optional)</label><textarea id="n-${id}" data-note="${id}" rows="2"></textarea></div>
</aside>`;
  return `<section class="step q" data-step="${n}" data-q="${id}" aria-labelledby="h-${id}" hidden><div class="wrap"><div class="q-grid">
${ctx}
${choice}
</div></div></section>`;
}

function renderFinish(c) {
  const N = c.questions.length;
  const rows = c.questions.map((q, i) => `<tr data-q="Q${i + 1}"><td>Q${i + 1}</td><td>${inline(q.title)}</td><td class="ans"></td><td class="nt"></td><td><button type="button" class="link" data-go="${i + 1}">Change<span class="sr"> answer to Q${i + 1}</span></button></td></tr>`).join("");
  return `<section class="step fin" data-step="${N + 1}" aria-labelledby="h-fin" hidden><div class="wrap">
<header class="page-head"><h1 id="h-fin" tabindex="-1">Check your answers</h1><p id="fin-sum"></p></header>
<table class="fin-table" style="margin-top:20px"><thead><tr><th scope="col">#</th><th scope="col">Question</th><th scope="col">Your answer</th><th scope="col">Note</th><th scope="col"><span class="sr">Change</span></th></tr></thead><tbody>${rows}</tbody></table>
<div class="fin-actions"><button type="button" class="btn primary" id="copy">Copy my answers</button><button type="button" class="btn" id="clear">Clear my answers</button><p id="copy-status" class="muted" role="status" style="align-self:center"></p></div>
<div class="copy-prev"><p class="muted">The button copies this text. You can also select it and copy it.</p><pre id="copytext"></pre></div>
</div></section>`;
}

const JS = String.raw`(function(){
var C=__CONFIG__;var N=C.ids.length;var st={a:{},n:{},step:0};
function $(i){return document.getElementById(i);}
function all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
function load(){try{var o=JSON.parse(localStorage.getItem(C.key)||"null");if(o&&typeof o==="object"){st.a=o.a||{};st.n=o.n||{};var p=parseInt(o.step,10);if(p>=0&&p<=N+1)st.step=p;}}catch(e){}}
function save(){try{localStorage.setItem(C.key,JSON.stringify(st));}catch(e){}}
function answered(){var k=0;C.ids.forEach(function(id){if(st.a[id])k++;});return k;}
function label(id,key){var m=C.labels[id]||{};return m[key]||"";}
function copyText(){var L=[C.title+(C.date?", "+C.date:"")+": my answers ("+answered()+" of "+N+")"];
 C.ids.forEach(function(id){var a=st.a[id];L.push(a&&label(id,a)?id+": "+a+" "+label(id,a):id+": (no answer)");
  var nt=String(st.n[id]||"").replace(/\s+/g," ").trim();if(nt)L.push("  Note: "+nt);});return L.join("\n");}
function applyForm(){C.ids.forEach(function(id){all('input[name="'+id+'"]').forEach(function(r){r.checked=st.a[id]===r.value;});var t=$("n-"+id);if(t)t.value=st.n[id]||"";});}
function finish(){var a=answered();$("fin-sum").textContent="You answered "+a+" of "+N+" questions."+(a<N?" Use the links to answer the rest.":" Copy your answers and send them.");
 all(".fin-table tr[data-q]").forEach(function(tr){var id=tr.getAttribute("data-q"),v=st.a[id],td=tr.querySelector(".ans");
  td.textContent=v?v+". "+label(id,v):"Not answered";td.classList.toggle("none",!v);
  tr.querySelector(".nt").textContent=String(st.n[id]||"").trim();});
 $("copytext").textContent=copyText();}
function refresh(){var a=answered();$("cA").textContent=a;$("cR").textContent=N-a;
 var s=st.step;$("where").textContent=s===0?"Overview":(s===N+1?"Check your answers":"Question "+s+" of "+N+": "+C.topics[s-1]);
 all(".step").forEach(function(el){el.hidden=el.getAttribute("data-step")!==String(s);});
 all(".sbtn").forEach(function(b){var k=parseInt(b.getAttribute("data-go"),10);var done=k>=1&&k<=N&&!!st.a[C.ids[k-1]];
  b.classList.toggle("done",done);var sr=b.querySelector(".st");if(sr)sr.textContent=done?" (answered)":"";
  if(k===s)b.setAttribute("aria-current","step");else b.removeAttribute("aria-current");});
 $("back").disabled=s===0;var nx=$("next");nx.hidden=s===N+1;nx.textContent=s===0?"Start with Q1":(s===N?"Check answers":"Next");
 $("keys").innerHTML=s>=1&&s<=N?"<kbd>&larr;</kbd> <kbd>&rarr;</kbd> move &middot; <kbd>1</kbd> to <kbd>"+C.counts[s-1]+"</kbd> choose":"<kbd>&larr;</kbd> <kbd>&rarr;</kbd> move";
 if(s===N+1)finish();}
function go(k,focus){k=Math.max(0,Math.min(N+1,k));st.step=k;save();refresh();var m=document.querySelector("main");if(m)m.scrollTop=0;
 if(focus!==false){var h=document.querySelector('.step[data-step="'+k+'"] h1');if(h)h.focus({preventScroll:true});}}
function choose(id,key){st.a[id]=key;save();applyForm();refresh();}
document.addEventListener("click",function(ev){var g=ev.target.closest&&ev.target.closest("[data-go]");if(g)go(parseInt(g.getAttribute("data-go"),10));});
$("back").addEventListener("click",function(){go(st.step-1);});
$("next").addEventListener("click",function(){go(st.step+1);});
document.addEventListener("change",function(ev){var t=ev.target;if(t.type==="radio")choose(t.name,t.value);});
document.addEventListener("input",function(ev){var t=ev.target;if(t.hasAttribute&&t.hasAttribute("data-note")){st.n[t.getAttribute("data-note")]=t.value;save();}});
document.addEventListener("keydown",function(ev){if(ev.ctrlKey||ev.metaKey||ev.altKey)return;var t=ev.target,tag=t&&t.tagName;
 if(tag==="TEXTAREA"||(tag==="INPUT"&&t.type!=="radio")||tag==="SUMMARY"&&(ev.key===" "||ev.key==="Enter"))return;
 if(ev.key==="ArrowLeft"){ev.preventDefault();go(st.step-1,false);}
 else if(ev.key==="ArrowRight"){ev.preventDefault();go(st.step+1,false);}
 else if(/^[1-9]$/.test(ev.key)&&st.step>=1&&st.step<=N){var id=C.ids[st.step-1];var r=all('input[name="'+id+'"]')[parseInt(ev.key,10)-1];if(r){ev.preventDefault();choose(id,r.value);r.focus({preventScroll:true});}}});
function copy(){var txt=copyText(),s=$("copy-status");function ok(){s.textContent="Copied.";setTimeout(function(){s.textContent="";},2500);}
 function fail(){s.textContent="The browser blocked the copy. Select the text below and copy it.";var r=document.createRange();r.selectNodeContents($("copytext"));var sel=getSelection();sel.removeAllRanges();sel.addRange(r);}
 try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,fail);return;}}catch(e){}fail();}
$("copy").addEventListener("click",copy);
$("clear").addEventListener("click",function(){if(!window.confirm("Clear all your answers and notes on this page?"))return;st={a:{},n:{},step:st.step};save();applyForm();refresh();});
window.decisionPage={copyText:copyText,go:go,state:function(){return JSON.parse(JSON.stringify(st));}};
load();applyForm();refresh();
})();`;

// A report page: the overview alone, no steps, no answers, no script.
function reportPage(c) {
  const ov = renderOverview(c).replace(" hidden>", ">");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(stripMarkup(c.page.title))}</title>
<style>${CSS}body{display:block;overflow:auto}</style>
</head>
<body>
<header class="bar"><div class="bar-in"><div class="bar-row"><p class="bar-title">${esc(stripMarkup(c.page.title))}${c.page.date ? `<span class="muted">${esc(c.page.date)}</span>` : ""}</p></div></div></header>
<main>
${ov}
</main>
</body>
</html>`;
}

export function buildPage(c) {
  const bad = validate(c);
  if (bad.length) throw new Error("content is not valid:\n- " + bad.join("\n- "));
  const N = c.questions.length;
  if (N === 0) return reportPage(c);
  const cfg = {
    key: c.page.storageKey, title: stripMarkup(c.page.title), date: c.page.date || "",
    ids: c.questions.map((q, i) => `Q${i + 1}`),
    topics: c.questions.map((q) => stripMarkup(q.topic)),
    counts: c.questions.map((q) => q.options.length),
    labels: Object.fromEntries(c.questions.map((q, i) => [`Q${i + 1}`, Object.fromEntries(q.options.map((o) => [o.key, stripMarkup(o.label)]))])),
  };
  const cfgJson = JSON.stringify(cfg).replace(/</g, "\\u003c");
  // An answered step shows a check in place of its number (same width, so the bar does not grow).
  const stepBtn = (k, text, no) => `<li><button type="button" class="sbtn" data-go="${k}">${no ? `${CHECK}<span class="no">${no}</span>` : ""}<span>${text}</span><span class="sr st"></span></button></li>`;
  const steps = [stepBtn(0, "Overview")]
    .concat(c.questions.map((q, i) => stepBtn(i + 1, esc(stripMarkup(q.topic)), i + 1)))
    .concat([stepBtn(N + 1, "Check answers")]).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(stripMarkup(c.page.title))}</title>
<style>${CSS}</style>
</head>
<body>
<header class="bar"><div class="bar-in">
<div class="bar-row"><p class="bar-title">${esc(stripMarkup(c.page.title))}${c.page.date ? `<span class="muted">${esc(c.page.date)}</span>` : ""}</p><p class="where" id="where" aria-live="polite">Overview</p>
<p class="counts"><span>Total<b>${N}</b></span><span>Answered<b id="cA">0</b></span><span>Remaining<b id="cR">${N}</b></span></p></div>
<nav class="steps" aria-label="Steps"><ol>${steps}</ol></nav>
</div></header>
<main>
${renderOverview(c)}
${c.questions.map(renderQuestion).join("\n")}
${renderFinish(c)}
</main>
<footer class="nav"><div class="nav-in"><button type="button" class="btn" id="back">Back</button><p class="keys" id="keys"></p><button type="button" class="btn primary" id="next">Next</button></div></footer>
<script>
${JS.replace("__CONFIG__", () => cfgJson)}
</script>
</body>
</html>`;
}
