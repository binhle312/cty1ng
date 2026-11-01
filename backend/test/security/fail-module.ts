import { registerHooks } from "node:module";

// Loaded with `node --import` by startup.test.ts: the module whose URL ends with FAIL_MODULE
// fails to load, as a native package built for another platform does.
const target = process.env.FAIL_MODULE;
if (target !== undefined) {
  registerHooks({
    load(url, context, nextLoad) {
      if (url.endsWith(target)) throw new Error("simulated load failure");
      return nextLoad(url, context);
    },
  });
}
