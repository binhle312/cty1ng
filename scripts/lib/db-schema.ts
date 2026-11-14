import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

// The schema of a SQLite database as `db:check` compares it (testing.md §4): one entry for each
// table, index, view and trigger in `sqlite_master`. A table is the set of the clauses of its
// CREATE TABLE text (columns and constraints), so a column that a later `ALTER TABLE ... ADD`
// put at the end, or the quotes that a rename writes, make no difference. Other objects are
// their CREATE text. Spaces count as one.
const MasterRow = z.object({
  type: z.string(),
  name: z.string(),
  tbl_name: z.string(),
  sql: z.string().nullable(),
});
type MasterRow = z.infer<typeof MasterRow>;

export interface SchemaObject {
  type: string;
  table: string;
  parts: string[];
}

function oneSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// The text between the first "(" and the last ")", cut at each comma that is outside brackets
// and quotes.
export function tableClauses(createSql: string): string[] {
  const open = createSql.indexOf("(");
  const close = createSql.lastIndexOf(")");
  if (open < 0 || close < open) return [oneSpace(createSql)];
  const body = createSql.slice(open + 1, close);
  const clauses: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const char = body.charAt(i);
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
    } else if (char === "'" || char === '"' || char === "`") {
      quote = char;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      clauses.push(oneSpace(body.slice(start, i)));
      start = i + 1;
    }
  }
  clauses.push(oneSpace(body.slice(start)));
  return clauses.filter((clause) => clause !== "").sort();
}

export function schemaOf(rows: readonly MasterRow[]): Map<string, SchemaObject> {
  const schema = new Map<string, SchemaObject>();
  for (const row of rows) {
    // SQLite's own objects (sqlite_sequence, the automatic indexes of UNIQUE and PRIMARY KEY)
    // follow from the CREATE TABLE text that is compared already.
    if (row.name.startsWith("sqlite_") || row.sql === null) continue;
    schema.set(row.name, {
      type: row.type,
      table: row.tbl_name,
      parts: row.type === "table" ? tableClauses(row.sql) : [oneSpace(row.sql)],
    });
  }
  return schema;
}

export function readSchema(db: DatabaseSync): Map<string, SchemaObject> {
  const rows = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master").all();
  return schemaOf(z.array(MasterRow).parse(rows));
}

// One line for each difference; an empty list when the two schemas are the same.
export function schemaDifferences(options: {
  migrations: Map<string, SchemaObject>;
  schema: Map<string, SchemaObject>;
}): string[] {
  const { migrations, schema } = options;
  const lines: string[] = [];
  const names = [...new Set([...migrations.keys(), ...schema.keys()])].sort();
  for (const name of names) {
    const built = migrations.get(name);
    const wanted = schema.get(name);
    if (built === undefined) {
      lines.push(`${name}: schema.ts has it, the migrations do not make it`);
    } else if (wanted === undefined) {
      lines.push(`${name}: the migrations make it, schema.ts does not have it`);
    } else if (built.type !== wanted.type || built.table !== wanted.table) {
      lines.push(
        `${name}: a ${built.type} of ${built.table} in the migrations, a ${wanted.type} of ${wanted.table} in schema.ts`,
      );
    } else {
      for (const part of built.parts.filter((p) => !wanted.parts.includes(p))) {
        lines.push(`${name}: only the migrations have: ${part}`);
      }
      for (const part of wanted.parts.filter((p) => !built.parts.includes(p))) {
        lines.push(`${name}: only schema.ts has: ${part}`);
      }
    }
  }
  return lines;
}
