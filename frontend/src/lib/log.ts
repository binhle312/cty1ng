// The frontend logger (frontend-conventions.md §1, "No console"). Silent in production
// builds. Never pass message text, file contents or keys (security.md §2.10): log ids and
// event names only.
type Fields = Record<string, string | number | boolean | null>;

function write(level: "debug" | "warn" | "error", event: string, fields: Fields): void {
  if (import.meta.env.PROD) return;
  // The one place that may use the console.
  // eslint-disable-next-line no-console
  console[level](event, fields);
}

export const log = {
  debug: (event: string, fields: Fields = {}) => {
    write("debug", event, fields);
  },
  warn: (event: string, fields: Fields = {}) => {
    write("warn", event, fields);
  },
  error: (event: string, fields: Fields = {}) => {
    write("error", event, fields);
  },
};
