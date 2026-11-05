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

// Audit 2026-11-05, row 4 (owner decision 4). Built at run time (testing.md §3, "Fake secrets").
describe("findSensitive: prefixed names, the JSON form and long hex", () => {
  const randomKey = ["Zx81", "kQ2pL9vT3mN7bR4wY6cH0sD5fG"].join("_");
  const hex = "0123456789abcdef".repeat(2);
  const lettersAndDigits = ["k3j9x2m7", "q1w8e5r0", "t4y6u2i9", "o3p7a1s5"].join("");

  it.each([
    ["DB_PASSWORD=hunter22", "the prefixed name"],
    ["DB_PASSWORD=changeme", "a placeholder gets no exception"],
    ["password: changeme", "a placeholder gets no exception"],
    ["MY_PASSWD: hunter22", "the other spelling"],
    ["OLD_PWD=hunter22", "the short spelling"],
    ["db-password=hunter22", "a hyphen before the word"],
    ["dbPassword=hunter22", "a camelCase prefix"],
    ['"password": "hunter22"', "the JSON form"],
    ['{"password":"hunter22"}', "JSON with no spaces"],
    ['"DB_PASSWORD" : "hunter22"', "JSON with a prefix and a space"],
    ["'password': 'hunter22'", "single quotes"],
    ['"password": "abcd"', "the shortest value: 4 characters (owner, 2026-11-05)"],
    ["DB_PASSWORD=abcd", "the shortest value: 4 characters (owner, 2026-11-05)"],
    // Review of this PR: the exception took any symbols, so these strings were saved. Only the
    // literal syntax of a setting is free.
    ["password: false!", "a string that starts with a literal"],
    ['"password":"false!"', "a JSON string that starts with a literal"],
    ["password: true?", "a string that starts with a literal"],
    ["password: false.", "a string that ends with a dot"],
    ["password: !true!", "symbols around a literal"],
    ["PASSWORD=$false$", "symbols around a literal"],
    ["password: {true", "an open brace with no close"],
    ["password=trueSecret123", "a value that only starts like a literal"],
    ['"password": "false"', "a quoted word is a string, not a literal"],
    ['password="true"', "a quoted word is a string, not a literal"],
    ["'password': 'null'", "a quoted word is a string, not a literal"],
    ['password: "false alarm"', "a quoted phrase that starts with a literal"],
  ])("refuses %j as a password: %s", (text) => {
    expect(findSensitive(text).map((match) => match.kind)).toEqual(["password"]);
  });

  it.each([
    [`MY_API_KEY=${randomKey}`],
    [`GITHUB_TOKEN=${randomKey}`],
    [`access_token: ${randomKey}`],
    [`client_secret=${randomKey}`],
    [`"access_token": "${randomKey}"`],
    [`myApiKey=${randomKey}`],
    [`clientSecret: ${randomKey}`],
    [`api_key = ${hex}`],
    [`GITHUB_TOKEN=${hex}`],
    [`secret: ${hex.toUpperCase()}`],
    [`"access_token":"${hex}"`],
    [`AWS_ACCESS_KEY ${hex}`],
    [`GITHUB_TOKEN=${"0123abcd".repeat(4)}`],
    [`token ${"a1b2c3d4".repeat(3)}`],
    // Review of this PR: `=` counted as a kind of character, so these failed with `:` only.
    [`access_token: ${lettersAndDigits}`],
    [`client_secret: ${lettersAndDigits}`],
    [`MY_API_KEY: ${lettersAndDigits}`],
    [`"access_token": "${lettersAndDigits}"`],
    [`GITHUB_TOKEN=${lettersAndDigits}`],
    [`GITHUB_TOKEN: ${lettersAndDigits.toUpperCase()}`],
    // Review of this PR: the key word can end in `_KEY`, the usual name of a hex secret.
    [`SECRET_KEY=${hex}`],
    [`JWT_SECRET_KEY=${hex}`],
    [`secret_key: ${hex}`],
    [`SECRET_KEY_BASE=${hex}`],
  ])("refuses %j as an API key", (text) => {
    expect(findSensitive(text).map((match) => match.kind)).toEqual(["api_key"]);
  });

  // Review of this PR: `=` counted in the length, so 23 characters were refused only after `=`.
  describe.each([
    ["GITHUB_TOKEN=", ""],
    ["GITHUB_TOKEN: ", ""],
    ["GITHUB_TOKEN = ", ""],
    ['GITHUB_TOKEN="', '"'],
    ['"GITHUB_TOKEN": "', '"'],
  ])("a value after %j", (before, after) => {
    it("is free at 23 characters", () => {
      expect(findSensitive(`${before}${lettersAndDigits.slice(0, 23)}${after}`)).toEqual([]);
    });

    it("is refused at 24 characters", () => {
      const text = `${before}${lettersAndDigits.slice(0, 24)}${after}`;
      expect(findSensitive(text).map((match) => match.kind)).toEqual(["api_key"]);
    });
  });

  it("gives only the last 4 characters of a hex value, with no separator", () => {
    expect(findSensitive(`# Steps\nGITHUB_TOKEN=${hex}`)).toEqual([
      { kind: "api_key", line: 2, ending: "cdef" },
    ]);
  });

  // Skills have no override, so a false match blocks a save.
  it.each([
    ["DB_PASSWORD", "a name alone"],
    ["Set DB_PASSWORD in the .env file.", "a name in a sentence"],
    ["DB_PASSWORD=", "a name with no value"],
    ['"password": ""', "an empty JSON value"],
    ["password: abc", "a value under 4 characters, as before"],
    ["DB_PASSWORD_FILE=/run/secrets/db", "a longer name that is not the password"],
    ["password_policy: strict", "a setting about passwords"],
    ["passwordless: yes", "a word that starts with password"],
    ["require_password: true", "a true or false value"],
    ['"has_password": false,', "a JSON true or false value"],
    ['"password": null,', "a JSON null value"],
    ["Set `require_password: true`.", "a true or false value in Markdown code"],
    ["showPassword={false}", "a true or false value in JSX"],
    ["REQUIRE_PASSWORD=TRUE", "a true or false value in capitals"],
    ['{"require_password":true}', "a JSON literal with no spaces"],
    ['"password": false', "a JSON literal at the end of the line"],
    ["password: `false`", "a literal in Markdown code"],
    ["require_password: true\r", "a literal before a CRLF line end"],
    ["requirePassword={true}", "a true or false value in JSX"],
    ["OLDPWD=/home/owner", "the shell variable"],
    ["user_profile_settings_page", "an identifier alone"],
    ["GITHUB_TOKEN", "a name alone"],
    ["MY_API_KEY", "a name alone"],
    ["access_token", "a name alone"],
    ["client_secret", "a name alone"],
    ["token_count: 1024", "a number with a similar name"],
    ["GITHUB_TOKEN=user_profile_settings_page", "an identifier as the value"],
    ["GITHUB_TOKEN=CamelCaseIdentifierNameForThisThing", "letters with no digit, with ="],
    ["GITHUB_TOKEN: CamelCaseIdentifierNameForThisThing", "letters with no digit, with :"],
    ["token: averylongwordwithnodigitsinthewholeword", "one long word"],
    ["token: abc1_abc1_def2_def2_abc1_def2_abc1_def2", "a repeated identifier with separators"],
    ["TOKEN_ENDPOINT_URL_FOR_THE_V2_API_NAME", "a longer name alone, with a digit"],
    ["SECRET_KEY", "a name alone"],
    ["secret_key_name_for_the_app_config", "a longer name alone"],
    ["token_endpoint: https://example.com/oauth/token", "a URL after a similar name"],
    ["token_endpoint_auth_method: client_secret_post", "an OAuth setting"],
    ["GITHUB_TOKEN=abc123", "a short value"],
    [`commit ${hex}`, "long hex with no key word"],
    ["token: 3f2a9c1e", "short hex"],
    [`token ${"0".repeat(32)}`, "hex with no variety"],
    [`token ${"a1".repeat(16)}`, "repeated hex"],
    [`token ${"a1b2c3d".repeat(4)}`, "only 7 different characters"],
    [`secret: ${"deadbeef".repeat(4)}`, "hex letters only"],
    [`secret: ${"1234567890".repeat(4)}`, "hex digits only"],
  ])("finds nothing in %j: %s", (text) => {
    expect(findSensitive(text)).toEqual([]);
  });

  it("scans 1 MB lines of the new forms in well under a second", () => {
    const lines = [
      "_TOKEN=".repeat(150_000),
      "_TOKEN: x ".repeat(100_000),
      "DB_PASSWORD ".repeat(90_000),
      `DB_PASSWORD${" ".repeat(1_000_000)}`,
      `GITHUB_TOKEN=${"a".repeat(1_000_000)}`,
    ];
    const start = performance.now();
    for (const line of lines) expect(findSensitive(line)).toEqual([]);
    expect(performance.now() - start).toBeLessThan(1_000);
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
