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

const DETECTORS: readonly Detector[] = [
  { kind: "private_key", pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g },
  {
    // Any prefix: `DB_PASSWORD=`, `dbPassword:` and `"password":`. `\b` does not fire after `_`,
    // so there is no left boundary. `pwd` keeps one for letters and digits, because `OLDPWD` is a
    // shell variable. A placeholder has no exception. The lookahead frees only the literal
    // syntax of a setting: `true,`, `{false}` and `` `null` ``. It runs before the optional
    // quote, because a quoted `"false"` is a string, and so is `false!`.
    kind: "password",
    pattern:
      /(?:password|passwd|(?<![a-z0-9])pwd)["']?\s*[:=]\s*(?!(?:\{(?:true|false|null)\}|`?(?:true|false|null))(?:[`)}\],;]+[.:]?)?(?:\s|$))["']?([^\s"']{4,})/gi,
    group: 1,
  },
  {
    // Common provider prefixes: OpenAI and Anthropic (sk-), AWS (AKIA), GitHub (ghp_ and
    // friends), Slack (xox?-), Google (AIza).
    kind: "api_key",
    pattern:
      /\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abpors]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})/g,
  },
  {
    // A long random-looking string next to a word like key, token or secret, with any prefix
    // (`GITHUB_TOKEN=`, `clientSecret:`).
    kind: "api_key",
    pattern:
      /(?:api[_ -]?key|token|secret(?:[_ -]?key(?:[_ -]?base)?)?|access[_ -]?key)\b[^\n]{0,20}?([A-Za-z0-9][A-Za-z0-9_\-+/=]{23,})/gi,
    group: 1,
    // The value starts with a letter or a digit, so the `=` of `TOKEN=` is not part of it, and
    // `TOKEN=x` and `TOKEN: x` get the same answer.
    accept: (secret) => highEntropy(secret) || randomLettersAndDigits(secret),
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
        yield { kind: detector.kind, line: index + 1, ending: secret.slice(-4) };
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

// Hex and other keys in one case have only two kinds of character, so `highEntropy` misses them.
// A random value has letters, digits and at least 8 different characters. A long number has no
// letter, a long word has no digit, and a repeated value has few different characters.
function randomLettersAndDigits(value: string): boolean {
  return (
    /^[\da-z]+$/i.test(value) &&
    /\d/.test(value) &&
    /[a-z]/i.test(value) &&
    new Set(value).size >= 8
  );
}
