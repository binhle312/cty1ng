// The sensitive-data guard (D39, security.md §2.13): patterns that look like secrets. Pure
// functions; M1 uses them for skills (no override), M3 for messages. A match is a warning about
// likely secrets, not a promise: patterns catch common formats only, and may flag harmless text.
// The matched text never leaves this module unmasked, and logs get only the kinds.

export type SensitiveKind =
  "password" | "api_key" | "private_key" | "card_number" | "iban" | "passport";

export interface SensitiveMatch {
  kind: SensitiveKind;
  // 1-based line of the match in the checked text.
  line: number;
  // The last 4 characters only, for "API key ending …9f2a".
  ending: string;
}

const LABELS: Record<SensitiveKind, string> = {
  password: "a password",
  api_key: "an API key",
  private_key: "a private key",
  card_number: "a card number",
  iban: "an IBAN",
  passport: "a passport number",
};

export function sensitiveLabel(kind: SensitiveKind): string {
  return LABELS[kind];
}

interface Detector {
  kind: SensitiveKind;
  pattern: RegExp;
  // The part of the match that is the secret (default: the whole match).
  group?: number;
  // A word the line must hold for this detector to run. It is tested once per line, never once
  // per match: a long line has many matches, and a scan per match is quadratic.
  lineHas?: RegExp;
  accept?: (secret: string) => boolean;
}

// A password detector finds a key and reads its value. It decides nothing else, because
// `passwordValueIsFree` owns the rule. Each spelling of the key scans alone, so a free value after
// one spelling cannot hide another spelling. Marks can close the key: `"password"`, `\"password\"`,
// `["password"]`, **password**.
const AFTER_KEY = String.raw`(?:\\?["']|[\`*\]]){0,4}\s*(?::=|=>|[:=])\*{0,2}\s*`;
// A value stops before the next key of a compact object, so the scan still reads that key.
const VALUE_END = String.raw`(?=,["']?[\w-]+["']?\??:|\s|$)`;
// A whole phrase in quotes or backticks, an unclosed quote, or a word: 4 or more characters.
const PASSWORD_VALUE = String.raw`("(?:[^"\\\n]|\\.){4,}"|'[^'\n]{4,}'|\`[^\`\n]{4,}\`\S*?${VALUE_END}|["'][^\s"']{4,}|[^\s"']\S{3,}?${VALUE_END})`;

const SETTING_WORD = String.raw`(?:true|false|null|string|boolean|bool|number|integer|text|(?:var)?char(?:\(\d+\))?)`;
const SETTING_TYPE = String.raw`${SETTING_WORD}(?:\|${SETTING_WORD})*`;

// The values that hold no secret (owner, 2026-11-05, security.md §2.13). A placeholder is not one.
const FREE_PASSWORD_VALUES: readonly RegExp[] = [
  // A literal or a type as a complete token, so false!, "false" and `false alarm` are strings.
  new RegExp(
    String.raw`^(?:\`${SETTING_TYPE}\`|${SETTING_TYPE})(?:[\`)}\],;]+[.:]?|\)=>.*)?$`,
    "i",
  ),
  // A reference: ${DB_PASSWORD}, $DB_PASSWORD, ${{ secrets.X }}, {password}, and {false} before the
  // end of a JSX tag. Case matters: $ecret123 is a password.
  /^["'`]?(?:\$\{\{?\s*[\w.-]+\s*\}\}?|\$[A-Z_][A-Z0-9_]*|\{[A-Za-z_$][\w.$]*\})["']?[`)}\],;]*[.:]?(?:\/?>.*)?$/,
  // Under the 4-character minimum: backticks do not count, as quotes do not.
  /^`[^`]{0,3}`[)}\],;]*[.:]?$/,
];

const passwordValueIsFree = (value: string): boolean =>
  FREE_PASSWORD_VALUES.some((free) => free.test(value));

// PWD is also the shell's working folder: /home/owner, ~/work, ../work, $(pwd).
const SHELL_PATH = /^["'`]?(?:~?\/|\.{1,2}\/|\$\()/;

const passwordDetector = (
  key: string,
  isFree: (value: string) => boolean = passwordValueIsFree,
): Detector => ({
  kind: "password",
  pattern: new RegExp(`${key}${AFTER_KEY}${PASSWORD_VALUE}`, "gi"),
  group: 1,
  accept: (value) => !isFree(value),
});

const DETECTORS: readonly Detector[] = [
  { kind: "private_key", pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g },
  // Any prefix, so there is no left boundary: `\b` does not fire after `_`. After the name, only a
  // number or an environment, because DB_PASSWORD_FILE is a path.
  passwordDetector(
    String.raw`(?:password|passwd)(?:\d+|_(?:prod|production|dev|staging|stage|test|old|new|\d+))?`,
  ),
  passwordDetector("pwd", (value) => passwordValueIsFree(value) || SHELL_PATH.test(value)),
  // In capitals only, because `test_pass: done` is not a password. The value has any case.
  passwordDetector("(?-i:[A-Z0-9]_PASS)"),
  {
    // Common provider prefixes: OpenAI and Anthropic (sk-), AWS (AKIA), GitHub (ghp_ and
    // friends), Slack (xox?-), Google (AIza).
    kind: "api_key",
    pattern:
      /\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abpors]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})/g,
  },
  {
    // A long random-looking value next to a word like key, token or secret, with any prefix
    // (`GITHUB_TOKEN=`, `clientSecret:`). `action-token@<hash>` is a pinned version, and a word
    // such as `commit` says that the value is a hash. The value starts a run of characters, and
    // `=` cannot start it, so `TOKEN=x` and `TOKEN: x` get the same answer.
    kind: "api_key",
    pattern:
      /(?:api[_ -]?key|token|secret(?:[_ -]?key(?:[_ -]?base)?)?|access[_ -]?key)(?:_?value|_\d+)?\b[^\n@]{0,20}?(?<!\b(?:commit|sha\d*|hash|digest|checksum|revision)\s+)(?<![A-Za-z0-9])([A-Za-z0-9_\-+/][A-Za-z0-9_\-+/=]{23,})/gi,
    group: 1,
    accept: (secret) => !madeOfWords(secret) && (highEntropy(secret) || randomLetters(secret)),
  },
  {
    kind: "card_number",
    pattern: /\b(?:\d[ -]?){12,18}\d\b/g,
    accept: (secret) => {
      const digits = secret.replace(/[ -]/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhn(digits);
    },
  },
  {
    kind: "iban",
    pattern: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g,
    accept: (secret) => ibanValid(secret.replace(/ /g, "")),
  },
  {
    kind: "passport",
    pattern: /\b[A-Z0-9]{6,9}\b/g,
    lineHas: /passport/i,
    accept: (secret) => /\d/.test(secret),
  },
];

