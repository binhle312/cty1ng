// Decision page kit: content lint and page builder. ES module, no dependencies.
// Input: a content object (see content-format.md). Output: one self-contained HTML page.
// Rule ids point to references/research.md or references/content-format.md.

// ---------- Text helpers ----------

export const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const BOLD_MARKUP = /\*\*([^*]+?)\*\*/g;
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z0-9"'(#§\/])/g;

function inlineParts(s) {
  const text = String(s ?? "");
  const parts = text.split("`");
  return parts.length % 2 === 0 ? [text] : parts; // Unbalanced backticks stay literal.
}

// Safe inline markup: escape all text first, then allow only `code` and **bold**.
export function inline(s) {
  return inlineParts(s).map((part, i) => i % 2
    ? `<code${part.length <= 48 ? ' class="nw"' : ""}>${esc(part)}</code>`
    : esc(part).replace(BOLD_MARKUP, "<strong>$1</strong>")).join("");
}

const textParts = (s) => inlineParts(s).map((part, i) => i % 2 ? part : part.replace(BOLD_MARKUP, "$1"));
export const stripMarkup = (s) => textParts(s).join("");

// Plain text for counting: a code span counts as one word.
export function plain(s) {
  return textParts(s).map((part, i) => i % 2 ? "CODE" : part).join("");
}
export function countWords(s) {
  return plain(s).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
// A semicolon list counts as one sentence (R2.7).
export function sentences(s) {
  return plain(s)
    .split(SENTENCE_BREAK)
    .map((x) => x.trim())
    .filter(Boolean);
}
export function boldWords(s) {
  let count = 0;
  for (const [i, part] of inlineParts(s).entries()) {
    if (i % 2 === 0) for (const [, bold] of part.matchAll(BOLD_MARKUP)) count += countWords(bold);
  }
  return count;
}

// ---------- Limits ----------

const SCOPE_FIELDS_RULE = "R8.1 scope fields";

export const LIMITS = {
  titleWords: [12, "R5.2 the heading is the question, at most 12 words, ends with ?"],
  topicWords: [3, "R5.4 step buttons name the topic in 1-3 words"],
  topicChars: [16, "R5.4 short step names keep the step bar on one or two rows"],
  askWords: [20, "R2.4 BLUF: the ask is the first line, at most 20 words"],
  whyWords: [25, "R5.2 hint text is one short sentence"],
  decidesWords: [20, `${SCOPE_FIELDS_RULE}: state what the reader decides`],
  settledMax: [3, `${SCOPE_FIELDS_RULE}: list up to 3 settled items`],
  settledWords: [20, `${SCOPE_FIELDS_RULE}: keep each settled item short`],
  ownerWords: [25, `${SCOPE_FIELDS_RULE}: state why the reader decides`],
  removedWords: [25, `${SCOPE_FIELDS_RULE}: explain each removed option in Details`],
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
  fieldWords: [12, `${SCOPE_FIELDS_RULE} / R7b: Does, Gets, Costs and Risk are at most 12 words each`],
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
const DECIDES_LABEL = "Only this depends on you:";
const OWNER_LABEL = "Why you decide:";
const SETTLED_LABEL = "Already decided (no answer needed):";
const DECISION_HEADING = "The decision";
const FACTS_HEADING = "Facts";
const EXAMPLE_HEADING = "Example";
const OPTION_ROWS = [["does", "Does"], ["gets", "Gets"], ["costs", "Costs"], ["riskText", "Risk"]];
const riskChipText = (risk) => `Risk: ${risk}`;
const VOTE_ROLES = new Map([
  ["lead agent", "Lead agent"], ["worker", "Worker"], ["consultant", "Consultant"], ["advisor", "Advisor"],
]);
const hasVotes = (q) => q.options.some((o) => o.votes?.length);
const voteLabel = (vote) => `${VOTE_ROLES.get(vote.role)}: ${vote.name.replace(/\s+/g, " ").trim()}`;
const voteLabels = (o) => o.votes?.length ? o.votes.map(voteLabel) : ["No votes"];

function questionDetails(q) {
  if (!q.removed?.length) return q.details;
  return {
    summary: q.details?.summary || "Options removed",
    items: [...(q.details?.items || []), ...q.removed.map((item) => `Option removed: ${item}`)],
  };
}

// ---------- Validation (shape) ----------

export function validate(c) {
  const e = [];
  const need = (cond, msg) => { if (!cond) e.push(msg); };
  const hasText = (s) => typeof s === "string" && s.trim().length > 0;
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
    for (const f of ["decides", "owner"]) need(hasText(q[f]), `${id}.${f} is required and must be a non-empty string (${SCOPE_FIELDS_RULE})`);
    need(Array.isArray(q.settled) && q.settled.every(hasText), `${id}.settled is required and must be an array of non-empty strings (${SCOPE_FIELDS_RULE})`);
    if (q.removed !== undefined) need(Array.isArray(q.removed) && q.removed.every(hasText), `${id}.removed must be an array of non-empty strings (${SCOPE_FIELDS_RULE})`);
    if (q.example) need(Array.isArray(q.example.steps) && q.example.title, `${id}.example needs title and steps`);
    if (Array.isArray(q.options)) {
      const keys = q.options.map((o) => o.key);
      need(new Set(keys).size === keys.length, `${id} option keys must be unique`);
      q.options.forEach((o, k) => {
        for (const f of ["key", "label", "gets", "costs", "risk", "riskText"]) need(o[f], `${id}.options[${k}].${f} is required (R3.2 same fields for every option)`);
        need(hasText(o.does), `${id}.options[${k}].does is required and must be a non-empty string (${SCOPE_FIELDS_RULE})`);
        need(/^[A-Z]$/.test(o.key || ""), `${id}.options[${k}].key must be one capital letter`);
        if (o.votes !== undefined) {
          const path = `${id}.options[${k}].votes`;
          need(Array.isArray(o.votes), `${path} must be an array`);
          if (Array.isArray(o.votes)) o.votes.forEach((vote, j) => {
            need(vote && VOTE_ROLES.has(vote.role) && hasText(vote.name),
              `${path}[${j}] must have a role (${[...VOTE_ROLES.keys()].join(", ")}) and a non-empty name`);
            if (vote && typeof vote === "object") {
              const extra = Object.keys(vote).filter((key) => key !== "role" && key !== "name");
              need(extra.length === 0, `${path}[${j}] has unexpected keys: ${extra.join(", ")}`);
            }
          });
        }
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
  const errors = validate(c), warnings = [], stats = [];
  if (errors.length) return { errors, warnings, stats };
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
    const parts = inlineParts(t);
    if (parts.length === 1 && t.includes("`")) warnings.push(`${where}: unbalanced backtick; shown as plain text`);
    if (parts.some((part, i) => i % 2 === 0 && part.split("**").length % 2 === 0)) warnings.push(`${where}: unbalanced ** marker`);
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
    const countScopeLabel = (label) => { const words = countWords(label); ctx += words; bold += words; };

    count(`${id}.title`, q.title, "titleWords");
    ctx += countWords(DECISION_HEADING) + countWords(FACTS_HEADING);
    if (!/\?\s*$/.test(q.title || "")) errors.push(`${id}.title: must end with "?" (${LIMITS.titleWords[1]})`);
    if (countWords(q.topic) > L("topicWords")) errors.push(`${id}.topic: ${countWords(q.topic)} words > ${L("topicWords")} (${LIMITS.topicWords[1]})`);
    if (String(q.topic || "").length > L("topicChars")) errors.push(`${id}.topic: ${String(q.topic).length} characters > ${L("topicChars")} (${LIMITS.topicChars[1]})`);
    count(`${id}.ask`, q.ask, "askWords"); ctx += 1; // the "Decide:" label
    sent(`${id}.ask`, q.ask);
    count(`${id}.why`, q.why, "whyWords");
    if (sentences(q.why).length > 1) errors.push(`${id}.why: ${sentences(q.why).length} sentences, need 1 (${LIMITS.whyWords[1]})`);
    count(`${id}.decides`, q.decides, "decidesWords"); countScopeLabel(DECIDES_LABEL);
    count(`${id}.owner`, q.owner, "ownerWords"); countScopeLabel(OWNER_LABEL);
    sent(`${id}.owner`, q.owner);
    if (q.settled.length) {
      countScopeLabel(SETTLED_LABEL);
      if (q.settled.length > L("settledMax")) errors.push(`${id}.settled: ${q.settled.length} items > ${L("settledMax")} (${LIMITS.settledMax[1]})`);
      q.settled.forEach((item, k) => count(`${id}.settled[${k}]`, item, "settledWords"));
    }

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
    count(`${id}.example.title`, ex.title, "blockTitleWords"); ctx += countWords(EXAMPLE_HEADING);
    range(`${id}.example steps`, ex.steps.length, "stepsMin", "stepsMax");
    ex.steps.forEach((s, k) => {
      count(`${id}.example.steps[${k}].when`, s.when, "whenWords");
      count(`${id}.example.steps[${k}].text`, s.text, "stepWords"); sent(`${id}.example.steps[${k}]`, s.text);
    });

    // Details label (visible); details body is collapsed and not counted
    const details = questionDetails(q);
    if (details) count(`${id}.details.summary`, details.summary, "blockTitleWords");
    if (q.details) detailItems(`${id}.details`, q.details.items);
    (q.removed || []).forEach((item, k) => {
      const where = `${id}.removed[${k}]`;
      max(where, item, "removedWords"); markup(where, item);
    });

    // Options
    const opts = q.options || [];
    range(`${id}.options`, opts.length, "optionsMin", "optionsMax");
    const showVotes = hasVotes(q);
    let choice = 0;
    opts.forEach((o) => {
      const w = `${id}.option ${o.key}`;
      for (const [field, label] of [["label", ""], ...OPTION_ROWS]) {
        const where = `${w}.${field}`;
        markup(where, o[field]); sent(where, o[field]);
        choice += max(where, o[field], label ? "fieldWords" : "labelWords") + countWords(label);
      }
      choice += countWords(riskChipText(o.risk));
      if (showVotes) for (const label of voteLabels(o)) {
        markup(`${w}.votes`, label); sent(`${w}.votes`, label);
        choice += countWords(label);
      }
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

function feedbackLines({ clear, missing } = {}) {
  const lines = [`Page clear: ${clear === "yes" || clear === "no" ? clear : "(no answer)"}`];
  const text = String(missing || "").replace(/\s+/g, " ").trim();
  if (text) lines.push(`  Missing: ${text}`);
  return lines;
}

function copiedVoteLines(q, option) {
  return hasVotes(q) ? voteLabels(option).map((label) => `  ${stripMarkup(label)}`) : [];
}

export function copyLines(c, answers, notes, feedback) {
  let answered = 0;
  const out = [];
  c.questions.forEach((q, i) => {
    const id = `Q${i + 1}`, a = answers[id];
    const o = q.options.find((x) => x.key === a);
    if (o) answered++;
    out.push(o ? `${id}: ${o.key} ${stripMarkup(o.label)}` : `${id}: (no answer)`);
    if (o) out.push(...copiedVoteLines(q, o));
    const nt = String(notes[id] || "").replace(/\s+/g, " ").trim();
    if (nt) out.push(`  Note: ${nt}`);
  });
  const header = `${stripMarkup(c.page.title)}${c.page.date ? ", " + c.page.date : ""}: my answers (${answered} of ${c.questions.length})`;
  return [header, ...out, ...feedbackLines(feedback)].join("\n");
}

// ---------- Styles ----------
// Tokens: one ground, one ink, one accent. The accent fill marks one thing per question: my pick (R4.1).
// Workbench uses three type sizes (R4.2) and a local Inter font with system fallbacks.

const CSS = `
:root{
 --ground:#f5f7fb;--surface:#ffffff;--raised:#f1f4f9;--border:#dce2ea;--rule:#e8ecf2;--control:#b8c2d0;
 --text:#1d273b;--muted:#5a6880;--accent:#066fd1;--accent-ink:#055bb0;--pick-bg:#eaf3fd;--bar:#8a96a8;
 --low-bg:#e6f6ec;--low-ink:#1f6b3a;--med-bg:#fdf1dc;--med-ink:#7c4a03;--high-bg:#fce6e6;--high-ink:#a12a2a;
 --code:#eef2f7;--nav:#182433;--nav-ink:#c9d3e0;--ok:#2fb344;
 --shadow:0 1px 2px rgba(24,36,51,.06);--shadow-hover:0 6px 16px -6px rgba(24,36,51,.18);
 --font:"Inter",system-ui,"Segoe UI",Roboto,Arial,sans-serif;
 --mono:"JetBrains Mono",ui-monospace,Consolas,monospace;
 --content-width:calc(100% * 10 / 12);--panel-radius:8px;--nav-accent:#066fd1;
 --slide:260ms;--slide-d:28px;--shift:12px;
 --ease:cubic-bezier(.2,.75,.25,1);--spring:cubic-bezier(.34,1.56,.64,1);
 --lead-bg:#e5f5ef;--lead-ink:#11603f;--worker-bg:#fae9ee;--worker-ink:#8a2e54;
 --consultant-bg:#f0ebfa;--consultant-ink:#5530a0;--advisor-bg:#fbf0e3;--advisor-ink:#7a4510;
 color-scheme:light dark;
}
@media (prefers-color-scheme:dark){:root{
 --ground:#111a26;--surface:#182433;--raised:#1f2d3f;--border:#2a3a50;--rule:#24344a;--control:#41546e;
 --text:#e3e9f1;--muted:#9fadc2;--accent:#4c9cf0;--accent-ink:#7ab5f5;--pick-bg:#17324f;--bar:#7d8ba0;
 --low-bg:#143323;--low-ink:#8bdfa7;--med-bg:#3a2b0f;--med-ink:#f1c777;--high-bg:#3f1b1b;--high-ink:#ffa9a9;
 --code:#1f2d3f;--nav:#0c131d;--nav-ink:#aab6c6;
 --shadow:0 1px 2px rgba(0,0,0,.3);--shadow-hover:0 6px 16px -6px rgba(0,0,0,.6);
 --lead-bg:#123528;--lead-ink:#8fd9b6;--worker-bg:#3c2131;--worker-ink:#f4aaca;
 --consultant-bg:#2a2147;--consultant-ink:#c5b3f2;--advisor-bg:#3a2a14;--advisor-ink:#f0c58f;
}}
*{box-sizing:border-box}
[hidden]{display:none!important}
html,body{height:100%;overscroll-behavior-x:none}
body{margin:0;background:var(--ground);color:var(--text);font:16px/1.5 var(--font);display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;
 scrollbar-color:var(--control) transparent}
::selection{background:var(--pick-bg);color:var(--text)}
h1,h2,h3,p,ul,ol,dl,dd,figure{margin:0}
h1{font-size:24px;line-height:1.25;font-weight:650;letter-spacing:-.015em;text-wrap:balance}
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
.bar{background:var(--nav);color:#fff}
.bar-in,.nav-in,.wrap{width:var(--content-width);margin:0 auto}
.bar-in{padding:10px 0}
.bar-row{display:flex;align-items:baseline;gap:20px}
.bar-title{font-weight:650}
.bar-title .muted{font-weight:400;margin-left:6px}
.bar .muted,.where,.counts{color:var(--nav-ink)}
.counts{margin-left:auto;display:flex;gap:18px;font-size:14px;font-variant-numeric:tabular-nums}
.counts span{display:inline-flex;align-items:baseline;gap:6px;background:rgba(255,255,255,.07);border-radius:6px;padding:1px 8px}
.counts b{display:inline-block;color:#fff;font-size:16px}
.steps ol{list-style:none;padding:0;margin:8px 0 0 -6px;display:flex;flex-wrap:wrap;gap:2px}
.sbtn{font-size:14px;line-height:20px;padding:3px 12px 3px 4px;border-radius:999px;border:0;background:none;color:var(--nav-ink);cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.sbtn:not(:has(.no)){padding-left:12px}
.sbtn:hover{background:rgba(255,255,255,.08);color:#fff}
.sbtn[aria-current="step"]{background:rgba(255,255,255,.12);color:#fff;font-weight:650}
.sbtn .no,.sbtn .ck{width:24px;height:24px;border-radius:50%;border:1.5px solid rgba(255,255,255,.35)}
.sbtn .no{display:inline-grid;place-items:center;font-weight:600}
.sbtn[aria-current="step"] .no{background:var(--nav-accent);border-color:var(--nav-accent)}
.sbtn .ck{display:none;padding:4px;background:var(--ok);border-color:var(--ok);color:var(--nav)}
.sbtn.done{color:#fff}
.sbtn.done .ck{display:block}
.sbtn.done .no{display:none}

/* Main area scrolls; the choice column stays in view (R2.2 trade-offs next to the radio) */
main{overflow:auto;overflow-x:hidden;scroll-padding-top:16px}
.wrap{padding:16px 0 32px}
/* Equal panes give the options room to fit above the footer. Each pane scrolls on its own. */
.step.q{height:100%}
.step.q .wrap{height:100%;padding:20px 0 16px}
.q-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;height:100%;align-items:stretch}
.panel,.opt{background:var(--surface);border:1px solid var(--border);border-radius:var(--panel-radius);box-shadow:var(--shadow)}
.ctx{min-height:0;overflow-y:auto;padding:20px 24px 28px;scroll-padding-top:16px}
.ctx>*{max-width:70ch}
.ctx>.sec{margin-top:28px}
.ctx>.sec+.sec{margin-top:36px}
.ctx h1{outline:none}
.ctx .sec>h2,.ctx .sec>summary{font-size:16px;line-height:24px;margin:0 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.ctx .sec>h3{font-size:14px;line-height:20px;font-weight:600;color:var(--muted);margin:0 0 10px}
.ctx .decision>*+*:not(.ask){margin-top:8px}
.ctx .more>summary{width:100%;margin-bottom:0}
.ctx .more[open]>summary{margin-bottom:12px}
.ctx summary h2{display:inline}
.ask{font-size:16px}
.ask strong{font-weight:650}
.why{color:var(--muted)}
.facts{padding-left:20px}
.facts li+li{margin-top:8px}
.facts li::marker{color:var(--accent)}
.ctx .sec table{margin-top:16px}

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
.steps-ex .when{color:var(--muted);white-space:nowrap;font-size:14px;line-height:24px;font-weight:500}

/* Details: one per question, label says what is inside (R2.5) */
details>summary{cursor:pointer;font-weight:650;width:max-content;max-width:100%}
details>summary:hover{text-decoration:underline;text-underline-offset:3px}
details[open]>summary{margin-bottom:8px}
.more ul{padding-left:20px}
.more li+li{margin-top:4px}
.more ul ul{margin-top:4px}

/* Choice column */
.choice{min-height:0;overflow-y:auto;padding:2px 4px 24px 2px}
.pick{background:var(--pick-bg);border:1px solid color-mix(in srgb,var(--accent) 22%,transparent);border-radius:var(--panel-radius);padding:12px 16px}
.pick.agreed{border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
.pick>*+*{margin-top:2px}
.pick .head,.pick .lbl{display:flex;align-items:center;gap:6px;font-weight:650}
.pick .head{flex-wrap:wrap}
.pick .lbl{color:var(--accent-ink);font-size:14px}
.pick .lbl .ck{width:14px;height:14px;color:var(--pick-bg);background:var(--accent-ink);border-radius:50%;padding:2px}
.yours{margin-left:auto;font-size:14px;line-height:20px;font-weight:500;padding:0 8px;border-radius:999px;background:var(--surface);color:var(--muted);border:1px solid var(--border)}
.yours:empty{display:none}
.pick.agreed .yours{color:var(--accent-ink);border-color:color-mix(in srgb,var(--accent) 40%,transparent)}
fieldset{border:0;margin:12px 0 0;padding:0;min-width:0}
.opt+.opt{margin-top:8px}
.opt:hover{border-color:var(--control);box-shadow:var(--shadow-hover)}
.opt:has(input:checked){border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent),var(--shadow-hover)}
.opt:has(input:checked) .olabel{color:var(--accent-ink)}
.opt>label{display:grid;grid-template-columns:20px minmax(0,1fr);gap:2px 12px;padding:8px 14px;cursor:pointer}
.opt input{appearance:none;width:20px;height:20px;margin:2px 0 0;border-radius:50%;border:1.5px solid var(--control);background:var(--surface);cursor:pointer}
.opt input:checked{border-color:var(--accent);background:var(--accent);box-shadow:inset 0 0 0 4px var(--surface)}
.ohead{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.olabel{font-weight:650}
.otags{margin-left:auto;display:flex;gap:6px;align-items:baseline}
.tag{font-size:14px;line-height:20px;padding:0 7px;border-radius:4px;white-space:nowrap}
.tag-pick{color:var(--accent-ink);border:1px solid var(--accent);line-height:18px}
.votes{grid-column:2;display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;min-width:0}
.vb,.vnone{font-size:14px;line-height:20px;overflow-wrap:anywhere}
.vb{border-radius:999px;padding:0 8px;font-weight:600}
.vb-lead-agent{background:var(--lead-bg);color:var(--lead-ink)}
.vb-worker{background:var(--worker-bg);color:var(--worker-ink)}
.vb-consultant{background:var(--consultant-bg);color:var(--consultant-ink)}
.vb-advisor{background:var(--advisor-bg);color:var(--advisor-ink)}
.vnone{color:var(--muted)}
.risk-low{background:var(--low-bg);color:var(--low-ink)}
.risk-medium{background:var(--med-bg);color:var(--med-ink)}
.risk-high{background:var(--high-bg);color:var(--high-ink)}
kbd{font:14px/18px var(--font);color:var(--muted);border:1px solid var(--border);border-radius:4px;background:var(--raised);box-shadow:0 1px 0 var(--border);padding:0 5px;min-width:20px;text-align:center}
.tr{grid-column:2;display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:10px;margin-top:4px}
.tr dt,.tr dd{line-height:22px}
.tr dt{font-size:14px;color:var(--muted)}
.opt details{padding:0 14px 8px 46px;margin-top:-6px}
.opt details>summary{font-weight:500;color:var(--accent-ink);font-size:14px;line-height:20px}
.note{margin-top:12px}
.note label{font-size:14px;color:var(--muted)}
textarea{display:block;width:100%;margin-top:4px;font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:6px;box-shadow:var(--shadow);padding:6px 10px;resize:vertical}

/* Overview and finish */
.page-head{padding:20px 24px}
.page-head>*{max-width:70ch}
.page-head>*+*{margin-top:8px}
.ov-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:20px;align-items:start}
.ov-grid .full{grid-column:1/-1}
.ov-grid .col{display:grid;gap:20px;min-width:0}
.ov-grid .blk{padding-bottom:16px;overflow:hidden}
.ov-grid .qlist{padding-bottom:0}
.ov-grid h2{margin:0 0 12px;padding:12px 20px;border-bottom:1px solid var(--border)}
.ov-grid ul{padding:0 20px 0 40px}
.ov-grid li+li{margin-top:6px}
.ov-grid section>p,.ov-grid .chart{padding:0 20px}
.ov-grid th,.ov-grid td,.fin-table th,.fin-table td{padding-inline:20px}
.ov-grid th,.fin-table th{background:var(--raised)}
.ov-grid tbody tr:last-child td,.fin-table tbody tr:last-child td{border-bottom:0}
.ov-grid tbody tr:hover{background:var(--raised)}
.ov-grid .note-line{margin-top:8px;font-size:14px;color:var(--muted)}
.chart svg{display:block;width:100%;max-width:560px;height:auto;color:var(--text)}
.chart text{font:14px var(--font);fill:currentColor}
.chart .g{font-weight:650}
.chart .bar-hi{fill:var(--accent)}
.chart .bar-lo{fill:var(--bar)}
.chart .base{stroke:var(--border)}
.link{background:none;border:0;padding:0;color:var(--accent-ink);font-weight:500;cursor:pointer;text-align:left}
.link:hover,.link:focus-visible{text-decoration:underline;text-underline-offset:3px}
.fin-actions{display:flex;gap:12px;margin-top:20px}
.copy-prev{margin-top:16px}
.copy-prev pre{font:14px/1.5 var(--mono);padding:12px 14px;white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 0;max-width:100ch}
.fin-table-wrap{margin-top:20px;overflow:hidden}
.fin-table td:first-child{font-variant-numeric:tabular-nums}
.fin-table td.none{color:var(--muted)}

/* Footer nav: same place on every step */
.nav{background:var(--surface);border-top:1px solid var(--border)}
.nav-in{padding:10px 0;display:flex;align-items:center;gap:16px}
.keys{font-size:14px;color:var(--muted);margin-left:auto}
.btn{height:40px;padding:0 18px;border-radius:6px;border:1px solid var(--border);background:var(--surface);box-shadow:var(--shadow);cursor:pointer;font-weight:500}
.btn:hover{background:var(--raised)}
.btn.primary{background:var(--nav-accent);color:#fff;border-color:var(--nav-accent);font-weight:650}
.btn.primary:hover{opacity:.88}
.btn:disabled{opacity:.4;cursor:default}

@media (max-height:820px){
 .step.q .wrap{padding:8px 0}
 .opt+.opt{margin-top:4px}
 .opt>label{padding-block:4px;row-gap:0}
 .pick{padding-block:8px}
 .choice fieldset{margin-top:8px}
 .tr{grid-column:1/-1;margin-top:2px}
 .tr dt,.tr dd,.pick p{line-height:20px}
 .votes{margin-top:0;gap:2px 4px}
 .vb,.vnone{line-height:18px}
 .vb{padding-inline:6px}
}

/* The edge ring follows the horizontal gesture in the side gutter. */
.edge{--p:0;position:fixed;top:50%;z-index:5;width:48px;height:48px;border-radius:50%;pointer-events:none;opacity:0;
 display:grid;place-items:center;color:var(--accent-ink);
 background:conic-gradient(var(--accent) calc(var(--p) * 360deg),var(--border) 0)}
.edge::before{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--surface);box-shadow:var(--shadow)}
.edge svg{position:relative;width:20px;height:20px}
.edge-l{left:24px;transform:translate(calc((var(--p) - 1) * 48px),-50%)}
.edge-r{right:24px;transform:translate(calc((1 - var(--p)) * 48px),-50%)}
.edge.live{opacity:calc(.35 + .65 * var(--p))}
.edge.pop{color:var(--nav)}
.edge.pop::before{background:var(--accent)}
@media (prefers-reduced-motion:no-preference){
 .wrap,.edge{transition:transform 280ms var(--spring)}
 .wrap.drag{transition:transform 70ms linear}
 .wrap.in-next{animation:in-next var(--slide) var(--ease) both}
 .wrap.in-prev{animation:in-prev var(--slide) var(--ease) both}
 @keyframes in-next{from{opacity:0;transform:translateX(var(--slide-d))}to{opacity:1;transform:none}}
 @keyframes in-prev{from{opacity:0;transform:translateX(calc(-1 * var(--slide-d)))}to{opacity:1;transform:none}}
 .edge.live{transition:transform 70ms linear,opacity 70ms linear}
 .edge.pop{animation:pop-edge 160ms var(--ease)}
 @keyframes pop-edge{50%{scale:1.12}}
 .tick{animation:tick 240ms var(--ease)}
 @keyframes tick{from{opacity:0;transform:translateY(-55%)}}
 .opt{transition:box-shadow 200ms var(--ease),border-color 200ms var(--ease)}
 .opt.just-picked{animation:pop-option 240ms var(--ease)}
 @keyframes pop-option{from{scale:.985}}
 .pick.pop{animation:pop-box 280ms var(--ease)}
 @keyframes pop-box{from{scale:.99}}
 .yours.pop{animation:pop-in 240ms var(--spring)}
 @keyframes pop-in{from{opacity:0;transform:translateY(4px) scale(.9)}}
 .sbtn .ck path{stroke-dasharray:16}
 .sbtn.just-done .ck path{animation:just-done 300ms var(--ease)}
 @keyframes just-done{from{stroke-dashoffset:16}}
}
`;

// ---------- Render ----------

const CHECK = `<svg class="ck" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function renderEdge(side, path) {
  return `<div class="edge edge-${side}" id="edge-${side}" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
}

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

function renderBlock(b, full = false) {
  let body = "";
  if (b.type === "text") body = (b.paragraphs || []).map((p) => `<p>${inline(p)}</p>`).join("");
  else if (b.type === "list") body = renderItems(b.items);
  else if (b.type === "table") body = renderTable(b, { caption: false });
  else if (b.type === "bars") body = renderBars(b);
  return `<section class="blk panel${full ? " full" : ""}"><h2>${inline(b.title)}</h2>${body}${b.note ? `<p class="note-line">${inline(b.note)}</p>` : ""}</section>`;
}

// Overview blocks sit in a left or right column, or span the full width (place: left | right | full).
function cols(blocks) {
  const at = (pl) => blocks.filter((b) => (b.place || "full") === pl).map((b) => renderBlock(b, pl === "full")).join("");
  const l = at("left"), r = at("right"), f = at("full");
  return (l || r ? `<div class="col">${l}</div><div class="col">${r}</div>` : "") + f;
}

function renderOverview(c) {
  const ov = c.overview;
  const qrows = c.questions.map((q, i) => {
    const o = q.options.find((x) => x.key === q.pick.key);
    return `<tr><td>Q${i + 1}</td><td><button type="button" class="link" data-go="${i + 1}">${inline(q.title)}</button></td><td>${esc(o.key)}. ${inline(o.label)}</td><td>${esc(q.pick.confidence)}</td></tr>`;
  }).join("");
  const qtable = !c.questions.length ? "" : `<section class="blk panel full qlist"><h2>The ${c.questions.length} questions and my picks</h2><table><thead><tr><th scope="col">#</th><th scope="col">Question</th><th scope="col">My pick</th><th scope="col">Confidence</th></tr></thead><tbody>${qrows}</tbody></table></section>`;
  return `<section class="step" data-step="0" aria-labelledby="h-ov" hidden><div class="wrap">
<header class="page-head panel"><h1 id="h-ov" tabindex="-1">${inline(ov.heading)}</h1>${ov.lead ? `<p>${inline(ov.lead)}</p>` : ""}${c.page.subtitle ? `<p class="muted">${inline(c.page.subtitle)}</p>` : ""}</header>
<div class="ov-grid">${cols(ov.blocks || [])}${qtable}</div>
</div></section>`;
}

function renderQuestion(q, i) {
  const id = `Q${i + 1}`, n = i + 1;
  const pickOpt = q.options.find((o) => o.key === q.pick.key);
  const factList = (items) => `<ul class="facts">${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`;
  const settled = q.settled.length ? `<div class="settled"><p><strong>${SETTLED_LABEL}</strong></p>${factList(q.settled)}</div>` : "";
  const facts = factList(q.facts);
  const table = q.table ? renderTable(q.table) : "";
  const ex = `<section class="sec example"><h2>${EXAMPLE_HEADING}</h2><h3>${inline(q.example.title)}</h3><ol class="steps-ex">${q.example.steps
    .map((s) => `<li><span class="when">${inline(s.when)}</span><span>${inline(s.text)}</span></li>`)
    .join("")}</ol></section>`;
  const details = questionDetails(q);
  const ctx = `<article class="ctx panel" aria-labelledby="h-${id}">
<h1 id="h-${id}" tabindex="-1">${inline(q.title)}</h1>
<section class="sec decision"><h2>${DECISION_HEADING}</h2>
<p class="ask"><strong>Decide:</strong> ${inline(q.ask)}</p>
<p class="why">${inline(q.why)}</p>
<p class="decides"><strong>${DECIDES_LABEL}</strong> ${inline(q.decides)}</p>
<p class="owner"><strong>${OWNER_LABEL}</strong> ${inline(q.owner)}</p>
${settled}</section>
<section class="sec"><h2>${FACTS_HEADING}</h2>${facts}${table}</section>
${ex}
${details ? `<details class="sec more"><summary><h2>${inline(details.summary)}</h2></summary>${renderItems(details.items)}</details>` : ""}
</article>`;
  const pick = `<section class="pick" aria-label="My pick" data-pick-line="${esc(pickOpt.key)}">
<p class="head"><span class="lbl">${CHECK}My pick:</span> <span>${esc(pickOpt.key)}. ${inline(pickOpt.label)}</span><span class="yours" aria-live="polite"></span></p>
<p>${inline(q.pick.reason)} Confidence: <strong>${esc(q.pick.confidence)}</strong>.</p>
<p><strong>Pick another if:</strong> ${inline(q.pick.another)}</p>
</section>`;
  const showVotes = hasVotes(q);
  const opts = q.options.map((o, k) => {
    const isPick = o.key === q.pick.key;
    const rid = `r-${id}-${o.key}`;
    const rows = OPTION_ROWS.map(([field, label]) => `<dt>${label}</dt><dd class="${label.toLowerCase()}">${inline(o[field])}</dd>`).join("");
    const votes = showVotes ? `<span class="votes">${voteLabels(o).map((label, j) => {
      const role = o.votes?.[j]?.role;
      return `<span class="${role ? `vb vb-${role.replaceAll(" ", "-")}` : "vnone"}">${inline(label)}</span>`;
    }).join("")}</span>` : "";
    return `<div class="opt" data-key="${esc(o.key)}"${isPick ? " data-pick" : ""}>
<label for="${rid}"><input type="radio" id="${rid}" name="${id}" value="${esc(o.key)}">
<span class="ohead"><span class="olabel">${esc(o.key)}. ${inline(o.label)}</span><span class="otags">${isPick ? '<span class="tag tag-pick">My pick</span>' : ""}<span class="tag risk-${esc(o.risk)}">${esc(riskChipText(o.risk))}</span><kbd title="Press ${k + 1} to choose ${esc(o.key)}">${k + 1}</kbd></span></span>
${votes}<dl class="tr">${rows}</dl>
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
<header class="page-head panel"><h1 id="h-fin" tabindex="-1">Check your answers</h1><p id="fin-sum"></p></header>
<div class="fin-table-wrap panel"><table class="fin-table"><thead><tr><th scope="col">#</th><th scope="col">Question</th><th scope="col">Your answer</th><th scope="col">Note</th><th scope="col"><span class="sr">Change</span></th></tr></thead><tbody>${rows}</tbody></table></div>
<fieldset><legend>Did this page tell you what each question is about?</legend>
<label><input type="radio" name="page-clear" value="yes"> Yes</label>
<label><input type="radio" name="page-clear" value="no"> No</label>
</fieldset>
<div class="note"><label for="page-missing">What was missing? (optional)</label><textarea id="page-missing" rows="2"></textarea></div>
<div class="fin-actions"><button type="button" class="btn primary" id="copy">Copy my answers</button><button type="button" class="btn" id="clear">Clear my answers</button><p id="copy-status" class="muted" role="status" style="align-self:center"></p></div>
<div class="copy-prev"><p class="muted">The button copies this text. You can also select it and copy it.</p><pre class="panel" id="copytext"></pre></div>
</div></section>`;
}

const JS = String.raw`(function(){
var C=__CONFIG__;var N=C.ids.length;var st={a:{},n:{},feedback:{},step:0};
var motion=matchMedia("(prefers-reduced-motion:no-preference)"),booted=false;
${feedbackLines}
function $(i){return document.getElementById(i);}
function all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
function replay(el,cls){if(!motion.matches||!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}
var motionClasses={"in-next":"in-next","in-prev":"in-prev",tick:"tick","pop-option":"just-picked","pop-box":"pop","pop-in":"pop","pop-edge":"pop","just-done":"just-done"};
document.addEventListener("animationend",function(ev){
 var cls=motionClasses[ev.animationName];if(cls)(cls==="just-done"?ev.target.closest(".sbtn"):ev.target).classList.remove(cls);});
function load(){try{var o=JSON.parse(localStorage.getItem(C.key)||"null");if(o&&typeof o==="object"){st.a=o.a||{};st.n=o.n||{};
 if(o.feedback&&typeof o.feedback==="object")st.feedback=o.feedback;
 var p=parseInt(o.step,10);if(p>=0&&p<=N+1)st.step=p;}}catch(e){}}
function save(){try{localStorage.setItem(C.key,JSON.stringify(st));}catch(e){}}
function hasAnswer(id){var key=st.a[id];return typeof key==="string"&&Object.hasOwn(C.labels[id],key);}
function answered(){return C.ids.filter(hasAnswer).length;}
function copyText(){var L=[C.title+(C.date?", "+C.date:"")+": my answers ("+answered()+" of "+N+")"];
 C.ids.forEach(function(id){var a=st.a[id];L.push(hasAnswer(id)?id+": "+a+" "+C.labels[id][a]:id+": (no answer)");
  if(hasAnswer(id))C.voteLines[id][a].forEach(function(line){L.push(line);});
  var nt=String(st.n[id]||"").replace(/\s+/g," ").trim();if(nt)L.push("  Note: "+nt);});return L.concat(feedbackLines(st.feedback)).join("\n");}
function applyForm(){C.ids.forEach(function(id){all('input[name="'+id+'"]').forEach(function(r){r.checked=st.a[id]===r.value;});var t=$("n-"+id);if(t)t.value=st.n[id]||"";});
 all('input[name="page-clear"]').forEach(function(r){r.checked=st.feedback.clear===r.value;});
 $("page-missing").value=st.feedback.missing||"";}
function updateCopyPreview(){$("copytext").textContent=copyText();}
function setFeedback(field,value){st.feedback[field]=value;save();updateCopyPreview();}
function finish(){var a=answered();$("fin-sum").textContent="You answered "+a+" of "+N+" questions."+(a<N?" Use the links to answer the rest.":" Copy your answers and send them.");
 all(".fin-table tr[data-q]").forEach(function(tr){var id=tr.getAttribute("data-q"),v=st.a[id],td=tr.querySelector(".ans"),selected=hasAnswer(id);
  td.textContent=selected?v+". "+C.labels[id][v]:"Not answered";td.classList.toggle("none",!selected);
  tr.querySelector(".nt").textContent=String(st.n[id]||"").trim();});
 updateCopyPreview();}
function updateCount(el,n){var value=String(n);if(el.textContent===value)return;el.textContent=value;if(booted)replay(el,"tick");}
function updatePick(id,i){
 var pick=document.querySelector('.step[data-step="'+(i+1)+'"] .pick'),badge=pick.querySelector(".yours");
 var key=hasAnswer(id)?st.a[id]:"",same=key===pick.getAttribute("data-pick-line");
 var text=key?"You chose "+key+(same?", same":""):"";
 if(badge.textContent===text)return;
 badge.textContent=text;pick.classList.toggle("agreed",same);
 if(booted&&key){replay(badge,"pop");replay(pick,"pop");}}
function refresh(){var a=answered();updateCount($("cA"),a);updateCount($("cR"),N-a);
 var s=st.step;$("where").textContent=s===0?"Overview":(s===N+1?"Check your answers":"Question "+s+" of "+N+": "+C.topics[s-1]);
 all(".step").forEach(function(el){el.hidden=el.getAttribute("data-step")!==String(s);});
 all(".sbtn").forEach(function(b){var k=parseInt(b.getAttribute("data-go"),10);var done=k>=1&&k<=N&&hasAnswer(C.ids[k-1]);
  var was=b.classList.contains("done");b.classList.toggle("done",done);
  if(done&&!was&&booted)replay(b,"just-done");
  if(!done)b.classList.remove("just-done");
  var sr=b.querySelector(".st");if(sr)sr.textContent=done?" (answered)":"";
  if(k===s)b.setAttribute("aria-current","step");else b.removeAttribute("aria-current");});
 $("back").disabled=s===0;var nx=$("next");nx.hidden=s===N+1;nx.textContent=s===0?"Start with Q1":(s===N?"Check answers":"Next");
 $("keys").innerHTML=s>=1&&s<=N?"<kbd>&larr;</kbd> <kbd>&rarr;</kbd> move &middot; <kbd>1</kbd> to <kbd>"+C.counts[s-1]+"</kbd> choose":"<kbd>&larr;</kbd> <kbd>&rarr;</kbd> move";
 C.ids.forEach(updatePick);
 if(s===N+1)finish();}
function go(k,focus){k=Math.max(0,Math.min(N+1,k));var old=st.step,active=document.activeElement;
 releaseSwipe();st.step=k;save();refresh();var m=document.querySelector("main");if(m)m.scrollTop=0;
 if(k!==old){var wrap=currentWrap();wrap.classList.remove("in-next","in-prev");replay(wrap,k>old?"in-next":"in-prev");}
 if(focus!==false||(k!==old&&active?.closest("[hidden],:disabled"))){var h=document.querySelector('.step[data-step="'+k+'"] h1');if(h)h.focus({preventScroll:true});}}
function choose(id,key){var old=st.a[id];st.a[id]=key;save();applyForm();refresh();
 if(key!==old){var input=document.getElementById("r-"+id+"-"+key);replay(input&&input.closest(".opt"),"just-picked");}}
document.addEventListener("click",function(ev){var g=ev.target.closest&&ev.target.closest("[data-go]");if(g)go(parseInt(g.getAttribute("data-go"),10));});
$("back").addEventListener("click",function(){go(st.step-1);});
$("next").addEventListener("click",function(){go(st.step+1);});
document.addEventListener("change",function(ev){var t=ev.target;if(t.type==="radio"){
 if(t.name==="page-clear")setFeedback("clear",t.value);else choose(t.name,t.value);}});
document.addEventListener("input",function(ev){var t=ev.target;if(t.hasAttribute&&t.hasAttribute("data-note")){st.n[t.getAttribute("data-note")]=t.value;save();}});
$("page-missing").addEventListener("input",function(ev){setFeedback("missing",ev.target.value);});
document.addEventListener("keydown",function(ev){if(ev.ctrlKey||ev.metaKey||ev.altKey)return;var t=ev.target,tag=t&&t.tagName;
 if(tag==="TEXTAREA"||(tag==="INPUT"&&(t.type!=="radio"||t.name==="page-clear"))||tag==="SUMMARY"&&(ev.key===" "||ev.key==="Enter"))return;
 if(ev.key==="ArrowLeft"){ev.preventDefault();go(st.step-1,false);}
 else if(ev.key==="ArrowRight"){ev.preventDefault();go(st.step+1,false);}
 else if(/^[1-9]$/.test(ev.key)&&st.step>=1&&st.step<=N){var id=C.ids[st.step-1];var r=all('input[name="'+id+'"]')[parseInt(ev.key,10)-1];if(r){ev.preventDefault();choose(id,r.value);r.focus({preventScroll:true});}}});
// Wheel events from the gesture and its momentum count as one swipe until a pause.
var SWIPE_PAUSE=180,SWIPE_DISTANCE=50,SWIPE_START=8,SWIPE_RATIO=1.5;
var swipe={x:0,y:0,time:0,done:false},swipeTimer,dragged;
var edges=[$("edge-l"),$("edge-r")];
var shift=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--shift"));
function currentWrap(){return document.querySelector('.step[data-step="'+st.step+'"] > .wrap');}
function releaseSwipe(){
 clearTimeout(swipeTimer);
 edges.forEach(function(edge){edge.classList.remove("live","pop");edge.style.removeProperty("--p");});
 if(dragged){dragged.classList.remove("drag");dragged.style.removeProperty("transform");dragged=null;}}
motion.addEventListener("change",function(){if(!motion.matches){
 releaseSwipe();all(".in-next,.in-prev,.tick,.just-done,.just-picked,.pop").forEach(function(el){
  el.classList.remove("in-next","in-prev","tick","just-done","just-picked","pop");});}});
function ownsHorizontalScroll(el){
 for(;el&&el!==document.body;el=el.parentElement){
  if(el.tagName==="TEXTAREA")return true;
  if(el.scrollWidth>el.clientWidth+1&&/^(auto|scroll)$/.test(getComputedStyle(el).overflowX))return true;}
 return false;}
function showSwipe(dir,progress,committed){
 if(!motion.matches)return;
 var edge=edges[dir>0?1:0],other=edges[dir>0?0:1];
 other.classList.remove("live","pop");other.style.removeProperty("--p");
 edge.classList.add("live");edge.style.setProperty("--p",progress.toFixed(3));
 clearTimeout(swipeTimer);
 if(committed)replay(edge,"pop");
 else {
  dragged=currentWrap();dragged.classList.remove("in-next","in-prev");dragged.classList.add("drag");
  dragged.style.transform="translateX("+(-dir*progress*shift).toFixed(1)+"px)";
 }
 swipeTimer=setTimeout(releaseSwipe,committed?160:SWIPE_PAUSE);}
document.addEventListener("wheel",function(ev){
 var now=performance.now();
 if(now-swipe.time>=SWIPE_PAUSE){swipe.x=0;swipe.y=0;swipe.done=false;}
 swipe.time=now;
 if(swipe.done)return;
 if(ev.ctrlKey||ev.metaKey||ownsHorizontalScroll(ev.target)){
  swipe.x=0;swipe.y=0;releaseSwipe();return;}
 var unit=ev.deltaMode===1?16:ev.deltaMode===2?innerWidth:1;
 swipe.x+=ev.deltaX*unit;swipe.y+=Math.abs(ev.deltaY*unit);
 var distance=Math.abs(swipe.x),dir=swipe.x>0?1:-1,next=st.step+dir;
 if(distance<SWIPE_START||distance<SWIPE_RATIO*swipe.y)return;
 var committed=distance>=SWIPE_DISTANCE;
 if(committed)swipe.done=true;
 if(next<0||next>N+1){releaseSwipe();return;}
 if(committed)go(next,false);
 showSwipe(dir,Math.min(distance/SWIPE_DISTANCE,1),committed);
},{passive:true});
function copy(){var txt=copyText(),s=$("copy-status");function ok(){s.textContent="Copied.";setTimeout(function(){s.textContent="";},2500);}
 function fail(){s.textContent="The browser blocked the copy. Select the text below and copy it.";var r=document.createRange();r.selectNodeContents($("copytext"));var sel=getSelection();sel.removeAllRanges();sel.addRange(r);}
 try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,fail);return;}}catch(e){}fail();}
$("copy").addEventListener("click",copy);
$("clear").addEventListener("click",function(){if(!window.confirm("Clear your answers, notes and feedback on this page?"))return;st={a:{},n:{},feedback:{},step:st.step};save();applyForm();refresh();});
window.decisionPage={copyText:copyText,go:go,state:function(){return JSON.parse(JSON.stringify(st));}};
load();applyForm();refresh();booted=true;
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

// ---------- Text export (for a writing check, such as an STE checker) ----------

function textWriter() {
  const lines = [];
  const item = (s) => lines.push(stripMarkup(s).trim());
  const add = (s) => {
    const parts = textParts(s);
    const text = parts.join("");
    // Hide code punctuation during the sentence scan. Keep the offsets into the original text.
    const prose = parts.map((part, i) => i % 2 ? "C".repeat(part.length) : part).join("");
    let start = 0;
    for (const match of prose.matchAll(SENTENCE_BREAK)) {
      const line = text.slice(start, match.index).trim();
      if (line) lines.push(line);
      start = match.index + match[0].length;
    }
    const last = text.slice(start).trim();
    if (last) lines.push(last);
  };
  const items = (list) => (list || []).forEach((it) => (Array.isArray(it) ? items(it) : add(it)));
  const table = (t) => {
    if (!t) return;
    add(t.title);
    add(t.columns.join(", "));
    t.rows.forEach((r) => add(r.map(String).join(", ")));
  };
  return { lines, add, item, items, table };
}

function writeQuestionText(q, { add, item, items, table }, screenOnly) {
  if (!screenOnly) add(q.topic);
  add(q.title);
  if (screenOnly) add(DECISION_HEADING);
  add(screenOnly ? `Decide: ${q.ask}` : q.ask);
  add(q.why);
  add(screenOnly ? `${DECIDES_LABEL} ${q.decides}` : q.decides);
  add(screenOnly ? `${OWNER_LABEL} ${q.owner}` : q.owner);
  if (screenOnly && q.settled.length) add(SETTLED_LABEL);
  q.settled.forEach(add);
  if (screenOnly) add(FACTS_HEADING);
  q.facts.forEach(add);
  table(q.table);
  if (screenOnly) add(EXAMPLE_HEADING);
  add(q.example.title);
  q.example.steps.forEach((step) => add(screenOnly ? `${step.when}: ${step.text}` : step.text));
  if (screenOnly) {
    const pick = q.options.find((option) => option.key === q.pick.key);
    item(`My pick: ${pick.key}. ${pick.label}`);
  } else {
    const details = questionDetails(q);
    if (details) { add(details.summary); items(details.items); }
  }
  add(q.pick.reason);
  if (screenOnly) add(`Confidence: ${q.pick.confidence}.`);
  add(screenOnly ? `Pick another if: ${q.pick.another}` : q.pick.another);
  const showVotes = hasVotes(q);
  for (const o of q.options) {
    if (screenOnly) {
      item(`${o.key}. ${o.label}`);
      item(riskChipText(o.risk));
      if (showVotes) voteLabels(o).forEach(item);
      OPTION_ROWS.forEach(([field, label]) => add(`${label}: ${o[field]}`));
    } else {
      add(o.label);
      if (showVotes) voteLabels(o).forEach(item);
      OPTION_ROWS.forEach(([field]) => add(o[field]));
      if (o.details) { add(o.details.summary); items(o.details.items); }
    }
  }
}

// Author text for the whole page, including Details. Keep one sentence or item per line.
export function pageText(c) {
  const writer = textWriter();
  const { lines, add, items, table } = writer;
  add(c.page.title);
  add(c.page.subtitle);
  const ov = c.overview || {};
  add(ov.heading);
  add(ov.lead);
  for (const b of ov.blocks || []) {
    if (b.type === "table") table(b);
    else add(b.title);
    if (b.type === "text") (b.paragraphs || []).forEach(add);
    if (b.type === "list") items(b.items);
    add(b.note);
  }
  for (const q of c.questions || []) writeQuestionText(q, writer, false);
  return lines;
}

// Question text that the reader can see before they open any Details.
export function questionText(q) {
  const writer = textWriter();
  writeQuestionText(q, writer, true);
  return writer.lines;
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
    voteLines: Object.fromEntries(c.questions.map((q, i) => [
      `Q${i + 1}`, Object.fromEntries(q.options.map((o) => [o.key, copiedVoteLines(q, o)])),
    ])),
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
${renderEdge("l", "M12.5 4.5 7 10l5.5 5.5")}${renderEdge("r", "M7.5 4.5 13 10l-5.5 5.5")}
<script>
${JS.replace("__CONFIG__", () => cfgJson)}
</script>
</body>
</html>`;
}
