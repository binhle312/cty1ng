import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DESIGN_JSON, DESIGN_MD, TOKEN_FILE, checkDesignSnapshot } from "./lib/check-design.ts";

let root: string;

function write(path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

const TOKENS = `:root,
:root[data-theme="command"][data-mode="dark"] {
  --token-surface: #0e0f11;
  --token-primary: #f5b544;
  --token-font-sans: "Geist Variable", sans-serif;
}
:root[data-theme="command"][data-mode="light"] {
  --token-surface: #ffffff;
}`;

const designMd = (colours: string) =>
  `---\nname: x\ncolors:\n${colours}\ntypography:\n  body:\n    fontSize: "13px"\n---\n\n# x\n`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "check-design-"));
  write(TOKEN_FILE, TOKENS);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("design snapshot colours", () => {
  it("passes with no snapshot: Impeccable runs without one", () => {
    expect(checkDesignSnapshot(root)).toEqual([]);
  });

  it("passes when DESIGN.md and design.json match the dark tokens, in any case", () => {
    write(DESIGN_MD, designMd('  surface: "#0E0F11"\n  primary: "#F5B544"'));
    write(DESIGN_JSON, '{"css": "background: #F5B544; color: #0e0f11"}');
    expect(checkDesignSnapshot(root)).toEqual([]);
  });

  it("fails on a changed, a missing and an unknown colour in DESIGN.md", () => {
    write(DESIGN_MD, designMd('  surface: "#111111"\n  accent: "#F5B544"'));
    expect(checkDesignSnapshot(root)).toEqual([
      `${DESIGN_MD}: \`surface\` is #111111; ${TOKEN_FILE} has #0e0f11`,
      `${DESIGN_MD}: colour \`primary\` is in ${TOKEN_FILE} but not in DESIGN.md`,
      `${DESIGN_MD}: colour \`accent\` is not a token in ${TOKEN_FILE}`,
    ]);
  });

  it("reads DESIGN.md with CRLF line endings, as a Windows checkout writes it", () => {
    write(DESIGN_MD, designMd('  surface: "#0E0F11"\n  primary: "#F5B544"').replace(/\n/g, "\r\n"));
    expect(checkDesignSnapshot(root)).toEqual([]);
  });

  it("compares with the dark block, not the light one", () => {
    write(DESIGN_MD, designMd('  surface: "#ffffff"\n  primary: "#f5b544"'));
    expect(checkDesignSnapshot(root)).toHaveLength(1);
  });

  it("fails on a design.json colour that is not a dark token value", () => {
    write(DESIGN_JSON, '{"css": "background: #F5B544; border: 1px solid #123456"}');
    expect(checkDesignSnapshot(root)).toEqual([
      `${DESIGN_JSON}: #123456 is not a Command dark token value in ${TOKEN_FILE}`,
    ]);
  });
});
