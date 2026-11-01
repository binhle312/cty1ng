import { describe, expect, it } from "vitest";
import { findSensitive, firstSensitive, ibanValid, luhn } from "./sensitive-data.rules.ts";

describe("findSensitive (D39)", () => {
  it.each([
    ["password: hunter22", "password"],
    ["db pwd=S3cret!x", "password"],
    ["key sk-proj-abcdefghijklmnop1234", "api_key"],
    ["AKIAIOSFODNN7EXAMPLE", "api_key"],
    [`token ghp_${"a1B2".repeat(9)}`, "api_key"],
    ["slack xoxb-1234567890-abcdef", "api_key"],
    ["api_key = Zx81_kQ2pL9vT3mN7bR4wY6cH0sD5fG", "api_key"],
    ["-----BEGIN RSA PRIVATE KEY-----", "private_key"],
    ["-----BEGIN PRIVATE KEY-----", "private_key"],
    ["card 4111 1111 1111 1111", "card_number"],
    ["4111-1111-1111-1111", "card_number"],
    ["GB82 WEST 1234 5698 7654 32", "iban"],
    ["DE89370400440532013000", "iban"],
    ["Passport number C01X00T47", "passport"],
  ])("finds %j as %s", (text, kind) => {
    expect(findSensitive(text).map((match) => match.kind)).toContain(kind);
  });

  it.each([
    "Write user stories with acceptance criteria.",
    "The password field must have 12 characters.",
    "Use the token from the login step.",
    "api_key: user_profile_settings_page_name",
    "Order 4111 1111 1111 1112 is not a card (Luhn fails).",
    "Meeting on 2026-10-31 at 14:05.",
    "Passport photos go in the PASSPORT folder.",
    "GB00 WEST 1234 5698 7654 32",
  ])("finds nothing in %j", (text) => {
    expect(findSensitive(text)).toEqual([]);
  });

  it("gives the line and only the last 4 characters", () => {
    const [match] = findSensitive("# Steps\n\nkey sk-proj-abcdefghijklmnop9f2a");
    expect(match).toEqual({ kind: "api_key", line: 3, ending: "9f2a" });
  });

  // Text over a length limit is scanned before the limit check (M2 plan §4), so the scan must
  // stay linear: each detector reads a line once, not once per candidate. Before the fix, this
  // line took about 10 s and blocked the server; now it takes a few milliseconds.
  it("scans a 1 MB line of short code-like words in well under a second", () => {
    const line = "ABC123 ".repeat(150_000);
    const start = performance.now();
    expect(findSensitive(line)).toEqual([]);
    expect(findSensitive(`passport ${line}`)).toHaveLength(150_000);
    expect(performance.now() - start).toBeLessThan(1_000);
    expect(firstSensitive(`passport ${line}`)).toEqual({
      kind: "passport",
      line: 1,
      ending: "C123",
    });
    expect(firstSensitive(line)).toBeNull();
  });
});

describe("checksums", () => {
  it.each([
    ["4111111111111111", true],
    ["4111111111111112", false],
    ["79927398713", true],
  ])("luhn(%s) = %s", (digits, valid) => {
    expect(luhn(digits)).toBe(valid);
  });

  it.each([
    ["GB82WEST12345698765432", true],
    ["GB83WEST12345698765432", false],
    ["XX", false],
  ])("ibanValid(%s) = %s", (iban, valid) => {
    expect(ibanValid(iban)).toBe(valid);
  });
});
