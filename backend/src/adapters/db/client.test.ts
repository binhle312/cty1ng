import fs, { linkSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tempDir } from "../../../test/helpers.ts";
import { openReader, openWriter, WriterAlreadyOpenError } from "./client.ts";

// The writer guard (M1c, architecture.md §11): one writer per database file in one thread.

let dir: ReturnType<typeof tempDir>;
let file: string;
const opened: Database.Database[] = [];
const open = (path: string) => {
  const sqlite = openWriter(path);
  opened.push(sqlite);
  return sqlite;
};
beforeEach(() => {
  dir = tempDir("client");
  file = join(dir.path, "app.db");
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const sqlite of opened.splice(0)) sqlite.close();
  dir.remove();
});

describe("openWriter", () => {
  it("refuses a second writer for the same path", () => {
    open(file);
    expect(() => openWriter(file)).toThrow(WriterAlreadyOpenError);
  });

  it("refuses a second writer through a symlink, a hard link or a relative path with ..", () => {
    open(file);
    const symlink = join(dir.path, "symlink.db");
    symlinkSync(file, symlink);
    const hardLink = join(dir.path, "hard-link.db");
    linkSync(file, hardLink);
    mkdirSync(join(dir.path, "sub"));
    const dotDot = `${relative(process.cwd(), dir.path)}/sub/../app.db`;
    for (const path of [symlink, hardLink, dotDot]) {
      expect(() => openWriter(path), path).toThrow(WriterAlreadyOpenError);
    }
  });

  it("opens a new writer after the first one closes", () => {
    openWriter(file).close();
    expect(open(file).open).toBe(true);
  });

  it("opens a writer for another file, and readers, while a writer is open", () => {
    const writer = open(file);
    writer.exec("CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1)");
    expect(open(join(dir.path, "other.db")).open).toBe(true);
    const readers = [openReader(file), openReader(file)];
    for (const reader of readers) {
      expect(reader.prepare("SELECT x FROM t").all()).toEqual([{ x: 1 }]);
      reader.close();
    }
  });

  it("leaves the file free when the open fails (a file that is not a database)", () => {
    writeFileSync(file, "not a database, only text ".repeat(10));
    expect(() => openWriter(file)).toThrow(/file is not a database/);
    // The same file (same inode), now empty, which SQLite opens as a new database.
    writeFileSync(file, "");
    expect(open(file).open).toBe(true);
  });

  it("keeps a newer writer's file when an older writer is closed a second time", () => {
    const a = openWriter(file);
    a.close();
    open(file); // b
    a.close(); // a no-op for SQLite
    expect(() => openWriter(file)).toThrow(WriterAlreadyOpenError);
  });

  it("keeps the file while close() fails, and frees it after a clean close", () => {
    const writer = openWriter(file);
    writer.exec("CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1), (2)");
    const rows = writer.prepare("SELECT x FROM t").iterate();
    rows.next();
    expect(() => writer.close()).toThrow(/busy executing a query/);
    expect(writer.open).toBe(true);
    expect(() => openWriter(file)).toThrow(WriterAlreadyOpenError);
    rows.return?.();
    writer.close();
    expect(open(file).open).toBe(true);
  });

  it.each([":memory:", ""])("refuses %j, which has no file", (path) => {
    expect(() => openWriter(path)).toThrow(/openWriter needs a database file/);
  });

  it("closes the connection and registers nothing when the file identity cannot be read", () => {
    vi.spyOn(fs, "statSync").mockImplementationOnce(() => {
      throw new Error("ENOENT: no such file or directory");
    });
    const close = vi.spyOn(Database.prototype, "close");
    expect(() => openWriter(file)).toThrow(/ENOENT/);
    expect(close).toHaveBeenCalledTimes(1);
    expect(open(file).open).toBe(true);
  });
});
