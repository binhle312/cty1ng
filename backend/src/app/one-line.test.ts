import { describe, expect, it } from "vitest";
import { oneLine } from "./one-line.ts";

// The owner error lines of the CLI and of the start hold a setting or a path that the owner
// typed. A control character in it must not add a line or move the cursor.
describe("oneLine", () => {
  it.each([
    { name: "a line break", text: "a\nb", line: "a\\nb" },
    { name: "a Windows line break", text: "a\r\nb", line: "a\\r\\nb" },
    { name: "a tab", text: "a\tb", line: "a\\tb" },
    { name: "an escape code", text: "a\u001b[2Jb", line: "a\\u001b[2Jb" },
    { name: "DEL", text: "a\u007fb", line: "a\\u007fb" },
    { name: "a C1 control (NEL)", text: "a\u0085b", line: "a\\u0085b" },
  ])("writes $name as its escaped form", ({ text, line }) => {
    expect(oneLine(text)).toBe(line);
  });

  it("keeps a text with no control character as it is", () => {
    const text = `ENOENT: open 'C:\\data\\é "x".yaml' §2.1`;
    expect(oneLine(text)).toBe(text);
  });
});
