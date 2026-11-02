// Zod without its `new Function` fast path, before any module runs (security.md §2.1). Zod tests
// whether it may use `new Function` the first time a schema needs it, and that test alone is a
// CSP violation. src/lib/zod-config.ts turns the fast path off too, but an ES module runs after
// the chunks it imports: a chunk that builds a schema at load time (`Settings.keyof()`) ran the
// test first (M2b). Zod reads this global when it loads (zod 4, v4/core/core.js); keep the two in
// step when Zod changes.
globalThis.__zod_globalConfig = Object.assign(globalThis.__zod_globalConfig || {}, {
  jitless: true,
});
