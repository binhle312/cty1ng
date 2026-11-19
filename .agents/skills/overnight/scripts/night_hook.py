#!/usr/bin/env python3
"""A PreToolUse hook for the Bash tool: while a night is open, a guarded command runs only if it is an open intent.

Setup (the owner adds it to the project settings; the skill never changes settings): see references/hook.md.
The hook reads the hook input (JSON) on stdin. It looks for an open night (a `go` and no `close`) in the folder
of `--nights` and in each folder in it. With no open night, it allows each command.

While a night is open, a command is guarded if it has the first words of a card row command (for example
`gh pr merge`), the words `git` and `push`, `git` and `tag`, `gh` and `merge`, `gh` and `release`, or a `gh api`
call that writes, anywhere in the command (also in `bash -c "..."`). A guarded
command must have no shell syntax and must equal the command of an open intent of that night, word for word.
Else the hook exits 2: Claude Code blocks the command and shows the reason. If a journal cannot be read, the
hook blocks each guarded command and allows the others.

Exit codes: 0 = allow, 2 = block (the reason is on stderr).
"""

import argparse
import json
import os
import re
import shlex
import sys

sys.dont_write_bytecode = True  # no __pycache__ in the skill folder
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `-I` drops the script folder
try:
    from night_format import JOURNAL, Refused
    from night_rules import fold, shell_words
    from night_files import Lock, read_journal
except ImportError as error:  # a copy of the hook without the modules of night.py
    print(f"night hook: cannot import the modules of night.py ({error}); copy the whole scripts folder",
          file=sys.stderr)
    sys.exit(2)

ALWAYS = (("git", "push"), ("git", "tag"), ("gh", "merge"), ("gh", "release"))
GH_API_WRITES = {"-f", "-F", "--field", "--raw-field", "--input"}


def night_folders(root):
    """The folders under `root` (and `root` itself) that have a journal."""
    found = [root] if os.path.isfile(os.path.join(root, JOURNAL)) else []
    try:
        names = sorted(os.listdir(root))
    except OSError:
        return found
    return found + [os.path.join(root, n) for n in names if os.path.isfile(os.path.join(root, n, JOURNAL))]


def open_nights(root):
    """(folder, night) for each night with a go and no close. A journal that cannot be read raises Refused."""
    nights = []
    for folder in night_folders(root):
        with Lock(folder):
            entries = read_journal(folder) or []
        night = fold(entries)
        if night.go and not night.close:
            nights.append((folder, night))
    return nights


def loose_words(command):
    """The words of any shell text, also inside quotes and `bash -c "..."`: for the guard test only."""
    return re.findall(r"[A-Za-z0-9_.:/@%+=-]+", command)


def has_all(words, needed):
    """Each needed word is a word of the command, in any order: `git -C dir push` is guarded too. This also
    guards some harmless commands, such as `git tag -l`; the safe side is to block them while a night is open."""
    return set(needed) <= set(words)


def row_prefix(command):
    """The first words of a row command, up to the first flag, slot or number: `gh pr merge` of `gh pr merge 1 ...`."""
    prefix = []
    for word in command.split():
        if not re.fullmatch(r"[a-z][a-z-]*", word):
            break
        prefix.append(word)
    return tuple(prefix)


def guarded(command, nights):
    words = loose_words(command)
    if any(has_all(words, needed) for needed in ALWAYS):
        return True
    if "gh" in words and "api" in words:
        method = [w for a, w in zip(words, words[1:]) if a in ("-X", "--method")]
        if GH_API_WRITES & set(words) or any(m.upper() != "GET" for m in method) or any(
                w.startswith("--method=") and w.split("=", 1)[1].upper() != "GET" for w in words):
            return True
    for _, night in nights:
        for _kind, row_command, _source in night.items.values():
            prefix = row_prefix(row_command or "")
            if len(prefix) >= 2 and has_all(words, prefix):
                return True
    return False


def decide(command, root):
    """None to allow, or the reason to block."""
    if not os.path.isdir(root):
        missing = f"the nights folder {root} does not exist: fix --nights in the hook settings"
        return missing if guarded(command, []) else None
    try:
        nights = open_nights(root)
    except Refused as refusal:
        if guarded(command, []):
            return f"a night journal cannot be read ({refusal.code}): no guarded command until it is repaired"
        return None
    if not nights or not guarded(command, nights):
        return None
    words, problem = shell_words(command, slots=False)
    if problem:
        return f"a guarded command has shell syntax ({problem[1]}); run the exact command of the open intent"
    intents = [(night.run, entry) for _, night in nights for entry in night.open_intents()]
    for _, entry in intents:
        try:
            if shlex.split(entry["command"]) == words:
                return None
        except ValueError:
            continue
    runs = ", ".join(sorted({night.run for _, night in nights}))
    if not intents:
        return f"night {runs} is open and has no open intent: log the intent with night.py first"
    wanted = "; ".join(f"`{entry['command']}`" for _, entry in intents)
    return f"night {runs} is open: a guarded command must equal an open intent, word for word ({wanted})"


def main(argv=None):
    parser = argparse.ArgumentParser(description="PreToolUse hook: guard commands while a night is open")
    parser.add_argument("--nights", required=True, help="the folder of the nights (or of one night)")
    args = parser.parse_args(argv)
    try:
        data = json.load(sys.stdin)
        command = data["tool_input"]["command"] if data.get("tool_name") == "Bash" else None
    except (ValueError, KeyError, TypeError):
        print("night hook: the hook input is not the input of a Bash tool call", file=sys.stderr)
        return 2
    if not isinstance(command, str):
        return 0
    reason = decide(command, args.nights)
    if reason:
        print(f"night hook: {reason}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
