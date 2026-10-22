import pino, { type DestinationStream, type Logger } from "pino";
import { createRedactor, REDACTED } from "./redact";

/**
 * The Pino logger (architecture.md §9). Two layers keep keys out of logs (security.md §2.6):
 * fields that may hold a key are redacted by path, and everything logged (fields, bindings,
 * the message, interpolation arguments, errors) is first turned into plain data with the value
 * of every `*_API_KEY` variable replaced (`redact.ts`). That happens before Pino serialises the
 * record, so Pino's own fields (`level`, `time`, `msg`) and the JSON structure are never
 * touched. Pino writes JSON, so newlines in values cannot forge log lines (§2.10).
 */
export function createLogger(input: {
  level: string;
  secretValues: readonly string[];
  destination?: DestinationStream;
}): Logger {
  const { scrubText, toLoggable } = createRedactor(input.secretValues);
  const asObject = (value: Record<string, unknown>): Record<string, unknown> => {
    const loggable = toLoggable(value);
    return typeof loggable === "object" && loggable !== null && !Array.isArray(loggable)
      ? loggable
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
    // Errors are already plain data in our shape (`redact.ts`); Pino's serializer would
    // rebuild them and lose the type.
    serializers: { err: (value: unknown) => value },
    formatters: { log: asObject, bindings: asObject },
    hooks: {
      // The message and interpolation arguments (`%j`, `%o`, …) are not part of the object
      // `formatters.log` sees, so they are converted here, before Pino formats the message.
      // An Error logged on its own keeps Pino's shape: `{ err }`, its message as `msg`.
      logMethod(args, method) {
        const [first, ...rest] = args;
        const loggableRest = rest.map((arg) => toLoggable(arg));
        if (first instanceof Error) {
          const message = typeof rest[0] === "string" ? [] : [scrubText(first.message)];
          Reflect.apply(method, this, [{ err: toLoggable(first) }, ...message, ...loggableRest]);
          return;
        }
        const loggableFirst = typeof first === "string" ? scrubText(first) : first;
        Reflect.apply(method, this, [loggableFirst, ...loggableRest]);
      },
    },
  };
  return input.destination === undefined ? pino(options) : pino(options, input.destination);
}
