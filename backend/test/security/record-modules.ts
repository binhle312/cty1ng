import { appendFileSync } from "node:fs";
import { registerHooks } from "node:module";

// Loaded with `node --import` by startup.test.ts: writes the URL of every module the process
// loads to the file in RECORD_MODULES, one per line, so a test can see what a start loaded.
const file = process.env.RECORD_MODULES;
if (file !== undefined) {
  registerHooks({
    load(url, context, nextLoad) {
      appendFileSync(file, `${url}\n`);
      return nextLoad(url, context);
    },
  });
}
