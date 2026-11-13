// The failure lines that `cli.ts` and `main.ts` write on stderr can hold a setting or a path
// that the owner typed. Each control character in such a line (a line break, a tab, an escape
// code) is written in its escaped form, so the line stays one line and cannot move the cursor.
// Backslashes and quotes stay as they are. No imports: `main.ts` loads this before the settings
// pass.
const NAMED: Readonly<Record<string, string>> = { "\n": "\\n", "\r": "\\r", "\t": "\\t" };

export function oneLine(text: string): string {
  return text.replace(
    /\p{Cc}/gu,
    (char) => NAMED[char] ?? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
