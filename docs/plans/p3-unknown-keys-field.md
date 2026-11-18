# Name a real field when a body has unknown keys (DQ-385)

Brief: the owner's answer of 2026-11-18 (q4 Q4, choice "A"): "Fix it now in a small PR: `field` is the first unknown key; the message names every unknown key ("Unknown fields: nmae, colr."); docs/api.md §1 says so; one test per case (one key, two keys, nested)."
Checkpoint: none beyond the owner's answer (the error shape stays one `field`, so the public API shape does not change; no shared state, module boundary or screen flow)
Approval: plan OK by the chief agent, 2026-11-18, against the owner's answer q4 Q4 A (revision 1); owner review pending

## The cause

Request schemas forbid unknown keys (Zod `.strict()`, `docs/api.md` §1). Zod reports all unknown
keys of one object as one issue: `code: "unrecognized_keys"`, `path` (the object) and `keys` (the
unknown keys). `createRouter()` in `backend/src/adapters/http/router.ts` builds `field` from
`[...issue.path, ...issue.keys]`, so each key becomes one more path part. `fieldPath` joins the
parts with dots. `POST /api/bots` with `{"nmae": "x", "colr": "y", …}` gives `field: "nmae.colr"`.
`docs/api.md` §1 reads `a.b` as the key `b` inside `a`, so the answer names a field that does not
exist. The same happens inside a list item: `pins[0].extra.more`. The message is the text of Zod
(`Unrecognized keys: "nmae", "colr"`), which is English from the library, not the form of the
other messages.

## The fix

One place changes: the `defaultHook` of `createRouter()` (an HTTP adapter; it holds no business
rule). For an `unrecognized_keys` issue:

- `field` is `fieldPath([...issue.path, issue.keys[0]])`: the full path to the first unknown key,
  in the format of `docs/api.md` §1 (`pins[0].extra`, not a joined name).
- The message names every unknown key: `Unknown fields: nmae, colr.` for two or more keys, and
  `Unknown field: nmae.` for one key.

Every other issue keeps its field and its message. `noQueryString()` (a route that is not a Zod
route) is not changed: it already names one key and it is a query check (Not claimed below).

`docs/api.md` §1 gets the rule in the paragraph on unknown fields: `field` is the first unknown
key with its full path, and the message lists every unknown key.

## Choices that the owner's words leave open

1. **One key.** Today the message is `Unrecognized key: "nmae"`. The owner's example form is
   `Unknown fields: nmae, colr.`, which that text does not match. One key gets `Unknown field: nmae.`,
   so both forms read the same.
2. **Nested.** The chief's brief gave `skills.0.extra` as an example; the repository format
   (`docs/api.md` §1, item 32 of the P3 list, DQ-375) writes an index of a list as `[i]`, so the
   path is `pins[0].extra`. The owner's answer only says "nested"; it gives no format.
3. **Query and path.** The hook serves every target of a Zod route (body, query, path). An unknown
   query key on a Zod route gets the same new text. This is not a separate case.

## Test strategy

Level: API tests through the real router (`backend/test/api/bots.test.ts`, `POST /bots`), as the
existing 422 tests there do. Each case asserts `status`, `code`, `field` and `message`.

| Case | Behaviour |
| --- | --- |
| One unknown key | `{…, nmae: 1}`: `field: "nmae"`, message `Unknown field: nmae.` |
| Two unknown keys | `{…, nmae: 1, colr: 2}`: `field: "nmae"` (not `nmae.colr`), message `Unknown fields: nmae, colr.` |
| Nested | a pin with an unknown key: `field: "pins[0].extra"`, message `Unknown field: extra.` |

Beyond these: the existing tests keep passing, which shows that other issues keep their field and
message (`field: "unknown"` at `bots.test.ts:77`, `pins[0].skill_id`, `tool_settings.<key>`, and
`errors-and-limits.test.ts` for the `_test/events` route). The order of keys: `field` is the first key that Zod reports, in the order that JavaScript lists
the keys of the object (integer-like keys first, in ascending order, then the other keys in the
order of the body). The two-key test uses two keys that are not integer-like and asserts the order.
An unknown key that is empty names no field, so the answer has no `field`; a test covers it.

Proof that the tests can fail: run the three new tests on `main` (no fix) and record the red run in
the PR description. The two-key case and the message of each case must fail there; the one-key
`field` already passes on `main`, so its test fails on the message only. No break list: this is not
a late, security or order or race test (owner, 2026-11-09, `docs/testing.md` §5).

## Other files

- `docs/api.md` §1: the rule above.
- `docs/delivery-quality.md`: DQ-385 gets the state `fixed` with this PR (records step).
- `docs/status.md` and `docs/plans/README.md`: the lines of this PR.
- `seed/skills/using-the-app/SKILL.md` (the Guide): it does not describe this error. The PR
  description says "Guide: not changed" with that reason.
- `pnpm gen:api`: the OpenAPI schema has no message text, so no change is expected; the build
  runs the command and says the result.

## Not claimed

- That a body with several unknown keys in different objects names each of them: `field` names
  the first unknown key that Zod reports; the message of that object lists its keys only (one issue
  of Zod at a time, as for every other validation error today).
- That an unknown key is named when the body has another problem: Zod gives one issue at a time,
  and an invalid value that it reports first hides the unknown keys.
- That `noQueryString()` gives the same message as a Zod route (DQ-382 already says so); for one
  query key the two texts now differ too (`Unknown field: foo.` and `Unrecognized key: "foo"`).
- A limit on the length of the message: it names every key as Zod's message did before, and the body
  limit of 1 MB still applies.

## Open questions

None. The choices above are decisions of the builder inside the owner's answer; the PR flags the
message change under `Needs human review`.
