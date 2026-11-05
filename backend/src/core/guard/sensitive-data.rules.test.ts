import { describe, expect, it } from "vitest";
import { findSensitive, firstSensitive, ibanValid, luhn } from "./sensitive-data.rules.ts";

// Built at run time (testing.md §3, "Fake secrets").
const FAKE_KEY = ["sk", "proj", "abcdefghijklmnop1234"].join("-");

describe("findSensitive (D39)", () => {
  it.each([
    ["password: hunter22", "password"],
    ["db pwd=S3cret!x", "password"],
    [`key ${FAKE_KEY}`, "api_key"],
    [["AKIA", "IOSFODNN7EXAMPLE"].join(""), "api_key"],
    [`token ghp_${"a1B2".repeat(9)}`, "api_key"],
    [`slack ${["xoxb", "1234567890", "abcdef"].join("-")}`, "api_key"],
    [`api_key = ${["Zx81", "kQ2pL9vT3mN7bR4wY6cH0sD5fG"].join("_")}`, "api_key"],
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
    const [match] = findSensitive(
      `# Steps\n\nkey ${["sk", "proj", "abcdefghijklmnop9f2a"].join("-")}`,
    );
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
    // Review of this PR: forms that escaped (DQ-033).
    ["dbPwd=hunter22", "a camelCase prefix on the short spelling"],
    ["userPwd: hunter22", "a camelCase prefix on the short spelling"],
    ["MYSQLPWD=hunter22", "a prefix with no separator"],
    ["DB_PASS=hunter22", "a shorter name in capitals"],
    ["SMTP_PASS: hunter22", "a shorter name in capitals"],
    ["PASSWORD1=hunter22", "a number after the name"],
    ["DB_PASSWORD_2=hunter22", "a number after the name"],
    ["DB_PASSWORD_PROD=hunter22", "an environment after the name"],
    ['config["password"] = "hunter22"', "an index with a string"],
    ['os.environ["DB_PASSWORD"]="hunter22"', "an index with a string"],
    ["`DB_PASSWORD`: hunter22", "Markdown code around the name"],
    ["**password**: hunter22", "Markdown bold around the name"],
    ["**password:** hunter22", "Markdown bold around the name and the colon"],
    ['password := "hunter22"', "the := separator"],
    ['password => "hunter22"', "the => separator"],
    ['DB_PASSWORD="my long pass phrase"', "a phrase in double quotes"],
    ['"password": "my long pass phrase"', "a JSON phrase"],
    ["password: 'my long pass phrase'", "a phrase in single quotes"],
    ['password: "a b c d e f g h"', "a phrase of short words"],
    ['password: "abc def"', "a short phrase"],
    ['password: "a bc"', "the shortest phrase: 4 characters"],
    // Review of 1e1cf76: the exception took an opening backtick with no closing one. A backtick
    // phrase is a value, as a quoted phrase is.
    ["password: `false alarm`", "a backtick phrase that starts with a literal"],
    ["password: `null value`", "a backtick phrase that starts with a literal"],
    ["password: `string theory`", "a backtick phrase that starts with a type"],
    ["password: `my pass phrase`", "a backtick phrase"],
    ["password: `a bc`", "the shortest backtick phrase: 4 characters"],
    ["password: `false", "a backtick with no close"],
    // Punctuation after a literal frees it only in the shape of a setting.
    ["password: false/>", "the JSX end needs braces"],
    ["password: true>", "the JSX end needs braces"],
    ["password={true}disabled", "text after the braces"],
    ['password: true,"hunter22"', "a comma with no next key"],
    ["password: false,hunter22", "a comma with no next key"],
    ["password: true)=", "a bracket with no arrow"],
    ["password: string|hunter22", "a union with a word that is not a type"],
    ["password: $HUNTER!22", "more text after a reference"],
    ["password: {hunter}22", "more text after a reference"],
    ["password: /hunter22", "the path rule is only for pwd"],
    ["DB_PASSWORD=../hunter22", "the path rule is only for pwd"],
    ["DB_PASS=/hunter22", "the path rule is only for pwd"],
    ['"password": "ab\\"cdefgh"', "a JSON string with an escaped quote"],
    ['{\\"password\\": \\"hunter22\\"}', "JSON inside a JSON string"],
    ["password: it's-a-long-secret", "a value with a quote inside it"],
    ['password: "unclosed value', "a quote with no close"],
    // Owner, 2026-11-05: the password check does not use the rule for values made of words.
    ["DB_PASSWORD=correct_horse_battery", "a password made of words"],
    // A reference is free only in its exact form.
    ["password: $ecret123", "a dollar sign that is not a reference in capitals"],
    ["DB_PASSWORD=${DB_PASSWORD:-hunter22}", "a reference with a default value"],
    ["password: string!", "a string that starts with a type name"],
    ['"password": "string"', "a quoted type name is a string"],
    ["PWD=hunter22", "the short spelling, with no path"],
    // Owner, 2026-11-05: placeholders get no exception, and a label looks the same.
    ['{"email": "Email", "password": "Password"}', "a label"],
    ['"password": 1234', "a number"],
    ["password: <your password>", "a placeholder"],
    ["reset_password: click the link in the mail", "a word as the value"],
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
    // Review of this PR: forms that escaped (DQ-033).
    [`TOKEN_VALUE=${hex}`],
    [`GITHUB_TOKEN_1=${hex}`],
    [`clientSecretValue=${hex}`],
    [`secret: 0x${hex}`],
    ["client_secret: AbCdEfGhIjKlMnOpQrStUvWxYz"],
    // Review of this PR: code symbols before the value do not free a real key. Main refuses these.
    [`token("${randomKey}")`],
    [`token (${randomKey})`],
    [`token.value = "${randomKey}"`],
    [`config.token.value = ${randomKey}`],
    [`https://example.com/token/${randomKey}`],
    [`token={"${randomKey}"}`],
    [`secret.key = ${randomKey}`],
    [`{token}${randomKey}`],
    // A word between the key word and the value stays allowed.
    [`the api key is ${randomKey}`],
    [`token${" ".repeat(20)}${hex}`],
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

  it("gives only the last 4 characters of a quoted value, with no quote", () => {
    expect(findSensitive('"password": "my long pass phrase"')).toEqual([
      { kind: "password", line: 1, ending: "rase" },
    ]);
  });

  it("gives only the last 4 characters of a backtick phrase, with no backtick", () => {
    expect(findSensitive("password: `my pass phrase`")).toEqual([
      { kind: "password", line: 1, ending: "rase" },
    ]);
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
    ['"password": "abc"', "a quoted value under 4 characters"],
    ['"password": "a b"', "a quoted value under 4 characters"],
    ["password: `a b`", "a backtick value under 4 characters"],
    ["password: abc", "a value under 4 characters"],
    // Owner, 2026-11-05, change 1: a reference holds no secret.
    ["POSTGRES_PASSWORD=${DB_PASSWORD}", "a reference"],
    ["POSTGRES_PASSWORD=$DB_PASSWORD", "a reference in capitals"],
    ['POSTGRES_PASSWORD="${DB_PASSWORD}"', "a quoted reference"],
    ['password: "${{ secrets.DB_PASSWORD }}"', "a quoted CI reference"],
    ["confirmPassword={confirmPassword}", "a JSX reference"],
    ["GITHUB_TOKEN: ${{ secrets.PERSONAL_ACCESS_TOKEN_V2 }}", "a CI reference"],
    ["GITHUB_TOKEN=$PERSONAL_ACCESS_TOKEN_2026", "a reference in capitals"],
    // Owner, 2026-11-05, change 2: a type name with no quotes.
    ["newPassword: string", "a type"],
    ["password: string;", "a type in code"],
    ["hasPassword: boolean", "a type"],
    ["hashed_password: string", "a type"],
    ["user_password: varchar(255),", "a column type"],
    // Owner, 2026-11-05, change 3: a shell path after pwd only.
    // Review of 1e1cf76: code with no space after the literal.
    ['{"require_password":true,"enabled":false}', "a JSON literal before the next key"],
    ['{"password":null,"a":1}', "a JSON null before the next key"],
    ['{"password":null,"a-b":1}', "a next key with a hyphen"],
    ["newPassword:string,other?:string", "a type before an optional key"],
    ['{"a":{"password":null},"b":1}', "a closing brace before the next key"],
    ["{requirePassword:true,enabled:false}", "a JS literal before the next key"],
    ["<Input showPassword={false}/>", "the JSX end"],
    ["<Input showPassword={false}>", "the JSX end"],
    ["requirePassword={true}/>", "the JSX end"],
    ["<A confirmPassword={confirmPassword}/>", "a JSX reference and the tag end"],
    ["<Label hasPassword={false}>Text</Label>", "text after the tag end"],
    ["const f = (newPassword: string)=>void", "a type before an arrow"],
    ["newPassword: string|null", "a union of types"],
    ["newPassword: `string|null`", "a union of types in Markdown code"],
    ["password: `false`", "a complete literal in Markdown code"],
    ["Set password: `false` in the file.", "a complete literal in a sentence"],
    ["DB_PASS=TRUE", "a literal in capitals after the shorter name"],
    ["DB_PASS=true", "a literal after the shorter name"],
    ["PWD=/home/owner", "the shell variable"],
    ["DB_PWD=${DB_SECRET}", "a reference after pwd"],
    ["password: `$DB_SECRET`", "a reference in Markdown code"],
    ["PWD=`/home/owner`", "a path in Markdown code"],
    ["DB_PASS=${DB_SECRET}", "a reference after a shorter name"],
    ["test_pass: done", "the shorter name is only in capitals"],
    ["OLD_PWD=/home/owner", "a path"],
    ["NEW_PWD=$(pwd)", "a command"],
    ['"PWD": "/Users/owner"', "a JSON path"],
    ["DIR=~/work PWD=../work", "a relative path"],
    ['docker run -v "$PWD":/app node', "a Docker volume"],
    // Owner, 2026-11-05, change 4: a value made of words, next to a key word.
    ["GITHUB_TOKEN=user_profile_settings_page_2", "words with a digit"],
    ["csrf_token: generated_by_the_server_1", "words with a digit"],
    ["cancellationToken: CancellationTokenSource2Factory", "a type name with a digit"],
    ["SECRET_KEY: Base64EncodedStringOfLength32Bytes", "a type name with digits"],
    ["token: kubernetes1dashboardadminuser", "two long words and a digit"],
    ["JWT_SECRET=your_jwt_secret_key_goes_here_123", "words in an example"],
    ["SECRET_KEY=generate_with_openssl_rand_hex_32", "words in an example"],
    ["mistoken for the-long-hyphen-word-with-Number1", "a sentence"],
    // Code symbols between the key word and the value.
    ["refreshToken(params: OAuth2RefreshTokenRequestParams1x)", "a function"],
    ["function getAccessToken(config: OAuth2ClientConfiguration): string", "a function"],
    ['import { createToken } from "@/features/auth2/useCreateAccessToken"', "an import"],
    ["src/auth/accessToken/handlers/refreshAccessToken2.ts", "a path"],
    ["src/auth/access_token/RefreshAccessTokenFlow_v2/index.ts", "a path"],
    [`uses: actions/create-github-app-token@${hex}`, "a pinned action"],
    [`the secret rotation commit ${hex}`, "a commit hash"],
    [`secret.txt sha256 ${hex}`, "a file hash"],
    [`token${" ".repeat(21)}${hex}`, "a value too far from the key word"],
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
      "B_PASS ".repeat(150_000),
      "token ".repeat(170_000),
      "`*`*`*`*".repeat(130_000),
      `password:"${"a".repeat(1_000_000)}`,
      `password:'${"\\a".repeat(500_000)}`,
      `password:"${"\\a".repeat(500_000)}`,
      `password:\`${"a".repeat(1_000_000)}`,
      "password:`a ".repeat(90_000),
      `password:true${",".repeat(1_000_000)}`,
      `password:true,${" ".repeat(1_000_000)}`,
      "password:true,".repeat(70_000),
    ];
    const start = performance.now();
    for (const line of lines) findSensitive(line);
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
