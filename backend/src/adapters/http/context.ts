import type { Logger } from "pino";

// Values every handler can read from the Hono context.
export interface HttpEnv {
  Variables: {
    requestId: string;
    log: Logger;
  };
}
