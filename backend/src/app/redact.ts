/**
 * Turns anything a caller logs into plain JSON data with secrets replaced (security.md §2.6).
 *
 * The logger runs every logged value through `toLoggable` before Pino sees it, so nothing
 * Pino serialises later can carry a secret: strings (values and property names) are
 * scrubbed, `toJSON()` is called once here and its result scrubbed, and errors keep their
 * diagnostic fields (`code`, `status`, `cause`, …), redacted. A value that cannot be shown
 * safely is replaced by a marker instead of being passed through.
 */

export const REDACTED = "[redacted]";

export const MARKERS = {
  /** Nested deeper than MAX_DEPTH. */
  truncated: "[truncated]",
  /** Refers back to an object that contains it. */
  circular: "[circular]",
  /** A function or symbol. */
  unsupported: "[unsupported]",
  /** Reading it threw (a getter, `toJSON()`). */
  unreadable: "[unreadable]",
} as const;

const MAX_DEPTH = 10;

export type Loggable = string | number | boolean | null | Loggable[] | { [key: string]: Loggable };

export interface Redactor {
  scrubText: (text: string) => string;
  toLoggable: (value: unknown) => Loggable;
}

export function createRedactor(secretValues: readonly string[]): Redactor {
  // Longest first, so a key that contains another key is replaced whole.
  const secrets = [...new Set(secretValues.filter((value) => value !== ""))].sort(
    (a, b) => b.length - a.length,
  );
  const scrubText = (text: string): string =>
    secrets.reduce((result, secret) => result.split(secret).join(REDACTED), text);

  /** `undefined` means "leave the property out", as JSON.stringify does. */
  function convert(value: unknown, depth: number, ancestors: Set<object>): Loggable | undefined {
    switch (typeof value) {
      case "string":
        return scrubText(value);
      case "number":
        return Number.isFinite(value) ? value : String(value);
      case "boolean":
        return value;
      case "bigint":
        return scrubText(value.toString());
      case "undefined":
        return undefined;
      case "function":
      case "symbol":
        return MARKERS.unsupported;
      case "object":
        break;
    }
    if (value === null) return null;
    // Only ancestors count as a cycle, so an object shared by two fields is shown twice.
    if (ancestors.has(value)) return MARKERS.circular;
    if (depth >= MAX_DEPTH) return MARKERS.truncated;
    ancestors.add(value);
    try {
      return convertObject(value, depth + 1, ancestors);
    } catch {
      return MARKERS.unreadable;
    } finally {
      ancestors.delete(value);
    }
  }

  function convertObject(value: object, depth: number, ancestors: Set<object>): Loggable {
    const item = (inner: unknown): Loggable => convert(inner, depth, ancestors) ?? null;
    if (value instanceof Error) return convertError(value, depth, ancestors);
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
    }
    if (value instanceof Map)
      return [...value.entries()].map(([key, inner]) => [item(key), item(inner)]);
    if (value instanceof Set) return [...value].map(item);
    if (Array.isArray(value)) return value.map(item);
    if ("toJSON" in value && typeof value.toJSON === "function") {
      // Called once, here; its result is scrubbed like any other value.
      const json: unknown = Reflect.apply(value.toJSON, value, []);
      return item(json);
    }
    return fields(value, Object.keys(value), depth, ancestors);
  }

  /** Copies the named own properties, scrubbing keys; one unreadable property stays local. */
  function fields(
    value: object,
    keys: readonly string[],
    depth: number,
    ancestors: Set<object>,
  ): { [key: string]: Loggable } {
    const out: { [key: string]: Loggable } = {};
    for (const key of keys) {
      let converted: Loggable | undefined;
      try {
        converted = convert(Reflect.get(value, key), depth, ancestors);
      } catch {
        converted = MARKERS.unreadable;
      }
      if (converted !== undefined) out[scrubText(key)] = converted;
    }
    return out;
  }

  /** Pino's error shape (`type`, `message`, `stack`) plus custom fields, `cause` and `errors`. */
  function convertError(error: Error, depth: number, ancestors: Set<object>): Loggable {
    const custom = Object.keys(error).filter(
      (key) => !["name", "message", "stack", "cause", "errors"].includes(key),
    );
    const out: { [key: string]: Loggable } = {
      type: scrubText(error.name),
      message: scrubText(error.message),
      ...(typeof error.stack === "string" ? { stack: scrubText(error.stack) } : {}),
      ...fields(error, custom, depth, ancestors),
    };
    if ("cause" in error && error.cause !== undefined) {
      out.cause = convert(error.cause, depth, ancestors) ?? null;
    }
    if (error instanceof AggregateError) {
      const errors: unknown = error.errors;
      out.errors = convert(errors, depth, ancestors) ?? null;
    }
    return out;
  }

  return {
    scrubText,
    toLoggable: (value) => convert(value, 0, new Set()) ?? null,
  };
}
