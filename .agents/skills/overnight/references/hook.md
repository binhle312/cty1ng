# The command hook

The hook is optional. It checks each Bash command before Claude Code runs it. While a night is open, a guarded command runs only if it is equal to an open intent of that night, word for word. Without the hook, night.py checks only the command in the journal, not the command that runs.

The skill never changes a settings file. Only the owner adds the hook to the settings.

Do not add the hook yet. A review found these problems, and they are not fixed:

- The hook blocks the `night.py log intent` call for a guarded command, because that call has the guarded words. With the hook, the agent cannot log the intent in the same session.
- The hook reads the raw text of the command, not the words that the shell and the tool read. A quote or a backslash inside a word (`gi''t push`), an attached option (`-XPUT`, `--field=x`), an alias option (`git -c alias.p=push p`), a variable or a path gets past the guard.
- The hook trusts an intent that night.py refuses (a journal with faults). It allows an open intent after a hold, a deny or the stop time. It mixes the intents of all open nights under `--nights`, and it finds nights only in `--nights` and one level below.
- If a journal cannot be read, the hook keeps only the fixed word sets, and a read error can end the hook with exit 1, which does not block.

## 1. Setup (the owner)

1. Find two absolute paths: the skill folder (`<skill>`), and the folder of the nights (`<nights>`). `<nights>` is the folder that holds the night folders, or one night folder.
2. Add these lines to the project settings (`.claude/settings.json`). If the file has a `hooks` key, add only the `PreToolUse` entry.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "python3 -I <skill>/scripts/night_hook.py --nights <nights>" }
        ]
      }
    ]
  }
}
```

3. Do the check of section 3 before the first night with the hook.

If the settings have no hook, the read-back says "no command hook".

## 2. What the hook does

- With no open night (no `go`, or a `close`), it allows each command.
- While a night is open, a command is guarded if it has one of these word sets, in any order, also inside `bash -c "..."`:
  - the first words of a card row command, for example `gh pr merge` or `gh run rerun`;
  - `git` and `push`, `git` and `tag`, `gh` and `merge`, `gh` and `release`;
  - `gh` and `api` with a write: `-X` or `--method` with a method that is not `GET`, or `-f`, `-F`, `--field`, `--raw-field`, `--input`.
- A guarded command must have no shell syntax and must be equal to the command of an open intent. Else the hook blocks it, and Claude Code shows the reason.
- The guard also blocks some harmless commands, for example `git tag -l`. That is the safe side.
- If a journal cannot be read, or the `--nights` folder does not exist, the hook blocks each command that has a fixed word set (the second and third items above). It does not block the commands that only a card row guards.
- If a module of night.py is not next to the hook, the hook blocks each command. Copy the whole `scripts` folder.

## 3. Check it (before the first night with the hook)

Do this in a test folder, with a fake `gh` first on `PATH` that writes its arguments to a file and does nothing else.

1. Start a test night (`night.py new`, a card with the row `PR 1 | commit | gh pr merge 1 -R example/none --squash --match-head-commit {head}`, then `go`).
2. In a session with the hook, ask Claude to run `gh pr merge 999 -R example/none --squash --match-head-commit <a 40-character sha>`. The hook must block it, and the fake `gh` must write nothing.
3. Log the intent `gh pr merge 1 -R example/none --squash --match-head-commit <sha>`, and ask Claude to run that command. The fake `gh` must write one line.
4. Without the hook, ask for the command of step 2. The fake `gh` must write one line. This shows that the hook made the block.

Record the date, the version of the skill folder and the result in the project, as for the rehearsal.

## 4. Not claimed

- A command in a script file, a profile function or an alias that replaces `gh` or `git`.
- A tool that is not the Bash tool, for example a GitHub tool of an MCP server.
- An action that has none of the guarded word sets.
- The folder where the command runs. A `git` row has no repository in its words, so the same words in another folder act on another repository. A `gh` row names `-R owner/repo`.
- An environment value that an earlier command of the session set.
- A shell option that changes how words expand, for example `EXTENDED_GLOB` in zsh, where `^name` is a pattern.
- The problems at the top of this file.
