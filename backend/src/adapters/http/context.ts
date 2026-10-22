import type { Logger } from "pino";

/** Per-request values set by the middleware. */
export interface HttpEnv {
  Variables: {
    requestId: string;
    log: Logger;
  };
}
