import pino, { type DestinationStream, type Logger } from "pino";

const REDACTED = "[redacted]";

/**
 * The Pino logger (architecture.md §9). Two layers keep keys out of logs (security.md §2.6):
 * fields that may hold a key are redacted by path, and every finished log line has the value
 * of each `*_API_KEY` variable replaced, wherever it appears (messages, objects, errors).
 * Pino writes JSON, so newlines in values are escaped and cannot forge log lines (§2.10).
 */
export function createLogger(input: {
  level: string;
  secretValues: readonly string[];
  destination?: DestinationStream;
}): Logger {
  // Very short values would redact ordinary words; real keys are much longer.
  const secrets = input.secretValues.filter((value) => value.length >= 8);
  const options: pino.LoggerOptions = {
    level: input.level,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ["*.apiKey", "*.api_key", "*.authorization", "*.*_API_KEY"],
      censor: REDACTED,
    },
    hooks: {
      streamWrite: (line) =>
        secrets.reduce((text, secret) => text.split(secret).join(REDACTED), line),
    },
  };
  return input.destination === undefined ? pino(options) : pino(options, input.destination);
}
