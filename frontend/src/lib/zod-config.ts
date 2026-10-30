import { config } from "zod";

// Zod speeds up object parsing with `new Function` and first tests whether it may. That test
// alone is a CSP violation (`script-src 'self'` has no 'unsafe-eval', security.md §2.1), so
// the browser app turns the fast path off. Import this module before anything that parses.
config({ jitless: true });