// Every match, line by line, in detector order. A generator, so a caller that needs only the
// first match stops there instead of collecting a long line's thousands of candidates.
function* scan(text: string): Generator<SensitiveMatch> {
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    for (const detector of DETECTORS) {
      if (detector.lineHas !== undefined && !detector.lineHas.test(line)) continue;
      for (const found of line.matchAll(detector.pattern)) {
        const secret = found[detector.group ?? 0] ?? found[0];
        if (detector.accept !== undefined && !detector.accept(secret)) continue;
        const ending = secret.replace(/\\?["'`]$/, "").slice(-4);
        yield { kind: detector.kind, line: index + 1, ending };
      }
    }
  }
}

export function findSensitive(text: string): SensitiveMatch[] {
  return [...scan(text)];
}

// The first match, or null: what every save path reports (D39 names one finding).
export function firstSensitive(text: string): SensitiveMatch | null {
  const next = scan(text).next();
  return next.done === true ? null : next.value;
}

export function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

// ISO 13616: move the first four characters to the end, letters to numbers, mod 97 = 1.
export function ibanValid(iban: string): boolean {
  if (iban.length < 15 || iban.length > 34) return false;
  const moved = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;
  for (const char of moved) {
    const value = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

// At least three of lowercase, uppercase, digits and symbols, and few repeats: an identifier
// such as `user_profile_settings_page` is not a secret.
function highEntropy(value: string): boolean {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[_\-+/=]/].filter((re) => re.test(value)).length;
  return classes >= 3 && new Set(value).size >= Math.min(16, value.length / 2);
}

// Hex and other keys with few kinds of character, which `highEntropy` misses. A random value has
// letters, at least 8 different characters, and digits or both cases. A long number has no letter,
// a long word has neither digits nor both cases, and a repeated value has few different characters.
function randomLetters(value: string): boolean {
  return (
    /^[\da-z]+$/i.test(value) &&
    /[a-z]/i.test(value) &&
    (/\d/.test(value) || (/[a-z]/.test(value) && /[A-Z]/.test(value))) &&
    new Set(value).size >= 8
  );
}

// A value made of words is a name, not a key (owner, 2026-11-05): `user_profile_settings_page_2`,
// `CancellationTokenSource2Factory`. At least 70% of its characters are in words of 3 to 20
// letters. In a random value, letters of one case rarely stand together. The password check does
// not use this rule.
function madeOfWords(value: string): boolean {
  const words = value.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])/g) ?? [];
  const inWords = words.reduce(
    (sum, word) => (word.length >= 3 && word.length <= 20 ? sum + word.length : sum),
    0,
  );
  return inWords >= value.length * 0.7;
}
