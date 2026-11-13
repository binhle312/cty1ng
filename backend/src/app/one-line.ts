// An owner error line of the CLI or of the start can hold a setting or a path that the owner
// typed. Each control character in it (a line break, a tab, an escape code) is written in its
// escaped form, so the text stays one line and cannot move the cursor. Backslashes and quotes
// stay as they are. No imports: `main.ts` loads this before the settings pass.
const NAMED: Readonly<Record<string, string>> = { "\n": "\\n", "\r": "\\r", "\t": "\\t" };

export function oneLine(text: string): string {
  return text.replace(
    /\p{Cc}/gu,
    (char) => NAMED[char] ?? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
