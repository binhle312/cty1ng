import pino, { type DestinationStream, type Logger } from "pino";

const REDACTED = "[redacted]";

/**
 * The Pino logger (architecture.md §9). Two layers keep keys out of logs (security.md §2.6):
 * fields that may hold a key are redacted by path, and the value of every `*_API_KEY` variable
 * is replaced inside every string value we log (message, fields, bindings, errors), however
 * short it is. Replacement happens before Pino serialises the record, so Pino's own fields
 * (`level`, `time`, `msg`) and the JSON structure are never touched. Pino writes JSON, so
 * newlines in values are escaped and cannot forge log lines (§2.10).
 */
export function createLogger(input: {
  level: string;
  secretValues: readonly string[];
  destination?: DestinationStream;
}): Logger {
  // Longest first, so a key that contains another key is replaced whole.
  const secrets = [...new Set(input.secretValues.filter((value) => value !== ""))].sort(
    (a, b) => b.length - a.length,
  );
  const scrubText = (text: string): string =>
    secrets.reduce((result, secret) => result.split(secret).join(REDACTED), text);

  /** Copies a value with every string inside it scrubbed. */
  const scrub = (value: unknown, depth = 0): unknown => {
    if (typeof value === "string") return scrubText(value);
    if (value === null || typeof value !== "object" || depth > 8) return value;
    if (value instanceof Error) {
      // A real Error again, so Pino's error serializer keeps its type and shape.
      const copy = new Error(scrubText(value.message));
      copy.name = value.name;
      if (value.stack !== undefined) copy.stack = scrubText(value.stack);
      return copy;
    }
    if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1));
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, scrub(item, depth + 1)]),
    );
  };
  const scrubObject = (value: Record<string, unknown>): Record<string, unknown> => {
    const scrubbed = scrub(value);
    return typeof scrubbed === "object" && scrubbed !== null
      ? Object.fromEntries(Object.entries(scrubbed))
      : {};
  };

  const options: pino.LoggerOptions = {
    level: input.level,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ["*.apiKey", "*.api_key", "*.authorization", "*.*_API_KEY"],
      censor: REDACTED,
    },
    formatters: {
      log: scrubObject,
      bindings: scrubObject,
    },
    hooks: {
      // The message and interpolation arguments are not part of the object `formatters.log`
      // sees. Objects are left to it; an Error logged on its own keeps Pino's shape
      // (`{ err }`, with its message as `msg`).
      logMethod(args, method) {
        const [first, ...rest] = args;
        const scrubbedRest = rest.map((arg) => (typeof arg === "string" ? scrubText(arg) : arg));
        if (first instanceof Error) {
          const message = typeof scrubbedRest[0] === "string" ? [] : [scrubText(first.message)];
          Reflect.apply(method, this, [{ err: scrub(first) }, ...message, ...scrubbedRest]);
          return;
        }
        const scrubbedFirst = typeof first === "string" ? scrubText(first) : first;
        Reflect.apply(method, this, [scrubbedFirst, ...scrubbedRest]);
      },
    },
  };
  return input.destination === undefined ? pino(options) : pino(options, input.destination);
}
