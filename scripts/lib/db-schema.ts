import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

// The schema of a SQLite database as `db:check` compares it (testing.md §4): one entry for each
// table, index, view and trigger in `sqlite_master`. A table is its clauses (columns and
// constraints) in any order, plus the options after the closing bracket (`STRICT`), so a column
// that a later `ALTER TABLE ... ADD` put at the end makes no difference. Other objects are their
// CREATE text. An identifier counts the same in `x`, "x" or [x], because SQLite writes "x" when it
// renames a column or a table (also in the indexes and foreign keys that name it). Spaces outside
// a string count as one. Not seen: the order of the columns.
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

const CLOSE: Record<string, string> = { "'": "'", '"': '"', "`": "`", "[": "]" };

// One form for each piece of SQL text: identifiers in backticks (as drizzle-kit writes them), the spaces outside a
// 'string' as one space. A doubled '' inside a string closes and opens it again, so it stays.
export function canonical(text: string): string {
  let out = "";
  let quote: string | undefined;
  let space = false;
  for (const char of text) {
    if (quote !== undefined) {
      if (char === CLOSE[quote]) {
        out += quote === "'" ? "'" : "`";
        quote = undefined;
      } else {
        out += char;
      }
    } else if (/\s/.test(char)) {
      space = true;
    } else {
      if (space && out !== "") out += " ";
      space = false;
      if (char in CLOSE) {
        quote = char;
        out += char === "'" ? "'" : "`";
      } else {
        out += char;
      }
    }
  }
  return out;
}

// The clauses between the first "(" and the last ")", cut at each comma that is outside brackets
// and quotes, and the options after the last ")".
export function tableClauses(createSql: string): string[] {
  const open = createSql.indexOf("(");
  const close = createSql.lastIndexOf(")");
  if (open < 0 || close < open) return [canonical(createSql)];
  const body = createSql.slice(open + 1, close);
  const clauses: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const char = body.charAt(i);
    if (quote !== undefined) {
      if (char === CLOSE[quote]) quote = undefined;
    } else if (char in CLOSE) {
      quote = char;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      clauses.push(canonical(body.slice(start, i)));
      start = i + 1;
    }
  }
  clauses.push(canonical(body.slice(start)));
  const options = canonical(createSql.slice(close + 1).replace(/;\s*$/, ""));
  if (options !== "") clauses.push(`table options: ${options}`);
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
      parts: row.type === "table" ? tableClauses(row.sql) : [canonical(row.sql)],
    });
  }
  return schema;
}

export function readSchema(db: DatabaseSync): Map<string, SchemaObject> {
  const rows = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master").all();
  return schemaOf(z.array(MasterRow).parse(rows));
}

// The parts of `a` that `b` does not have, counted: a clause written twice in `a` and once in `b`
// is one difference.
function missingFrom({ a, b }: { a: readonly string[]; b: readonly string[] }): string[] {
  const left = [...b];
  return a.filter((part) => {
    const at = left.indexOf(part);
    if (at < 0) return true;
    left.splice(at, 1);
    return false;
  });
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
      for (const part of missingFrom({ a: built.parts, b: wanted.parts })) {
        lines.push(`${name}: only the migrations have: ${part}`);
      }
      for (const part of missingFrom({ a: wanted.parts, b: built.parts })) {
        lines.push(`${name}: only schema.ts has: ${part}`);
      }
    }
  }
  return lines;
}
