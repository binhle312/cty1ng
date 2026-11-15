import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { readSchema, schemaDifferences, tableClauses } from "./db-schema.ts";

// The compare of `db:check` (testing.md §4): what the migrations build against what schema.ts
// builds. Each case runs real SQL in a database in memory.
function built(statements: readonly string[]) {
  const db = new DatabaseSync(":memory:");
  for (const statement of statements) db.exec(statement);
  const schema = readSchema(db);
  db.close();
  return schema;
}

function differences(migrations: readonly string[], schema: readonly string[]): string[] {
  return schemaDifferences({ migrations: built(migrations), schema: built(schema) });
}

const BOTS =
  "CREATE TABLE `bots` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`style` text DEFAULT 'a, b' NOT NULL,\n\t`deleted_at` text,\n\tCONSTRAINT \"style\" CHECK(\"bots\".\"style\" IN ('a, b', 'c'))\n);";

describe("tableClauses", () => {
  it("cuts only at the commas outside brackets and quotes", () => {
    expect(tableClauses(BOTS)).toEqual([
      "CONSTRAINT `style` CHECK(`bots`.`style` IN ('a, b', 'c'))",
      "`deleted_at` text",
      "`id` text PRIMARY KEY NOT NULL",
      "`style` text DEFAULT 'a, b' NOT NULL",
    ]);
  });
});

describe("the same schema", () => {
  it("in the same text", () => {
    expect(differences([BOTS], [BOTS])).toEqual([]);
  });

  it("with a column that ALTER TABLE added at the end", () => {
    const without = BOTS.replace("\t`deleted_at` text,\n", "");
    expect(differences([without, "ALTER TABLE `bots` ADD `deleted_at` text;"], [BOTS])).toEqual([]);
  });

  it("after a table was made again under another name and renamed", () => {
    // A CHECK that names its table cannot be made under another name, so this table has none.
    const plain = BOTS.replace(/,\n\tCONSTRAINT[^\n]*/, "");
    const renamed = plain.replace("CREATE TABLE `bots`", "CREATE TABLE `__new_bots`");
    expect(differences([renamed, "ALTER TABLE `__new_bots` RENAME TO `bots`;"], [plain])).toEqual(
      [],
    );
  });

  it("with other spaces and line breaks", () => {
    expect(differences([BOTS.replace(/\n\t/g, " ")], [BOTS])).toEqual([]);
  });
});

// Review round 1 of #120 (R1-1): drizzle-kit writes RENAME COLUMN and RENAME TO, and SQLite then
// stores the new names with other quotes, also in the indexes and the foreign keys of other tables.
describe("the same schema after a rename that drizzle-kit writes", () => {
  it("of a column", () => {
    const old = BOTS.replace("`deleted_at` text", "`gone_at` text");
    expect(
      differences([old, 'ALTER TABLE `bots` RENAME COLUMN "gone_at" TO "deleted_at";'], [BOTS]),
    ).toEqual([]);
  });

  it("of a table that an index and a foreign key name", () => {
    const parent = (name: string) => `CREATE TABLE \`${name}\` (\`id\` text PRIMARY KEY NOT NULL);`;
    const child = "CREATE TABLE `child` (`id` text, FOREIGN KEY (`id`) REFERENCES `parent`(`id`));";
    const index = (name: string) => `CREATE INDEX \`parent_id\` ON \`${name}\` (\`id\`);`;
    expect(
      differences(
        [
          parent("old_parent"),
          child.replace("`parent`", "`old_parent`"),
          index("old_parent"),
          "ALTER TABLE `old_parent` RENAME TO `parent`;",
        ],
        [parent("parent"), child, index("parent")],
      ),
    ).toEqual([]);
  });
});

describe("a hand edit", () => {
  it("of a NOT NULL", () => {
    expect(
      differences([BOTS.replace("`deleted_at` text", "`deleted_at` text NOT NULL")], [BOTS]),
    ).toEqual([
      "bots: only the migrations have: `deleted_at` text NOT NULL",
      "bots: only schema.ts has: `deleted_at` text",
    ]);
  });

  it("of a CHECK", () => {
    const edited = BOTS.replace("'a, b', 'c')", "'a, b', 'c', 'd')");
    expect(differences([edited], [BOTS])).toHaveLength(2);
  });

  it("of the columns of an index", () => {
    const index = "CREATE UNIQUE INDEX `bots_style` ON `bots` (`style`);";
    expect(
      differences([BOTS, index.replace("(`style`)", "(`style`,`id`)")], [BOTS, index]),
    ).toEqual([
      "bots_style: only the migrations have: CREATE UNIQUE INDEX `bots_style` ON `bots` (`style`,`id`)",
      "bots_style: only schema.ts has: CREATE UNIQUE INDEX `bots_style` ON `bots` (`style`)",
    ]);
  });

  it("of the WHERE of a partial index", () => {
    const index =
      'CREATE UNIQUE INDEX `bots_kept` ON `bots` (`style`) WHERE "bots"."deleted_at" IS NULL;';
    expect(
      differences([BOTS, index.replace("IS NULL", "IS NOT NULL")], [BOTS, index]),
    ).toHaveLength(2);
  });

  it("that leaves out an object", () => {
    const index = "CREATE INDEX `bots_style` ON `bots` (`style`);";
    expect(differences([BOTS], [BOTS, index])).toEqual([
      "bots_style: schema.ts has it, the migrations do not make it",
    ]);
  });

  it("that adds an object", () => {
    expect(differences([BOTS, "CREATE TABLE `extra` (`x` text);"], [BOTS])).toEqual([
      "extra: the migrations make it, schema.ts does not have it",
    ]);
  });
  // Review round 1 of #120 (R1-2): the text after the columns, and a clause written twice.
  it("that adds STRICT", () => {
    expect(differences([BOTS.replace(/\);$/, ") STRICT;")], [BOTS])).toEqual([
      "bots: only the migrations have: table options: STRICT",
    ]);
  });

  it("that writes a CHECK twice", () => {
    const twice = BOTS.replace(
      /(CONSTRAINT[^\n]*)\n/,
      '$1,\n\tCONSTRAINT "style2" CHECK("bots"."style" IN (\'a, b\', \'c\'))\n',
    );
    const doubled = twice.replace('"style2"', '"style"');
    expect(differences([doubled], [BOTS])).toHaveLength(1);
  });
});
