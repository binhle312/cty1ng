# guard

The sensitive data guard (D39, `docs/security.md` §2.9): finds secrets and personal data in
text before the app saves it.

| File | What it is for |
| --- | --- |
| `sensitive-data.rules.ts` | `findSensitive(text)` and `firstSensitive(text)` (stops at the first match): private keys, passwords, API keys, card numbers (Luhn), IBANs, passport numbers |
| `sensitive-data.rules.test.ts` | One test per detector, and text that must pass |

Start here: `sensitive-data.rules.ts`. Do not: log or return the text a detector found; return
only its kind and line.
