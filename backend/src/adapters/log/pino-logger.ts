import { pino, type DestinationStream, type Logger, type LevelWithSilent } from "pino";

export type { Logger };

// Pino JSON logs, one line per event (architecture.md §9). JSON keeps newlines escaped, so text
// from a model cannot forge a log line (security.md §2.10).
//
// Secrets (security.md §2.6): Pino's `redact` works on field paths, and a key can also reach a
// message or a child binding. So the final line is redacted by value: every `*_API_KEY` value,
// raw and as it appears inside a JSON string, becomes `[REDACTED]`.
export function createLogger(options: {
  level: LevelWithSilent;
  secrets: readonly string[];
  destination?: DestinationStream;
}): Logger {
  const destination = options.destination ?? pino.destination({ dest: 1, sync: false });
  return pino(
    { level: options.level, base: null, timestamp: pino.stdTimeFunctions.isoTime },
    redactingStream(destination, options.secrets),
  );
}

export function redactingStream(
  destination: DestinationStream,
  secrets: readonly string[],
): DestinationStream {
  const needles = [
    ...new Set(secrets.filter((s) => s !== "").flatMap((s) => [s, JSON.stringify(s).slice(1, -1)])),
  ].sort((a, b) => b.length - a.length);
  if (needles.length === 0) return destination;
  return {
    write(line: string) {
      let out = line;
      for (const needle of needles) out = out.split(needle).join("[REDACTED]");
      destination.write(out);
    },
  };
}
