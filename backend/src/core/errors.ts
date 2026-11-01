import type { ErrorCode } from "@cty1ng/shared/errors";

// A refusal that a service decides (api.md §1 codes). The HTTP adapter turns it into the one
// error shape; the CLI prints its message. Services never import the HTTP layer.
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly field: string | undefined;
  // The current state, for a stale write whose page needs it (api.md §4).
  readonly current: unknown;

  constructor(code: ErrorCode, message: string, field?: string, current?: unknown) {
    super(message);
    this.code = code;
    this.field = field;
    this.current = current;
  }
}
