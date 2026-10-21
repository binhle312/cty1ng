# D39. Sensitive-data guard before anything reaches a model or memory

Status: proposed (2026-10-21). The owner asked that bots never read sensitive data.
Decision: A pattern-based check runs on everything the owner sends toward a model and on every
memory write. It looks for:

- passwords in `password: …` or `pwd=…` form;
- API keys and tokens (common provider prefixes such as `sk-`, `AKIA`, `ghp_`, `xox`, plus
  long high-entropy strings next to words like "key", "token" or "secret");
- private key blocks (`-----BEGIN … PRIVATE KEY-----`);
- card numbers (13–19 digits that pass the Luhn check);
- IBANs;
- passport-number patterns when the word "passport" is near.

How it acts:

- **Composer:** before Send, matches are listed masked ("API key ending …9f2a") with Remove
  and "Send anyway". The server runs the same check and refuses a message with matches unless
  the request carries `confirm_sensitive: true`, which the client sets only after the owner
  chooses "Send anyway". The refusal is 422 `sensitive_data`.
- **Text attachments** are checked at upload, with the same choice. Images and PDFs are not
  scanned; the composer says so when one is attached.
- **Memory writes** (D38) with a match are refused with no override. The bot is told why.
- Matches are never logged; the log records only the kinds found.

Why: Anything sent to a model provider leaves the machine. Most leaks are pasted by accident,
and a warning at the moment of sending catches them.
Limits, stated plainly: patterns catch common formats, not every secret, and may flag harmless
text. That is why it is a warning with a deliberate override, not a promise.
Rejected:
- **Sending the text to a model to classify it:** that sends the secret out to check it.
- **Silent masking:** the bot would get a mangled message and the owner would not know.
Implemented in: `../requirements/conversation.md` (UI-3.22, UI-3.23), `../security.md` §2.13,
task M3 (text), M6 (attachments).
