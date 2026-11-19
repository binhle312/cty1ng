#!/usr/bin/env python3
"""Helpers of the tests of night.py. Run the tests: `python3 -I run_tests.py -v` in this folder.

`python3 -I run_tests.py --show-red` runs `night.py check` on each broken journal, prints the
output, and exits 1 if a broken journal does not fail with its code.
NIGHT_PY replaces the script under test (for a run against a changed copy).
Each refusal has a code (`REFUSED [CODE]`), and each test asserts the code. Each refusal of a
write command in test mode also prints the event it refused; `refused()` writes that event into
a copy of the journal and asserts that `check` names the same code on the same event (parity).
"""

import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
import time
import types
import unittest

sys.dont_write_bytecode = True


HERE = os.path.dirname(os.path.abspath(__file__))


NIGHT = os.environ.get("NIGHT_PY", os.path.join(HERE, "night.py"))
# night.py and the modules that it imports; a test copy of night.py needs all of them in its folder.
NIGHT_MODULES = ("night_format", "night_rules", "night_report", "night_files")


T0 = "2026-01-10T22:00:00+00:00"


SHA = "0123456789abcdef0123456789abcdef01234567"


SHA2 = "fedcba9876543210fedcba9876543210fedcba98"


OPT = "--match-head-commit"


# Each commit or no-commit row holds the exact command; {head} is the typed slot of the full head.
ROW_COMMANDS = {
    "PR 1": f"gh pr merge 1 -R org/app --squash {OPT} {{head}}",
    "PR 2": f"gh pr merge 2 -R org/app --squash {OPT} {{head}}",
    "PR 3": f"gh pr merge 3 -R org/app --squash {OPT} {{head}}",
    "PR 12": f"gh pr merge 12 -R org/app --squash {OPT} {{head}}",
    "org/one#3": f"gh pr merge 3 -R org/one --squash {OPT} {{head}}",
    "org/two#3": f"gh pr merge 3 -R org/two --squash {OPT} {{head}}",
    "notice": "gh issue comment 7 -R org/app --body-file note.md",
}
ITEMS = [(name, "no-commit" if name == "notice" else "commit", command) for name, command in ROW_COMMANDS.items()]
ITEMS += [("PR 4", "owner")]


WRITE_COMMANDS = {"new", "go", "log", "report", "close", "repair"}


STATE_CODES = {"NO_GO", "INTENT_NO_RESULT", "GAP", "STOP_NOT_CLOSED", "REPORT_FILE", "CUT_UNRECORDED"}


# The state codes that a correct test night can leave: an unfinished night. A test that expects a gap says so.
UNFINISHED = {"NO_GO", "INTENT_NO_RESULT", "STOP_NOT_CLOSED"}


# A final code means: do not retry. Pinned, because SKILL.md tells the agent to act on the class.
FINAL_CODES = {
    "AFTER_STOP", "BAD_LINE", "CLOSED", "COUNTS_WRONG", "FAKE_CLOCK", "FIRST_NOT_NEW", "GO_TWICE", "ID_ORDER", "INTERNAL",
    "ITEM_DENIED", "ITEM_HELD", "JOURNAL_FAULTS", "LOCK_STALE", "NEW_TWICE", "NO_REHEARSAL",
    "OWNER_ITEM", "RESULT_FINAL", "SCHEMA", "UNKNOWN_RESULT", "WRITE_FAILED"}


# Pinned here, not read from the script: a script that calls a rule code "pre-event" would switch parity off.
PRE_EVENT_CODES = {
    "NO_NIGHT", "BAD_ARGUMENT", "WORDS_FILE", "WORDS_AS_ARGUMENT", "ARG_NOT_FOR_KIND", "ITEM_MISSING", "ITEM_LINE",
    "EVENT_ID", "RESULT_FIELDS", "PAGECHECK_FIELDS", "CARD_MISSING", "CARD_NO_BLOCK", "CARD_TWO_BLOCKS",
    "CARD_OPEN_FENCE", "MAX_GAP_ENV", "FAKE_CLOCK_NO_TEST", "FAKE_CLOCK_FORM", "LOCK_HELD", "LOCK_STALE", "TORN_LINE",
    "BAD_LINE", "SCHEMA", "REPAIR_NOTHING", "ID_NOT_REPORT", "WRITE_FAILED", "INTERNAL", "STOP_NO_OFFSET"}


