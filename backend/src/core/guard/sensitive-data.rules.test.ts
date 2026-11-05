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
    ["password: `abcd`", "the shortest value in backticks: 4 characters"],
    ["password: `abc`def", "text after a short value in backticks"],
    ["password: `false", "a backtick with no close"],
    ["password: `false`!", "text after a literal in backticks"],
    ["password: `$DB_SECRET`!", "text after a reference in backticks"],
    // A free setting does not hide the next key in a compact object.
    ['{"require_password":true,"password":"hunter22"}', "a secret after a free key"],
    ["{requirePassword:true,password:hunter22}", "a secret after a free key"],
    ["password:true,password:hunter22", "a secret after a free key"],
    // The exact text in security.md §2.13 (DQ-048).
    ['{"require_password":true,"password":"xxxx"}', "the 4-character value after a free key"],
    ["password:$DB_SECRET,password:hunter22", "a secret after a reference"],
    ["password:{secret},password:hunter22", "a secret after a reference"],
    ["password: `true`,password:hunter22", "a secret after a literal in backticks"],
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
    [`token-${randomKey}`],
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
    ["GITHUB_TOKEN:=", ""],
    ["GITHUB_TOKEN: =", ""],
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

  // Review of fe63f7f: a value that started with a symbol lost it before the length check. Only
  // `=` is not part of a value.
  describe.each(["_", "-", "+", "/"])("a value that starts with %j", (symbol) => {
    const forms = [
      ["token=", ""],
      ["token: ", ""],
      ["api_key = ", ""],
      ["GITHUB_TOKEN=", ""],
      ['"access_token": "', '"'],
    ];

    it.each(forms)("after %j is free at 23 characters", (before, after) => {
      const text = `${before}${symbol}${lettersAndDigits.slice(0, 22)}${after}`;
      expect(findSensitive(text)).toEqual([]);
    });

    it.each(forms)("after %j is refused at 24 characters", (before, after) => {
      const text = `${before}${symbol}${lettersAndDigits.slice(0, 23)}${after}`;
      expect(findSensitive(text).map((match) => match.kind)).toEqual(["api_key"]);
    });
  });

  it("gives only the last 4 characters of a quoted value, with no quote", () => {
    expect(findSensitive('"password": "my long pass phrase"')).toEqual([
      { kind: "password", line: 1, ending: "rase" },
    ]);
  });

  it("gives only the last 4 characters of the value, not of the next key", () => {
    expect(findSensitive('{"password":hunter22,"a":1}')).toEqual([
      { kind: "password", line: 1, ending: "er22" },
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
    ['{"require_password":true,"password":"x"}', "a value under 4 characters after a free key"],
    ['"password": "a b"', "a quoted value under 4 characters"],
    ["password: `a b`", "a backtick value under 4 characters"],
    // Review of fe63f7f: the backticks counted toward the 4 characters.
    ["password: `ab`", "a backtick value under 4 characters"],
    ["password: `abc`", "a backtick value under 4 characters"],
    ["password: `abc`,", "a backtick value under 4 characters, before a mark"],
    ["password: `a b`x", "a backtick value under 4 characters, before text"],
    ["Use password: `abc`.", "a backtick value under 4 characters, in a sentence"],
    ["password: ``", "an empty backtick value"],
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
    ["Use password: `$DB_SECRET`.", "a reference at the end of a sentence"],
    ["password:=true", "a literal after :="],
    ["password:=`false`", "a literal after :="],
    ["password:={false}", "a reference after :="],
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

  it("scans each 1 MB line of the new forms in well under a second", () => {
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
      `password${"*".repeat(4)}${" ".repeat(1_000_000)}`,
      "password:=".repeat(100_000),
      "password:**".repeat(90_000),
      `password:${" ".repeat(1_000_000)}=`,
      'password:{"type":'.repeat(60_000),
      `password:{"type":"string"${',"a":1'.repeat(160_000)}`,
      `password:{"type":"string"${" ".repeat(1_000_000)}x`,
      "password:string = ".repeat(60_000),
      'password:string = "'.repeat(50_000),
      `password:string${" ".repeat(1_000_000)}x`,
      `password:string =${" ".repeat(1_000_000)}x`,
      `password:string${" | string".repeat(100_000)}`,
      `password:string = "${"a".repeat(1_000_000)}`,
      // With a space, because a value with none runs to the line end, and only the first key is read.
      "password:useState< ".repeat(50_000),
      "password:useState<string>( ".repeat(40_000),
      `password:useState<${"a ".repeat(500_000)}`,
      `password:useState<string>(${"a ".repeat(500_000)}`,
      "password={a}>".repeat(80_000),
      "password={a}/>".repeat(70_000),
      "password=${A}>".repeat(70_000),
      "password=$A>".repeat(80_000),
      "password=${{ a }}>".repeat(55_000),
      "password={".repeat(100_000),
      `password=$${"A".repeat(1_000_000)}`,
      `password={${"a".repeat(1_000_000)}`,
      "password=string)=>".repeat(55_000),
      `password=${"string|".repeat(150_000)}`,
      `pwd=/${"a".repeat(1_000_000)}!`,
      `pwd=/${".".repeat(1_000_000)}!`,
      `pwd=$(${"a".repeat(1_000_000)}!`,
      `pwd=$(a)${"a".repeat(1_000_000)}!`,
      `pwd=/a${")".repeat(1_000_000)}!`,
    ];
    // One limit per line, because a shared limit fails on a busy machine. A quadratic pattern
    // takes many seconds on one of these lines.
    for (const line of lines) {
      const start = performance.now();
      findSensitive(line);
      expect(performance.now() - start).toBeLessThan(1_000);
    }
  });
});

// Review of 1b70296 (DQ-049): a number or an environment after the name worked on one spelling only.
describe("findSensitive: a suffix after the key word", () => {
  const hex = "0123456789abcdef".repeat(2);

  it.each([
    ["DB_PASS_PROD=hunter22"],
    ["DB_PASS1=hunter22"],
    ["DB_PWD_2=hunter22"],
    ["PWD1=hunter22"],
    ["DB_PASSWD_STAGING=hunter22"],
    ["OLD_PWD_OLD=hunter22"],
    ["DB_PASSWORD_QA=hunter22"],
    ["DB_PASSWORD_UAT=hunter22"],
    ["DB_PASSWORD_STG=hunter22"],
    ["DB_PASSWORD_PRD=hunter22"],
    ["DB_PASSWORD_LOCAL=hunter22"],
    ["DB_PASSWORD_DEVELOPMENT=hunter22"],
    ["DB_PASS_UAT=hunter22"],
    ["PWD_QA=hunter22"],
    // Owner, 2026-11-05: false matches of the same kind as `ALL_TESTS_PASS: done`.
    ["password_local: disabled"],
    ["TEST_PASS_QA: done"],
  ])("refuses %j as a password", (text) => {
    expect(findSensitive(text).map((match) => match.kind)).toEqual(["password"]);
  });

  it.each([
    [`API_KEY_PROD=${hex}`],
    [`GITHUB_TOKEN_PROD=${hex}`],
    [`TOKEN1=${hex}`],
    [`SECRET1=${hex}`],
    [`SECRET_KEY_STAGING=${hex}`],
    [`ACCESS_KEY2=${hex}`],
    [`GITHUB_TOKEN_UAT=${hex}`],
    [`API_KEY_QA=${hex}`],
    [`SECRET_KEY_LOCAL=${hex}`],
  ])("refuses %j as an API key", (text) => {
    expect(findSensitive(text).map((match) => match.kind)).toEqual(["api_key"]);
  });

  it.each([
    ["DB_PASSWORD_FILE=/run/secrets/db"],
    ["token_endpoint: https://example.com/oauth/token"],
    ["PWD=/home/owner"],
    ["PWD1=/home/owner"],
    [`TOKEN_PROD_HASH=${hex}`],
    [`token2vec=${hex}`],
    ["DB_PASS_FILE=/run/secrets/db"],
    ["DB_PWD_FILE=/run/secrets/db"],
    // A word that is not an environment stays free, so a normal setting does not block a save.
    ["DB_PASSWORD_ROOT=hunter22"],
    ["password_strength: strong"],
    ["password_manager: bitwarden"],
  ])("finds nothing in %j", (text) => {
    expect(findSensitive(text)).toEqual([]);
  });
});

// Review of 1b70296 (DQ-050): the regex retried a shorter separator, so `=`, `>` or `*` counted as a
// part of the value, and a short value passed the 4-character minimum.
describe("findSensitive: the separator is not a part of the value", () => {
  it.each([
    ["password:=abc"],
    ["password=>abc"],
    ['password:="abc"'],
    ["password:='abc'"],
    ["password:**abc"],
    ["**password:**abc"],
    ["DB_PASS:=abc"],
    ["pwd:=abc"],
    ["pwd=>abc"],
    ["password:=true"],
    ["password=>true"],
    ["password:={false}"],
  ])("finds nothing in %j", (text) => {
    expect(findSensitive(text)).toEqual([]);
  });

  it.each([
    ["password:=abcd", "abcd"],
    ["password=>abcd", "abcd"],
    ['password:="abcd"', "abcd"],
    ['password:="true"', "true"],
    ["password:**abcd", "abcd"],
    ["password: =abc", "=abc"],
    ["password==abc", "=abc"],
  ])("refuses %j and reads the value %j", (text, ending) => {
    expect(findSensitive(text)).toEqual([{ kind: "password", line: 1, ending }]);
  });
});

// Review of 1b70296 (DQ-047): code with no secret that the wider key forms began to refuse.
describe("findSensitive: code with no secret after a password key", () => {
  it.each([
    ['"password": {"type": "string"}', "a JSON schema"],
    ['"password":{"type":"string"}', "a compact JSON schema"],
    ['{"properties":{"password":{"type":"string"}}}', "a schema inside a schema"],
    ['"password": {"type": "string", "minLength": 8},', "a schema with another key"],
    ["password: {type: string}", "a schema with no quotes"],
    ['"password": {"type": "string", "format": "password"},', "a schema with a format"],
    ["password: {type: String, required: true}", "a Mongoose schema"],
    ['"password": {"type": "string",', "a schema that goes on to the next line"],
    ['const [password, setPassword] = useState("")', "React state with an empty string"],
    ["const [password, setPassword] = useState('')", "React state with an empty string"],
    ["const [password, setPassword] = useState(``)", "React state with an empty string"],
    ["const [password, setPassword] = useState()", "React state with no argument"],
    ["const [password, setPassword] = useState();", "React state at the end of a statement"],
    ['const [password, setPassword] = useState<string>("");', "React state with a type"],
    ['const [password, setPassword] = React.useState("")', "React state with its namespace"],
    ["const [password, setPassword] = useState(null)", "React state with null"],
    ["const [password, setPassword] = useState(undefined)", "React state with undefined"],
    ["const [password, setPassword] = useState<string | null>(null)", "React state with a union"],
    ["const [password, setPassword] = useState<string|null>(null);", "React state with a union"],
    [
      "const [password, setPassword] = useState<string | undefined>(undefined)",
      "React state with a union",
    ],
    ['const [password, setPassword] = useState<string | null>("")', "React state with a union"],
    ["const [password, setPassword] = React.useState<string | null>(null);", "React state"],
  ])("finds nothing in %j: %s", (text) => {
    expect(findSensitive(text)).toEqual([]);
  });

  it.each([
    ['"password":{"value":"hunter22"}', "an object that holds the value"],
    ['"password": {"value": "hunter22"}', "an object that holds the value"],
    ['"password": {"type": "hunter22"}', "a type that is not a type name"],
    ['"password":{"type":"hunter22"}', "a type that is not a type name"],
    ['"password":{"type":"string","default":"hunter22"}', "a schema that holds a default"],
    ['"password": {"type": "string", "default": "hunter22"}', "a schema that holds a default"],
    ['"password":{"type":"string","password":"hunter22"}', "a schema that holds the key again"],
    ['"password": {"type": "string", "format": "a b"}', "a format with a space is not a format"],
    ["password: {type: hunter22", "a schema with no close and no type name"],
    ["const [password, setPassword] = useState(hunter22)", "React state with a word"],
    ['const [password, setPassword] = useState("")hunter22', "text after the call"],
    ['"password": ["hunter22"]', "a list that holds the value"],
    ['const [password, setPassword] = useState("hunter22")', "React state with a value"],
    ["const [password, setPassword] = useState(`hunter22`)", "React state with a value"],
    ['config["password"] = "hunter22"', "an index with a string"],
    ['{"password":{"type":"string"},"password2":"hunter22"}', "a secret after a free schema"],
    ['"password":{"type":"string"},"password":"hunter22"', "a secret after a free schema"],
    // Owner, 2026-11-05: false matches that stay, listed in security.md §2.13.
    ["confirmPassword: z.string().min(8),", "a false match that stays"],
    ["hashedPassword = await bcrypt.hash(password, 10)", "a false match that stays"],
    ["resetPassword: async (email) => {", "a false match that stays"],
    ["newPassword: string|undefined", "a false match that stays"],
    ["ALL_TESTS_PASS: done", "a false match that stays"],
  ])("refuses %j: %s", (text) => {
    expect(findSensitive(text).map((match) => match.kind)).toEqual(["password"]);
  });
});

// Review of 9a4cca4 (DQ-052, DQ-053): a free rule had a place that took any text, so a secret in
// that place went free. Each refused row puts a secret in one place of one free form, and each free
// row is the same form with no secret. A new free form adds its rows here.
describe("findSensitive: a secret in each place of a free form", () => {
  it.each([
    ["password: {type:string,default:1234}", "a number in default"],
    ["password: {type:string,value:1234}", "a number in value"],
    ["password: {type: string, default: 1234}", "a number in default"],
    ["password: {type: string, value: 1234}", "a number in value"],
    ['"password": {"type":"string","default":1234}', "a number in default"],
    ['"password": {"type": "string", "value": 1234}', "a number in value"],
    ['"password": {"type":"string","secret":99887766}', "a member that is not on the list"],
    ['"password": {"type":"string","pin":123456}', "a member that is not on the list"],
    ['"password": {"type":"string","password":1234}', "the key again, with a number"],
    ['"password": {"type":"string","example":true}', "a literal in a member not on the list"],
    ['"password": {"type":"string","minLength":"hunter22"}', "a string in a number member"],
    ['"password": {"type":"string","minLength":true}', "a literal in a number member"],
    ['"password": {"type":"string","nullable":1234}', "a number in a literal member"],
    ['"password": {"type":"string","required":"hunter22"}', "a string in a literal member"],
    ['"password": {"type":"string","format":"hunter22"}', "a word in format"],
    ['"password": {"type":"string","format":1234}', "a number in format"],
    ['"password": {"type":"string","minLength":8,"default":1234}', "a value after a free member"],
    ['"password": {"type":"hunter22","minLength":8}', "a word in type"],
    ['"password": {"type":"string","minimum":8}', "a safe member that is not on the list"],
  ])("refuses the schema %j: %s", (text) => {
    expect(findSensitive(text).map((match) => match.kind)).toEqual(["password"]);
  });

  it.each([
    ['"password": {"type":"string","maxLength":64,"minLength":8}'],
    ['"password": {"type":"string","nullable":true}'],
    ['"password": {"type":"string","required":false}'],
    ['"password": {"type":"string","readOnly":false}'],
    ['"password": {"type":"string","writeOnly":true}'],
    ['"password": {"type":"string","format":"password"}'],
    ["password: {type: String, minlength: 8, required: true}"],
  ])("finds nothing in the schema %j", (text) => {
    expect(findSensitive(text)).toEqual([]);
  });

  it.each([
    ['const password: string = "hunter22";', "er22"],
    ['const dbPassword: string = "hunter22";', "er22"],
    ["let password: String = 'hunter22'", "er22"],
    ["password: string = `hunter22`", "er22"],
    ['val password: String = "hunter22"', "er22"],
    ['function login(password: string = "hunter22") {}', "er22"],
    ['const password: string | null = "hunter22";', "er22"],
    ['const password: string|null = "hunter22";', "er22"],
    ["password: varchar = 'hunter22'", "er22"],
    ['password: str = "hunter22"', "er22"],
    ['password: any = "hunter22"', "er22"],
    ['password: string = "my long phrase"', "rase"],
    ['password: string = "hunter22', "er22"],
    ['password: boolean = "true"', "true"],
    ['password: string = "false"', "alse"],
    ['password: string="hunter22"', "er22"],
    ['DB_PASSWORD: string = "hunter22"', "er22"],
    ['password := string = "hunter22"', "er22"],
  ])("refuses the typed assignment %j and reads the value that ends in %j", (text, ending) => {
    expect(findSensitive(text)).toEqual([{ kind: "password", line: 1, ending }]);
  });

  it.each([
    ['const password: string = "";'],
    ["const password: string = '';"],
    ["const password: string = ``;"],
    ["const password: string = process.env.DB_PASSWORD;"],
    ["const password: string = getPassword();"],
    ["const password: string = await readSecret();"],
    ["const password: string | null = null;"],
    ["password: boolean = true"],
    ['password: string = "abc"'],
    ['password: str = "abc"'],
    ['password: string = "${DB_PASSWORD}"'],
    ["password: string = `${DB_PASSWORD}`"],
    ['password: string == "hunter22"'],
    ['password: string => "hunter22"'],
  ])("finds nothing in the typed assignment %j", (text) => {
    expect(findSensitive(text)).toEqual([]);
  });

  it.each([
    ['const [password, setPassword] = useState<string | null>("hunter22")', "a value in a union"],
    ["const [password, setPassword] = useState<string | null>(hunter22)", "a word in a union"],
    ["const [password, setPassword] = useState<hunter22>()", "a word in the type"],
    ["const [password, setPassword] = useState<string | hunter22>(null)", "a word in the union"],
    ['const [password, setPassword] = useState<string | null>("my pass phrase")', "a phrase"],
    ["const [password, setPassword] = useState(nullable)", "a word that starts with null"],
    ["const [password, setPassword] = useState<Password>()", "a type that is not on the list"],
    ['const [password, setPassword] = useSignal("")', "another hook"],
    ["const [password, setPassword] = useState<string | null>(null)hunter22", "text after it"],
  ])("refuses React state %j: %s", (text) => {
    expect(findSensitive(text).map((match) => match.kind)).toEqual(["password"]);
  });

  // Owner, 2026-11-05: the guard cannot tell this text from a sentence, and a false match blocks a
  // save with no override. The cost is that the first two rows hold a real secret, and they go free.
  it.each([
    ["password: true hunter22"],
    ["password: null  // real one is hunter22"],
    ["Set password: `false` in the file"],
    ["password: true  # only in prod"],
    ["require_password: true  # only in prod"],
    ["password: string in the request body"],
    ["password: text field on the login form"],
    ["password: null until the user signs in"],
  ])("finds nothing in the text after a free word: %j", (text) => {
    expect(findSensitive(text)).toEqual([]);
  });
});

// Review of fb5c975 (DQ-058, DQ-059): the rules for a reference and a type took any text after `>` or
// `)=>`, and the path rule took any text after the start of a path. So a later key in that text was
// not read. A free rule now ends at the free text, and the reader stops there. A new free form or a
// new way to join text adds its rows here.
describe("findSensitive: a free form does not hide a later key", () => {
  const FREE_FORMS = [
    "true",
    "false",
    "null",
    "string",
    "string|null",
    "varchar(255)",
    "`string`",
    "`null`",
    "{a}",
    "{a.b}",
    "{false}",
    "${A}",
    "$A",
    "${{secrets.X}}",
    '"${A}"',
    "useState()",
    'useState("")',
    "useState<string>()",
    "React.useState(null)",
    "`ab`",
    "{type:string}",
    '{"type":"string","minLength":8}',
    "/x",
    "~/x",
    "../x",
    "$(pwd)",
  ];
  const JOINS = [
    "",
    ">",
    "/>",
    ")=>",
    ")=>{",
    "))=>(",
    "}>",
    "}>{",
    ";",
    ",",
    ")",
    "}",
    "]",
    "{",
    "({",
    "(",
    "</A>",
    "|",
    "&",
    "?",
    "!",
    "#",
    "%",
    "+",
    "*",
    "\\",
    '"',
    "'",
    "`",
    "\t",
    " ",
  ];

  it.each(["password", "pwd", "DB_PASS"])("reads the later %s key in each form", (key) => {
    const missed: string[] = [];
    for (const separator of ["=", ":", ": "]) {
      for (const form of FREE_FORMS) {
        for (const join of JOINS) {
          for (const later of [`${key}=hunter22`, `${key}:"hunter22"`]) {
            const text = `${key}${separator}${form}${join}${later}`;
            if (findSensitive(text).length === 0) missed.push(text);
          }
        }
      }
    }
    expect(missed).toEqual([]);
  });

  it.each([
    ['<A password={safe}>{config.password="hunter22"}</A>', "a JSX tag, then an assignment"],
    ["<A password={safe} />password: hunter22", "a JSX tag with a space"],
    ["password={a}>password=hunter22", "the tag end"],
    ["password={a}/>password=hunter22", "the tag end with a slash"],
    ["password=${A}>password=hunter22", "a reference in braces"],
    ["password=$A>password=hunter22", "a reference in capitals"],
    ['const f = (password: string)=>({password:"hunter22"})', "an arrow, then an object"],
    ['(password: string)=>{db_password="hunter22"}', "an arrow, then an assignment"],
    ["password:`string`)=>password=hunter22", "a type in backticks and an arrow"],
    ["password: string)=hunter22", "half of an arrow"],
    ["password={a}=>hunter22", "an arrow after a reference is not a tag end"],
    ["pwd=/x;pwd=hunter22", "a path, then the same key"],
    ["pwd=/x>pwd=hunter22", "a path, then the same key"],
    ["pwd:~/x,pwd=hunter22", "a home path, then the same key"],
    ["pwd=$(x)pwd=hunter22", "a command, then the same key"],
    ['pwd=../x{pwd="hunter22"}', "a relative path, then the same key"],
    // Owner, 2026-11-05, the cost of closing these rules. A false match blocks these safe forms.
    ["password={a})>x", "a closer before the tag end"],
    ["password={a},>x", "a comma before the tag end"],
    ['password={a}">x', "a quote before the tag end"],
    ["(password:`string`)=>x", "a type in backticks before an arrow"],
    ["pwd=/a:/b", "a colon in a path"],
    ["pwd=/a/b?x=1", "a query in a path"],
    ["pwd=/a=b", "an equal sign in a path"],
    ["pwd=/a/(b)", "brackets in a path"],
    ["pwd=/a/b#c", "a hash in a path"],
    ["pwd=/home/owner/>", "a tag end after a path"],
    ["password=`{a}`/>", "a reference in backticks before a tag end"],
    ['password="{a}/>', "a reference after an open quote before a tag end"],
    ['pwd="/home/owner,a:1', "an open quote, a path and the next key"],
  ])("refuses %j: %s", (text) => {
    expect(findSensitive(text).map((match) => match.kind)).toEqual(["password"]);
  });

  // A value after one spelling of the key does not hide another spelling. Each spelling scans alone,
  // and the text is not a path, so each spelling reports one match.
  it.each([["pwd='/home/owner,password:hunter22"], ["pwd=/home/owner;password=hunter22"]])(
    "reads each spelling in %j",
    (text) => {
      expect(findSensitive(text).map((match) => match.kind)).toEqual(["password", "password"]);
    },
  );

  it.each([
    ["<A password={safe}>Text</A>", "text after the tag end"],
    // No key comes before the word, as in `<A password={safe} >hunter22</A>`.
    ["<A password={safe}>hunter22</A>", "a word after the tag end"],
    ["<Input password={value} />", "a tag end after a space"],
    ["<Input password={value}/>", "a tag end"],
    ["<A password={a}>{b}</A>", "a reference after the tag end"],
    ["<A password={a.b}>x=1</A>", "other code after the tag end"],
    ["password=${A}>x", "a reference in braces"],
    ["password=$A>x", "a reference in capitals"],
    ['password="${A}">x', "a reference in quotes"],
    ["(password: string)=>login(password)", "the key as an argument after an arrow"],
    ["(password:string)=>{return 1}", "a block after an arrow"],
    ["(password:string|null)=>x", "a union before an arrow"],
    ["pwd=/home/owner", "a path"],
    ["pwd=~/work", "a home path"],
    ["pwd=../work", "a relative path"],
    ["pwd=$(pwd)", "a command"],
    ["pwd=$(pwd)/sub", "a command and a path"],
    ["pwd=$(git rev-parse)", "a command with a space"],
    ['pwd="$(cat /x)"', "a command in quotes"],
    ['pwd="/Program Files/x"', "a space in quotes"],
    ['"PWD=`/home/owner`",', "a path in a string in code"],
    ["pwd=/a/b,", "a comma after a path"],
    ["pwd=/a/b;", "a semicolon after a path"],
    ["Use pwd=/a/b.", "a path at the end of a sentence"],
    ["pwd=/a/b:", "a colon after a path"],
    ["(PWD=/home/owner).", "a dot after a closer"],
    ["pwd=`$(pwd)`).", "a dot after a closer"],
    // The cost of the rule: the code cannot tell a secret from a path.
    ["pwd=/hunter22", "a secret that looks like a path"],
  ])("finds nothing in %j: %s", (text) => {
    expect(findSensitive(text)).toEqual([]);
  });
});

// Review of 1b70296 (DQ-046): the word rule took any run of letters as a word, so it freed random
// keys that `main` refuses. Seeded, so each run reads the same values.
describe("findSensitive: random values next to a key word", () => {
  const LOWER = "abcdefghijklmnopqrstuvwxyz";
  const UPPER = LOWER.toUpperCase();
  const DIGITS = "0123456789";
  const SAMPLES = 20_000;

  // mulberry32: small, and the same on every machine.
  const seededRandom = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };

  const randomValues = (alphabet: string, length: number): string[] => {
    const next = seededRandom(length * 1_000 + alphabet.length);
    return Array.from({ length: SAMPLES }, () =>
      Array.from({ length }, () => alphabet[Math.floor(next() * alphabet.length)]).join(""),
    );
  };

  const refused = (value: string): boolean => findSensitive(`API_KEY=${value}`).length > 0;

  // The check for a long value on `main` (05367cd): three kinds of character and few repeats.
  const refusedOnMain = (value: string): boolean => {
    const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[_\-+/=]/].filter((re) => re.test(value)).length;
    return kinds >= 3 && new Set(value).size >= Math.min(16, value.length / 2);
  };

  it.each([
    { name: "base62", length: 24, alphabet: LOWER + UPPER + DIGITS, limit: 0.01 },
    { name: "base64", length: 24, alphabet: `${LOWER}${UPPER}${DIGITS}+/`, limit: 0.01 },
    { name: "base62", length: 40, alphabet: LOWER + UPPER + DIGITS, limit: 0.001 },
    { name: "base64", length: 40, alphabet: `${LOWER}${UPPER}${DIGITS}+/`, limit: 0.001 },
  ])("$name of $length: few values that main refuses go free", ({ length, alphabet, limit }) => {
    const values = randomValues(alphabet, length);
    const onMain = values.filter((value) => refusedOnMain(value));
    const escaped = onMain.filter((value) => !refused(value));
    expect(escaped.length / onMain.length).toBeLessThanOrEqual(limit);
  });

  it.each([
    { name: "lowercase letters and digits", length: 24, alphabet: LOWER + DIGITS, least: 0.9 },
    { name: "base32 in capitals", length: 24, alphabet: `${UPPER}234567`, least: 0.85 },
  ])("$name of $length: most values are refused", ({ length, alphabet, least }) => {
    const caught = randomValues(alphabet, length).filter((value) => refused(value));
    expect(caught.length / SAMPLES).toBeGreaterThanOrEqual(least);
  });

  it("refuses a random value with no words in it", () => {
    expect(findSensitive(`API_KEY=${["Jip5KFddmCqe", "UMZKOGArb1Fv"].join("")}`)).toEqual([
      { kind: "api_key", line: 1, ending: "b1Fv" },
    ]);
  });

  // Owner, 2026-11-05: a value made of words is a name, and this is the disclosed cost.
  it.each([
    "api_key = Correct_Horse_Battery_Staple_22",
    "JWT_SECRET=your_jwt_secret_key_goes_here_123",
    "cancellationToken: CancellationTokenSource2Factory",
    // Mutations that no test caught at 60de8c3 (DQ-051): `y` is a vowel, and `-` is a separator.
    "SECRET_KEY: syncCryptRhythmLynxPsychGym2",
    "JWT_SECRET=your-jwt-secret-key-goes-here-123",
  ])("finds nothing in the words of %j", (text) => {
    expect(findSensitive(text)).toEqual([]);
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
