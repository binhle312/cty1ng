import type { z } from "zod";

// Browser storage for per-browser view state (requirements/app-shell.md, "Where the reopen
// state lives"). Every read is parsed with a schema and every access is in try/catch: storage
// can be off, full or edited by hand, and the app must work without it.
export function readStored<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is off or full: the value lasts until the page closes.
  }
}