def env_for(at=T0, test_mode=True, fake=True, extra=None):
    env = {"PATH": os.environ.get("PATH", ""), "TZ": "UTC", "NIGHT_LOCK_WAIT_S": "5"}
    if test_mode:
        env["NIGHT_TEST_MODE"] = "1"
    if fake:
        env["NIGHT_FAKE_NOW"] = at
    env.update(extra or {})
    return env


def argv(folder, *args):
    return [sys.executable, "-I", NIGHT, args[0], "--dir", folder, *args[1:]]


def run(folder, *args, at=T0, env=None, test_mode=True, fake=True):
    done = subprocess.run(argv(folder, *args), capture_output=True, text=True,
                          env=env_for(at, test_mode, fake, env), check=False)
    return done.returncode, done.stdout + done.stderr


def at(hhmm, day="2026-01-10"):
    return f"{day}T{hhmm}:00+00:00"


COUNTER = [0]


def words_file(folder, text):
    """The owner's exact words go in through a file (a quoted heredoc in real use)."""
    COUNTER[0] += 1
    path = f"{folder}.words-{COUNTER[0]}.txt"
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)
    return path


def new(folder, text="goal: fix the typos; merge PR 1; until 06:00", when=at("22:00")):
    return run(folder, "new", "--words-file", words_file(folder, text), at=when)


def card(folder, rows=ITEMS, raw=None):
    """Add the night-items block to card.md, as the agent does from the card."""
    body = raw if raw is not None else "\n".join(" | ".join(row) for row in rows)
    with open(os.path.join(folder, "card.md"), "a", encoding="utf-8") as handle:
        handle.write("\n## Items\n\n```night-items\n" + body + "\n```\n")


def go_args(stop="2026-01-11T06:00", heartbeat="30", rehearsal="passed", goal="set"):
    return ["go", "--stop", stop + "+00:00", "--goal", goal, "--rehearsal", rehearsal, "--heartbeat-min", heartbeat]


def started(folder, rows=ITEMS, **go):
    """A night with a go at 22:01 UTC and the card items of `rows`."""
    code, out = new(folder)
    assert code == 0, out
    card(folder, rows)
    code, out = run(folder, *go_args(**go), at=at("22:01"))
    assert code == 0, out


def merge(item, sha=SHA):
    """The command of the card row of `item`, with `sha` in its head slot (a name not on the card: any merge)."""
    return ROW_COMMANDS.get(item.strip(), f"gh pr merge 9 -R org/app --squash {OPT} {{head}}").replace("{head}", sha)


def intent_args(item, sha=SHA, command=None):
    return ["log", "intent", "--item", item, "--command", command or merge(item, sha), "--head", sha]


def intent(folder, item, when, sha=SHA, command=None):
    return run(folder, *intent_args(item, sha, command), at=when)


def amend(folder, text, *extra, when):
    return run(folder, "log", "amend", "--words-file", words_file(folder, text), *extra, at=when)


def code_of(out):
    return re.findall(r"(?:REFUSED|PROBLEM) \[([A-Z_]+)\]", out)


_MODULE = []


def night_module():
    """All names of night.py and its modules (in the folder of NIGHT), in one namespace."""
    if not _MODULE:
        spec = importlib.util.spec_from_file_location("night_under_test", NIGHT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)  # night.py puts its folder first on sys.path
        names = {}
        for part in NIGHT_MODULES:
            names.update(vars(sys.modules[part]))
        names.update(vars(module))
        _MODULE.append(types.SimpleNamespace(**names))
    return _MODULE[0]


# Broken journals for `check`. Each one breaks one rule; `check` must name its code.
GO = {"kind": "go", "stop": "2026-01-11T06:00:00+00:00", "heartbeat_min": 30, "gap_min": 60, "max_gap_min": 60,
      "goal": "set", "rehearsal": "passed", "items": [list(row) for row in ITEMS]}


INTENT = {"kind": "intent", "command": merge("PR 1"), "head": SHA}


def journal(*rows, test=True):
    first = {"id": 1, "t": at("22:00"), "kind": "new", "run": "night-test", "words": "w"}
    if test:
        first["test"] = True
    events = [first]
    for row in rows:
        event = {"id": len(events) + 1}
        event.update(row)
        events.append(event)
    return events


