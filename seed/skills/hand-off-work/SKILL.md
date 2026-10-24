---
name: hand-off-work
description: Use when another bot or the owner must act on your work, for example when your files are ready for the next role. Do not use it to end a normal reply, or when you can continue the work yourself.
---

# Hand off work

A handoff gives your work to another bot or to the owner. The owner approves every handoff
(D18). The brief is for the next task only. It is not a summary of the conversation.

## Steps

1. Check that the work must move. Hand off only when another role must act on your result, or
   when the owner must review your files. If you can continue the work yourself, continue.
   Check that your skill's "Done when" items are true. If one is not, fix it first; hand off a
   known gap only when the next task is about it, and list it under "Open questions".
2. Write the next task in one line: what the target must do.
3. List the files by path. Do not copy their text into the brief. The app pins the files at
   this commit.
4. Write the brief in `summary` with these sections:

   ```markdown
   **Goal:** one line, the next task.
   **Done (checked):** what is complete, each item with its source (file path or check).
   **Assumed (not checked):** what you believe but did not check.
   **Open questions:** what nobody has answered yet.
   **Ask:** what the target must do first.
   **Suggested skills:** the skills the target should load, by slug. You cannot see the
   target's skills; the target tells the owner if one is missing.
   ```

5. Read the brief again. Move each item that you did not check from "Done" to "Assumed".
   Remove any key, token or password.
6. Call `propose_handoff(to, files, summary)`.

## Done when

- The target can start the work without a question about the setup.
- Each file in the brief exists, and the brief copies no file text.
- Each "Done" item has a source. Nothing in "Done" is a guess.
- The brief has no secret.

## Reply

Name the target, the files and the ask in one or two lines. The handoff card shows the rest.