def go_at(hhmm="22:01", **extra):
    return {**GO, "t": at(hhmm), **extra}


def result(hhmm, of, outcome="done", **extra):
    return {"t": at(hhmm), "kind": "result", "of": of, "outcome": outcome, **extra}


def write(folder, events):
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, "journal.jsonl"), "w", encoding="utf-8") as handle:
        for event in events:
            handle.write(json.dumps(event) + "\n")


def read_events(folder):
    with open(os.path.join(folder, "journal.jsonl"), encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def journal_bytes(folder):
    try:
        with open(os.path.join(folder, "journal.jsonl"), "rb") as handle:
            return handle.read()
    except (FileNotFoundError, IsADirectoryError):
        return None


def read_report(folder):
    with open(os.path.join(folder, "report.md"), encoding="utf-8") as handle:
        return handle.read()


def part(report, title, next_title):
    return report.split(title)[1].split(next_title)[0]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = os.path.join(self.tmp.name, "night")
        self.hand_edit = False
        self.expect = set()  # state codes that this test makes on purpose, for example {"GAP"}

    def tearDown(self):
        """Each folder that commands wrote: no lock left, and `check` finds no rule fault and no state problem
        that the test did not ask for. Parity copies and hand-written journals are not checked."""
        try:
            for name in sorted(os.listdir(self.tmp.name)):
                folder = os.path.join(self.tmp.name, name)
                if not os.path.isdir(folder) or "-parity-" in name:
                    continue
                self.assertFalse(os.path.exists(os.path.join(folder, "journal.lock")), f"a command left the lock in {name}")
                if self.hand_edit or not os.path.exists(os.path.join(folder, "journal.jsonl")):
                    continue
                code, out = run(folder, "check", at=at("23:59"), fake=bool(read_events(folder)[0].get("test")))
                found = [c for c in code_of(out) if c not in UNFINISHED | self.expect]
                self.assertEqual(found, [], f"commands wrote a journal in {name} with problems\n{out}")
        finally:
            self.tmp.cleanup()

    def events(self):
        return read_events(self.dir)

    def ok(self, outcome):
        code, out = outcome
        self.assertEqual(code, 0, out)
        return out

    def refused(self, *args, at=T0, code="", env=None, folder=None, **kw):
        folder = folder or self.dir
        before = journal_bytes(folder)
        exit_code, out = run(folder, *args, at=at, env=env, **kw)
        self.assertEqual(journal_bytes(folder), before, f"a refused command changed the journal\n{out}")
        self.assert_refusal(args[0], folder, exit_code, out, code, env, kw.get("test_mode", True))
        return out

    def is_refused(self, outcome, code, command="log", folder=None):
        exit_code, out = outcome
        self.assert_refusal(command, folder or self.dir, exit_code, out, code, None, True)
        return out

    def assert_refusal(self, command, folder, exit_code, out, code, env, test_mode):
        self.assertEqual(exit_code, 3, out)
        self.assertEqual(code_of(out), [code], out)
        self.assertNotIn("Traceback", out)
        if command not in WRITE_COMMANDS:
            return
        if not test_mode:
            self.assertNotIn("REFUSED EVENT", out, "only test mode prints the refused entry")
            return
        found = re.search(r"REFUSED EVENT: (\{.*\})", out)
        self.assertEqual(found is not None, code not in PRE_EVENT_CODES,
                         f"{code}: the refused event must be printed exactly when the code is not a pre-event code\n{out}")
        if found:
            self.parity(folder, json.loads(found.group(1)), code, env)

    def parity(self, folder, event, code, env):
        """The refused event, written into a copy of the journal by hand, gives the same code in check."""
        COUNTER[0] += 1
        copy = f"{folder}-parity-{COUNTER[0]}"
        if os.path.exists(os.path.join(folder, "journal.jsonl")):
            shutil.copytree(folder, copy, ignore=shutil.ignore_patterns("journal.lock"))
        else:
            os.makedirs(copy)
        with open(os.path.join(copy, "journal.jsonl"), "a", encoding="utf-8") as handle:
            handle.write(json.dumps(event) + "\n")
        test_journal = bool(read_events(copy)[0].get("test"))
        check_code, check_out = run(copy, "check", at=event["t"], env=env, fake=test_journal)
        self.assertEqual(check_code, 1, check_out)
        self.assertRegex(check_out, rf"PROBLEM \[{code}\] E{event['id']} ", f"parity: check does not name {code}")

    def folder(self, name):
        return os.path.join(self.tmp.name, name)


# The hook runs night.py in its own process and slows down or holds one call that night.py makes.
# night.py does not change. A marker file proves that the hook ran, so a changed call is found.
HOOK = textwrap.dedent("""
    import builtins, os, sys, time
    mode, marker, script = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(script, encoding="utf-8") as handle:
        code = compile(handle.read(), script, "exec")
    real_open, real_os_open, real_fsync, real_replace = builtins.open, os.open, os.fsync, os.replace
    def wait_for(path):
        end = time.time() + 60
        while not os.path.exists(path):
            if time.time() > end:
                os._exit(9)
            time.sleep(0.0005)
    def note(name):
        real_open(f"{marker}.{name}-{os.getpid()}", "w").close()
    if mode == "gate":  # all start together; each one waits 50 ms before its journal append
        def slow():
            note("append")
            time.sleep(0.05)
        def open_(file, mode="r", *a, **k):
            if str(file).endswith("journal.jsonl") and "a" in mode:
                slow()
            return real_open(file, mode, *a, **k)
        def os_open(path, flags, *a, **k):
            if str(path).endswith("journal.jsonl") and flags & os.O_APPEND:
                slow()
            return real_os_open(path, flags, *a, **k)
        builtins.open, os.open = open_, os_open
        note("ready")
        wait_for(marker + ".go")
    elif mode == "hold-fsync":  # hold in the first fsync: the entry is written and the lock is held
        def fsync(fd):
            note("held")
            wait_for(marker + ".go")
            return real_fsync(fd)
        os.fsync = fsync
    elif mode == "short-write":  # the first write of a journal entry writes only 5 bytes, as a full disk can
        real_write, short = os.write, [True]
        def write(fd, data):
            if short[0] and bytes(data[:6]) == b'{"id":' and len(data) > 5:
                short[0] = False
                note("short")
                return real_write(fd, bytes(data[:5]))
            return real_write(fd, data)
        os.write = write
    elif mode == "die-after-truncate":  # a crash right after the repair cut the journal
        real_truncate = os.truncate
        def truncate(path, length):
            real_truncate(path, length)
            note("cut")
            os._exit(9)
        os.truncate = truncate
    elif mode == "hold-replace":  # hold before the rename of report.md: the entry is in the journal
        def replace(a, b):
            note("held")
            wait_for(marker + ".go")
            return real_replace(a, b)
        os.replace = replace
    sys.argv = [script] + sys.argv[4:]
    exec(code, {"__name__": "__main__", "__file__": script})
""")


class Hooked(Base):
    def hooked(self, mode, args, when, count=1):
        wrapper = os.path.join(self.tmp.name, "hook.py")
        with open(wrapper, "w", encoding="utf-8") as handle:
            handle.write(HOOK)
        COUNTER[0] += 1
        marker = os.path.join(self.tmp.name, f"m{COUNTER[0]}")
        procs = [subprocess.Popen([sys.executable, "-I", wrapper, mode, marker, NIGHT, args[0], "--dir", self.dir, *args[1:]],
                                  env=env_for(when, extra={"NIGHT_LOCK_WAIT_S": "20"}), stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True) for _ in range(count)]
        return marker, procs

    def wait_markers(self, marker, name, count=1, seconds=30):
        end = time.time() + seconds
        base = os.path.basename(marker) + "." + name
        while sum(1 for f in os.listdir(self.tmp.name) if f.startswith(base)) < count:
            self.assertLess(time.time(), end, f"{count} `{name}` markers did not come: the hook did not run")
            time.sleep(0.01)

    def gated(self, count, args, when):
        """Start `count` processes at one gate, open it, and return (exit code, output) of each."""
        marker, procs = self.hooked("gate", args, when, count)
        self.wait_markers(marker, "ready", count)
        open(marker + ".go", "w", encoding="utf-8").close()
        outs = [proc.communicate(timeout=90) for proc in procs]
        self.wait_markers(marker, "append", 1, seconds=1)
        return [(proc.returncode, o + e) for proc, (o, e) in zip(procs, outs)]


STUB = "import sys\nprint('check: OK')\nsys.exit(0)\n"
