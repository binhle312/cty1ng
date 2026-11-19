#!/usr/bin/env python3
"""Tests of night.py. Run: `python3 -I test_night.py -v` in this folder.

`python3 -I test_night.py --show-red` runs `night.py check` on each broken journal, prints the
output, and exits 1 if a broken journal does not fail with its code.
NIGHT_PY replaces the script under test (for a run against a changed copy).
Each refusal has a code (`REFUSED [CODE]`), and each test asserts the code. Each refusal of a
write command in test mode also prints the event it refused; `refused()` writes that event into
a copy of the journal and asserts that `check` names the same code on the same event (parity).
"""

import ast
import importlib.util
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import textwrap
import time
import random
import unittest
from datetime import datetime, timedelta, timezone

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
NIGHT = os.environ.get("NIGHT_PY", os.path.join(HERE, "night.py"))
T0 = "2026-01-10T22:00:00+00:00"
SHA = "0123456789abcdef0123456789abcdef01234567"
SHA2 = "fedcba9876543210fedcba9876543210fedcba98"
OPT = "--match-head-commit"
ITEMS = [("PR 1", "commit", OPT), ("PR 2", "commit", OPT), ("PR 3", "commit", OPT), ("PR 12", "commit", OPT),
         ("org/one#3", "commit", OPT), ("org/two#3", "commit", OPT), ("notice", "no-commit"), ("PR 4", "owner")]
WRITE_COMMANDS = {"new", "go", "log", "report", "close", "repair"}
STATE_CODES = {"NO_GO", "INTENT_NO_RESULT", "GAP", "STOP_NOT_CLOSED", "REPORT_FILE", "CUT_UNRECORDED"}
# The state codes that a correct test night can leave: an unfinished night. A test that expects a gap says so.
UNFINISHED = {"NO_GO", "INTENT_NO_RESULT", "STOP_NOT_CLOSED"}
# A final code means: do not retry. Pinned, because SKILL.md tells the agent to act on the class.
FINAL_CODES = {
    "AFTER_STOP", "BAD_LINE", "CLOSED", "COUNTS_WRONG", "FAKE_CLOCK", "FIRST_NOT_NEW", "GO_TWICE", "ID_ORDER", "INTERNAL",
    "ITEM_DENIED", "ITEM_HELD", "JOURNAL_FAULTS", "LOCK_STALE", "NEW_TWICE", "NO_COMMIT_HAS_SHA", "NO_REHEARSAL",
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
    return f"gh pr merge {item!r} {OPT} {sha}"


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
    if not _MODULE:
        spec = importlib.util.spec_from_file_location("night_under_test", NIGHT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _MODULE.append(module)
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


BROKEN = {
    "gap": (journal(go_at(), {"t": at("23:45"), "kind": "alive"}), "GAP"),
    "open intent": (journal(go_at(), {**INTENT, "t": at("22:10"), "item": "PR 1"}), "INTENT_NO_RESULT"),
    "time goes back": (journal(go_at(), {"t": at("22:20"), "kind": "alive"}, {"t": at("22:05"), "kind": "alive"}),
                       "TIME_BACK"),
    "intent on a denied item": (journal(go_at(),
                                        {"t": at("22:10"), "kind": "denied", "item": "PR 3", "command": "m", "blocks": "x"},
                                        {**INTENT, "t": at("22:20"), "item": "PR 3", "command": merge("PR 3")},
                                        result("22:21", 4)), "ITEM_DENIED"),
    "intent after a reopen of another repository": (journal(
        go_at(),
        {"t": at("22:10"), "kind": "denied", "item": "org/one#3", "command": "m", "blocks": "x"},
        {"t": at("22:11"), "kind": "denied", "item": "org/two#3", "command": "m", "blocks": "x"},
        {"t": at("22:12"), "kind": "amend", "words": "yes: org/two#3", "reopen": "org/two#3"},
        {**INTENT, "t": at("22:13"), "item": "org/one#3", "command": merge("org/one#3")},
        result("22:14", 6)), "ITEM_DENIED"),
    "decision with no source": (journal(go_at(), {"t": at("22:10"), "kind": "decision", "text": "x"}), "DECISION_SOURCE"),
    "intent after the stop": (journal(go_at(stop=at("22:30")), {"t": at("22:20"), "kind": "alive"},
                                      {**INTENT, "t": at("22:40"), "item": "PR 1"}, result("22:41", 4)), "AFTER_STOP"),
    "intent with no go": (journal({**INTENT, "t": at("22:10"), "item": "PR 1"}), ["NOT_STARTED", "ITEM_NOT_ON_CARD"]),
    "no go": (journal({"t": at("22:10"), "kind": "alive"}), "NO_GO"),
    "denied row with no command": (journal(go_at(), {"t": at("22:10"), "kind": "denied", "item": "PR 3", "blocks": "x"}),
                                   "DENIED_FIELDS"),
    "intent on a held item": (journal(go_at(), {"t": at("22:10"), "kind": "hold", "item": "PR 12", "text": "owner-only"},
                                      {**INTENT, "t": at("22:20"), "item": "PR 12", "command": merge("PR 12")},
                                      result("22:21", 4)), "ITEM_HELD"),
    "gap alarm above the maximum": (journal(go_at(heartbeat_min=600, gap_min=1200), {"t": at("23:15"), "kind": "alive"}),
                                    ["GAP_TOO_HIGH", "GAP"]),
    "gap alarm above its recorded maximum": (journal(go_at(max_gap_min=45), {"t": at("22:10"), "kind": "alive"}),
                                             "GAP_TOO_HIGH"),
    "stop passed, not closed": (journal(go_at(stop=at("23:00")), {"t": at("22:30"), "kind": "alive"},
                                        {"t": at("23:05"), "kind": "alive"}), "STOP_NOT_CLOSED"),
    "fake time in a real journal": (journal(go_at(), {"t": at("22:10"), "kind": "alive", "fake_clock": True}, test=False),
                                    "FAKE_CLOCK"),
    "item not on the card": (journal(go_at(), {**INTENT, "t": at("22:10"), "item": "#3", "command": merge("#3")},
                                     result("22:11", 3)), "ITEM_NOT_ON_CARD"),
    "a short head": (journal(go_at(), {**INTENT, "t": at("22:10"), "item": "PR 1", "head": "0123456",
                                       "command": f"m {OPT} 0123456"}, result("22:11", 3)), "HEAD_FORM"),
    "head not with its option": (journal(go_at(), {**INTENT, "t": at("22:10"), "item": "PR 1", "command": f"gh pr merge 1 # {SHA}"},
                                         result("22:11", 3)), "HEAD_OPTION_MISSING"),
    "no head on a commit item": (journal(go_at(), {"t": at("22:10"), "kind": "intent", "item": "PR 1",
                                                   "command": "gh pr merge 1", "no_head": "x"}, result("22:11", 3)),
                                 "COMMIT_NEEDS_HEAD"),
    "intent on an owner item": (journal(go_at(), {"t": at("22:10"), "kind": "intent", "item": "PR 4", "command": "m",
                                                  "no_head": "x"}, result("22:11", 3)), "OWNER_ITEM"),
    "an event after the close": (journal(go_at(), {"t": at("22:10"), "kind": "report", "counts": {"new": 1, "go": 1, "report": 1}},
                                         {"t": at("22:11"), "kind": "close", "reason": "nothing-left", "without_page": "x"},
                                         {"t": at("22:12"), "kind": "decision", "text": "x", "check": True}),
                               ["CLOSED", "REPORT_FILE"]),
    "report with wrong counts": (journal(go_at(), {"t": at("22:10"), "kind": "report", "counts": {"new": 1, "report": 1}}),
                                 ["COUNTS_WRONG", "REPORT_FILE"]),
    "amend with no owner words": (journal(go_at(), {"t": at("22:10"), "kind": "amend", "reopen": "PR 3"}),
                                  ["WORDS_MISSING", "REOPEN_NOT_BLOCKED"]),
    "intent with no rehearsal": (journal(go_at(rehearsal="none"), {**INTENT, "t": at("22:10"), "item": "PR 1"},
                                         result("22:11", 3)), "NO_REHEARSAL"),
    "a second go": (journal(go_at(), go_at("22:05")), "GO_TWICE"),
    "a second new": (journal({"t": at("22:01"), "kind": "new", "run": "x", "words": "w"}), "NEW_TWICE"),
    "a repeated id": ([*journal(go_at()), {"id": 2, "t": at("22:10"), "kind": "alive"}], "ID_ORDER"),
    "a skipped id": ([*journal(go_at()), {"id": 9, "t": at("22:10"), "kind": "alive"}], "ID_ORDER"),
    "no new first": ([{"id": 1, **go_at()}], "FIRST_NOT_NEW"),
    "a near duplicate name": (journal(go_at(items=[["PR 1", "owner"], ["pr  1", "owner"]])), "ITEM_DUPLICATE"),
    "a name with spaces at its ends": (journal(go_at(items=[[" PR 1", "owner"]])), "ITEM_NAME"),
    "a commit row with no option": (journal(go_at(items=[["PR 1", "commit"]])), "ITEM_OPTION"),
    "an unknown kind of item": (journal(go_at(items=[["PR 1", "merge"]])), "ITEM_KIND"),
}


def check_broken(folder, events):
    """`check` on a hand-written journal; a journal that is not a test journal gets the real clock."""
    write(folder, events)
    return run(folder, "check", at=at("23:50"), fake=bool(events[0].get("test")))


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


class StartTests(Base):
    def test_new_records_exact_words_from_a_file(self):
        text = 'goal: X; "quoted" $HOME `tick`; until 06:00'
        self.ok(new(self.dir, text, when=at("21:59")))
        first = self.events()[0]
        self.assertEqual((first["words"], first["t"], first["test"], first["format"]), (text, at("21:59"), True, 1))
        self.assertTrue(first["fake_clock"])
        with open(os.path.join(self.dir, "card.md"), encoding="utf-8") as handle:
            self.assertIn(text, handle.read())

    def test_new_needs_owner_words_from_a_readable_file(self):
        self.refused("new", code="WORDS_MISSING")
        self.refused("new", "--words-file", words_file(self.dir, "  \n"), code="WORDS_EMPTY")
        self.refused("new", "--words-file", self.dir + ".no-such-file", code="WORDS_FILE")
        bad = words_file(self.dir, "")
        with open(bad, "wb") as handle:
            handle.write(b"\xff\xfe bad")
        self.refused("new", "--words-file", bad, code="WORDS_FILE")
        self.assertFalse(os.path.exists(os.path.join(self.dir, "journal.jsonl")))

    def test_second_new_in_one_folder_is_refused(self):
        new(self.dir)
        out = self.refused("new", "--words-file", words_file(self.dir, "w"), code="NEW_TWICE")
        self.assertIn("One folder holds one night", out)

    def test_log_before_new_is_refused(self):
        self.refused("log", "alive", "x", code="NO_NIGHT")

    def test_items_prints_the_card_rows_for_the_read_back(self):
        new(self.dir)
        self.refused("items", code="CARD_NO_BLOCK")
        card(self.dir)
        out = self.ok(run(self.dir, "items"))
        for row in ITEMS:
            self.assertIn(" | ".join(row), out)

    def test_go_records_the_exact_card_names(self):
        started(self.dir)
        go = self.events()[-1]
        self.assertEqual(go["items"], [list(row) for row in ITEMS])
        self.assertEqual(go["max_gap_min"], 60)

    def test_go_refuses_a_card_with_no_usable_items_block(self):
        cases = {
            "CARD_MISSING": None,
            "CARD_NO_BLOCK": "",
            "ITEM_LINE": "PR 1 commit",
            "ITEMS_EMPTY": "\n",
            "ITEM_DUPLICATE": "PR 1 | owner\npr  1 | owner",
            "ITEM_KIND": "PR 1 | merge",
            "ITEM_OPTION": "PR 1 | commit",
            "ITEM_NAME": "PR\x011 | owner",
            "CARD_TWO_BLOCKS": "PR 1 | owner\n```\n\n```night-items\nPR 2 | owner",
        }
        for expected, raw in cases.items():
            with self.subTest(code=expected):
                folder = self.folder(expected)
                self.ok(new(folder))
                if raw is None:
                    os.remove(os.path.join(folder, "card.md"))
                elif raw != "":
                    card(folder, raw=raw)
                self.refused(*go_args(), at=at("22:01"), code=expected, folder=folder)

    def test_item_options_must_fit_their_kind(self):
        for raw in ("notice | no-commit | --x", "PR 4 | owner | --x", "PR 1 | commit | match head"):
            with self.subTest(raw=raw):
                folder = self.folder(re.sub(r"\W+", "-", raw))
                self.ok(new(folder))
                card(folder, raw=raw)
                self.refused(*go_args(), at=at("22:01"), code="ITEM_OPTION", folder=folder)

    def test_card_parse_ignores_a_block_in_the_owner_words_and_reads_crlf(self):
        self.ok(new(self.dir, "goal: x\n```night-items\nPR 9 | owner\n```\n## Needs you\nuntil 06:00"))
        with open(os.path.join(self.dir, "card.md"), "a", encoding="utf-8", newline="") as handle:
            handle.write("\r\n```night-items\r\nPR 1 | commit | --match-head-commit\r\nPR 4 | owner\r\n```\r\n")
        self.ok(run(self.dir, *go_args(), at=at("22:01")))
        self.assertEqual(self.events()[-1]["items"], [["PR 1", "commit", OPT], ["PR 4", "owner"]])

    def test_an_open_fence_in_the_card_is_refused(self):
        new(self.dir)
        with open(os.path.join(self.dir, "card.md"), "a", encoding="utf-8") as handle:
            handle.write("\n```night-items\nPR 1 | owner\n")
        self.refused(*go_args(), at=at("22:01"), code="CARD_OPEN_FENCE")

    def test_go_needs_a_stop_time_and_a_rehearsal_state_and_has_no_goal_not_set(self):
        new(self.dir)
        card(self.dir)
        for args in (["--goal", "set", "--rehearsal", "passed"], ["--stop", "06:00", "--goal", "set"],
                     ["--stop", "06:00", "--goal", "not-set", "--rehearsal", "passed"],
                     ["--sto", "06:00", "--goal", "set", "--rehearsal", "passed"]):
            with self.subTest(args=args):
                self.assertEqual(run(self.dir, "go", *args)[0], 2)

    def test_go_records_a_harness_with_no_goal_command(self):
        started(self.dir, goal="no-goal-command")
        self.assertEqual(self.events()[-1]["goal"], "no-goal-command")

    def test_go_with_a_past_stop_time_is_refused(self):
        new(self.dir)
        card(self.dir)
        out = self.refused(*go_args(stop="2026-01-10T21:00"), at=at("22:01"), code="GO_STOP_NOT_FUTURE")
        self.assertIn("not in the future", out)

    def test_second_go_is_refused(self):
        started(self.dir)
        out = self.refused(*go_args(), at=at("22:05"), code="GO_TWICE")
        self.assertIn("already has a go", out)

    def test_gap_alarm_has_a_maximum_that_the_environment_can_only_lower(self):
        new(self.dir)
        card(self.dir)
        self.assertIn("at most 60", self.refused(*go_args(heartbeat="600"), at=at("22:01"), code="GAP_TOO_HIGH"))
        self.refused(*go_args(), "--gap-min", "90", at=at("22:01"), code="GAP_TOO_HIGH")
        self.assertIn("at most 45", self.refused(*go_args(), "--gap-min", "60", at=at("22:01"),
                                                  env={"NIGHT_MAX_GAP_MIN": "45"}, code="GAP_TOO_HIGH"))
        for value in ("90", "abc", "0"):
            with self.subTest(value=value):
                self.refused(*go_args(), at=at("22:01"), env={"NIGHT_MAX_GAP_MIN": value}, code="MAX_GAP_ENV")
        self.refused(*go_args(heartbeat="0"), at=at("22:01"), code="HEARTBEAT_NOT_POSITIVE")
        self.refused(*go_args(heartbeat="30"), "--gap-min", "20", at=at("22:01"), code="GAP_BELOW_HEARTBEAT")
        self.ok(run(self.dir, *go_args(heartbeat="20"), "--gap-min", "40", at=at("22:01"), env={"NIGHT_MAX_GAP_MIN": "45"}))
        self.assertEqual((self.events()[-1]["gap_min"], self.events()[-1]["max_gap_min"]), (40, 45))

    def test_a_time_of_day_with_its_offset_is_the_next_such_time(self):
        new(self.dir)
        card(self.dir)
        self.ok(run(self.dir, "go", "--stop", "06:00+07:00", "--goal", "set", "--rehearsal", "passed", at=at("22:01")))
        self.assertEqual(self.events()[-1]["stop"], "2026-01-10T23:00:00+00:00")

    def test_a_stop_time_with_no_offset_is_refused(self):
        """The host zone is not the card's zone: 06:00 in Bangkok is not 06:00 on a UTC host (P2-5)."""
        new(self.dir)
        card(self.dir)
        for stop in ("06:00", "2026-01-11T06:00", "2026-01-11 06:00"):
            with self.subTest(stop=stop):
                self.refused("go", "--stop", stop, "--goal", "set", "--rehearsal", "passed", at=at("22:01"),
                             env={"TZ": "Asia/Bangkok"}, code="STOP_NO_OFFSET")


class PhaseTests(Base):
    """Each command in each phase: none (no journal), prepared (new, no go), running (go), closed."""

    MATRIX = [
        (["go"], "ok", "GO_TWICE", "CLOSED"),
        (["status"], "ok", "ok", "ok"),
        (["render"], "REPORT_NONE_YET", "REPORT_NONE_YET", "ok"),
        (["repair"], "REPAIR_NOTHING", "REPAIR_NOTHING", "REPAIR_NOTHING"),
        (["log", "alive", "x"], "ok", "ok", "CLOSED"),
        (["log", "aware", "x"], "ok", "ok", "ok"),
        (["log", "error", "x"], "ok", "ok", "ok"),
        (["log", "reserve", "x"], "ok", "ok", "CLOSED"),
        (["log", "decision", "x", "--check"], "ok", "ok", "CLOSED"),
        (["log", "amend", "WORDS"], "ok", "ok", "CLOSED"),
        (["log", "amend", "WORDS", "--reopen", "PR 1"], "NOT_STARTED", "REOPEN_NOT_BLOCKED", "CLOSED"),
        (["log", "amend", "WORDS", "--add-item", "PR 7 | owner"], "NOT_STARTED", "ok", "CLOSED"),
        (["log", "answer", "WORDS"], "NOT_STARTED", "ok", "ok"),
        (intent_args("PR 1"), "NOT_STARTED", "ok", "CLOSED"),
        (["log", "result", "--of", "2", "--outcome", "done"], "NOT_STARTED", "RESULT_NOT_INTENT", "CLOSED"),
        (["log", "denied", "--item", "PR 1", "--command", "m", "--blocks", "x"], "NOT_STARTED", "ok", "CLOSED"),
        (["log", "hold", "x", "--item", "PR 1"], "NOT_STARTED", "ok", "CLOSED"),
        (["log", "wait", "x", "--item", "PR 1"], "NOT_STARTED", "ok", "CLOSED"),
        (["log", "pagecheck", "--name", "counts", "--outcome", "pass", "--report", "E2"], "NOT_STARTED", "REPORT_NONE_YET",
         "CLOSED"),
        (["report"], "NOT_STARTED", "ok", "CLOSED"),
        (["close", "--reason", "nothing-left", "--without-page", "x"], "NOT_STARTED", "REPORT_NONE_YET", "CLOSED"),
        (["new", "WORDS"], "NEW_TWICE", "NEW_TWICE", "NEW_TWICE"),
    ]

    def phase_folders(self):
        none, prepared, running = self.folder("none"), self.folder("prepared"), self.folder("running")
        closed = self.folder("closed")
        os.makedirs(none)
        self.ok(new(prepared))
        card(prepared)
        started(running)
        started(closed)
        self.ok(run(closed, "report", at=at("22:02")))
        self.ok(run(closed, "close", "--reason", "nothing-left", "--without-page", "test", at=at("22:03")))
        return {"none": none, "prepared": prepared, "running": running, "closed": closed}

    def test_each_command_in_each_phase(self):
        folders = self.phase_folders()
        for n, (args, *expected) in enumerate(self.MATRIX):
            expected = ["ok" if args[0] == "new" else "NO_NIGHT"] + expected
            for (phase, base), want in zip(folders.items(), expected):
                with self.subTest(command=args, phase=phase):
                    folder = f"{base}-{n}"
                    shutil.copytree(base, folder)
                    full = list(args)
                    if full == ["go"]:
                        full = go_args()
                    if "WORDS" in full:
                        full[full.index("WORDS")] = "--words-file"
                        full.insert(full.index("--words-file") + 1, words_file(folder, "owner words"))
                    if want == "ok":
                        before = len(read_events(folder)) if journal_bytes(folder) is not None else 0
                        self.ok(run(folder, *full, at=at("22:30")))
                        if args[0] in WRITE_COMMANDS:
                            kinds = [e["kind"] for e in read_events(folder)]
                            self.assertEqual((len(kinds), kinds[-1]), (before + 1, args[1] if args[0] == "log" else args[0]))
                    else:
                        self.refused(*full, at=at("22:30"), code=want, folder=folder)

    def test_after_the_stop_each_kind_but_an_intent_is_accepted(self):
        self.expect = {"GAP"}
        started(self.dir, stop="2026-01-10T23:00")
        when = at("23:05")
        self.ok(run(self.dir, "log", "alive", "x", at=when))
        self.ok(run(self.dir, "log", "aware", "x", at=when))
        self.ok(run(self.dir, "log", "decision", "x", "--check", at=when))
        self.ok(run(self.dir, "log", "wait", "x", "--item", "PR 2", at=when))
        self.ok(run(self.dir, "log", "hold", "x", "--item", "PR 12", at=when))
        self.ok(run(self.dir, "log", "denied", "--item", "PR 3", "--command", "m", "--blocks", "x", at=when))
        self.ok(amend(self.dir, "stop now", when=when))
        out = self.refused(*intent_args("PR 1"), at=when, code="AFTER_STOP")
        self.assertIn("has passed", out)
        self.ok(run(self.dir, "report", at=when))

    def test_an_intent_at_the_stop_minute_is_refused(self):
        started(self.dir, stop="2026-01-10T23:00")
        self.refused(*intent_args("PR 1"), at=at("23:00"), code="AFTER_STOP")
        self.ok(intent(self.dir, "PR 1", at("22:59")))

    def test_time_that_goes_back_is_refused(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "alive", "x", at=at("22:10")))
        self.refused("log", "alive", "y", at=at("22:05"), code="TIME_BACK")


class ClockTests(Base):
    def real_journal(self):
        self.ok(run(self.dir, "new", "--words-file", words_file(self.dir, "w"), test_mode=False, fake=False))
        self.assertNotIn("fake_clock", self.events()[0])
        self.assertNotIn("test", self.events()[0])

    def test_fake_clock_needs_test_mode_and_an_offset(self):
        self.refused("new", "--words-file", words_file(self.dir, "w"), test_mode=False, code="FAKE_CLOCK_NO_TEST")
        self.refused("new", "--words-file", words_file(self.dir, "w"), at="2026-01-10T22:00", code="FAKE_CLOCK_FORM")

    def test_fake_clock_on_a_real_journal_is_refused(self):
        self.real_journal()
        self.refused("log", "alive", "x", code="FAKE_CLOCK")
        self.refused("status", code="FAKE_CLOCK")
        self.refused("check", "--now", code="FAKE_CLOCK")
        self.refused("check", code="FAKE_CLOCK")
        code, out = run(self.dir, "check", fake=False)
        self.assertEqual((code, code_of(out)), (1, ["NO_GO"]), out)

    def test_only_a_test_journal_says_test_journal(self):
        self.real_journal()
        self.assertNotIn("TEST JOURNAL", self.ok(run(self.dir, "status", test_mode=False, fake=False)))
        other = self.folder("test")
        started(other)
        self.assertIn("TEST JOURNAL", self.ok(run(other, "status", at=at("22:02"))))
        self.ok(run(other, "report", at=at("22:03")))
        self.assertIn("TEST JOURNAL", read_report(other).splitlines()[0])
        out = self.ok(run(other, "close", "--reason", "nothing-left", "--without-page", "test", at=at("22:04")))
        self.assertIn("TEST JOURNAL", [line for line in out.splitlines() if "NIGHT CLOSED" in line][0])


class ItemTests(Base):
    def test_only_exact_card_names_are_items(self):
        started(self.dir)
        for other in ("#3", "PR-3", "pr 3", "3", "PR 3 (fix login)", "https://github.com/org/one/pull/3"):
            with self.subTest(item=other):
                out = self.refused(*intent_args(other), at=at("22:10"), code="ITEM_NOT_ON_CARD")
                self.assertIn("org/one#3", out)
        self.ok(intent(self.dir, " PR 3 ", at("22:11")))
        self.assertEqual(self.events()[-1]["item"], "PR 3")

    def test_each_kind_with_an_item_needs_a_card_name(self):
        started(self.dir)
        self.refused("log", "denied", "--item", "PR 9", "--command", "m", "--blocks", "x", at=at("22:10"), code="ITEM_NOT_ON_CARD")
        self.refused("log", "hold", "reason", "--item", "PR 9", at=at("22:10"), code="ITEM_NOT_ON_CARD")
        self.refused("log", "wait", "reason", "--item", "PR 9", at=at("22:10"), code="ITEM_NOT_ON_CARD")
        self.refused("log", "decision", "x", "--check", "--item", "PR 9", at=at("22:10"), code="ITEM_NOT_ON_CARD")
        self.refused("log", "aware", "x", "--item", "PR 9", at=at("22:10"), code="ITEM_NOT_ON_CARD")
        self.is_refused(amend(self.dir, "yes", "--reopen", "PR 9", when=at("22:10")), "ITEM_NOT_ON_CARD")
        self.refused("log", "wait", "reason", at=at("22:10"), code="ITEM_MISSING")
        self.refused("log", "alive", "x", "--item", "PR 1", at=at("22:10"), code="ARG_NOT_FOR_KIND")

    def test_an_owner_item_takes_notes_but_no_action(self):
        started(self.dir)
        self.refused("log", "intent", "--item", "PR 4", "--command", "gh pr merge 4", "--no-head", "x", at=at("22:10"),
                     code="OWNER_ITEM")
        self.ok(run(self.dir, "log", "wait", "needs the owner", "--item", "PR 4", at=at("22:11")))

    def test_a_reopen_of_another_repository_keeps_the_block(self):
        started(self.dir)
        for name in ("org/one#3", "org/two#3"):
            self.ok(run(self.dir, "log", "denied", "--item", name, "--command", "m", "--blocks", "x", at=at("22:10")))
        self.ok(amend(self.dir, "yes: merge org/two#3", "--reopen", "org/two#3", when=at("22:11")))
        self.refused(*intent_args("org/one#3"), at=at("22:12"), code="ITEM_DENIED")
        self.ok(intent(self.dir, "org/two#3", at("22:13")))

    def test_a_reopen_of_an_item_that_is_not_blocked_is_refused(self):
        started(self.dir)
        self.is_refused(amend(self.dir, "yes", "--reopen", "PR 1", when=at("22:10")), "REOPEN_NOT_BLOCKED")

    def test_add_item_needs_the_owner_words_from_a_file(self):
        started(self.dir)
        self.refused("log", "amend", "--add-item", "PR 5 | commit | --match-head-commit", at=at("22:10"), code="WORDS_MISSING")
        self.refused("log", "amend", "--add-item", "PR 5 | owner", at=at("22:10"), code="WORDS_MISSING")

    def test_add_item_for_a_name_on_the_card_is_refused(self):
        started(self.dir)
        self.is_refused(amend(self.dir, "also PR 1", "--add-item", "PR 1 | owner", when=at("22:10")), "ITEM_ON_CARD")
        self.is_refused(amend(self.dir, "also pr 1", "--add-item", "pr  1 | owner", when=at("22:10")), "ITEM_ON_CARD")
        self.is_refused(amend(self.dir, "also PR 5", "--add-item", "PR 5 commit", when=at("22:10")), "ITEM_LINE")
        self.is_refused(amend(self.dir, "also PR 5", "--add-item", "PR 5 | merge", when=at("22:10")), "ITEM_KIND")
        self.is_refused(amend(self.dir, "also PR 5", "--add-item", "PR 5 | commit", when=at("22:10")), "ITEM_OPTION")

    def test_intent_on_a_new_item_before_its_amend_is_refused(self):
        started(self.dir)
        self.refused(*intent_args("PR 5"), at=at("22:10"), code="ITEM_NOT_ON_CARD")
        out = self.ok(amend(self.dir, "also merge PR 5 after the bar", "--add-item", "PR 5 | commit | --match-head-commit",
                            when=at("22:11")))
        self.assertIn("read it back", out)
        self.ok(intent(self.dir, "PR 5", at("22:12")))
        items = json.loads(self.ok(run(self.dir, "status", "--json", at=at("22:13"))))["items"]
        self.assertIn({"name": "PR 5", "kind": "commit", "option": OPT, "from": "E3"}, items)
        self.assertIn({"name": "PR 1", "kind": "commit", "option": OPT, "from": "E2"}, items)


class HeadTests(Base):
    def test_a_commit_item_needs_the_full_head_with_its_option(self):
        started(self.dir)
        for head in ("0123456", "main", SHA.upper(), SHA[:39], SHA + "8"):
            with self.subTest(head=head):
                self.refused(*intent_args("PR 1", head), at=at("22:10"), code="HEAD_FORM")
        out = self.refused("log", "intent", "--item", "PR 1", "--command", merge("PR 1"), at=at("22:10"), code="COMMIT_NEEDS_HEAD")
        self.assertIn("needs --head <", out)
        self.refused("log", "intent", "--item", "PR 1", "--command", "gh pr merge 1", "--no-head", "none", at=at("22:10"),
                     code="COMMIT_NEEDS_HEAD")
        for command in (merge("PR 1", SHA2), f"gh pr merge 1 # {SHA}", merge("PR 1", SHA + "8"), f"gh pr merge 1 --other {SHA}"):
            with self.subTest(command=command):
                self.refused(*intent_args("PR 1", SHA, command), at=at("22:10"), code="HEAD_OPTION_MISSING")
        self.ok(intent(self.dir, "PR 1", at("22:11"), command=f"gh pr merge 1 {OPT}={SHA}"))

    def test_a_no_commit_item_has_no_head(self):
        started(self.dir)
        self.refused("log", "intent", "--item", "notice", "--command", "send the notice", "--head", SHA, at=at("22:10"),
                     code="NO_COMMIT_HAS_HEAD")
        self.refused("log", "intent", "--item", "notice", "--command", "send the notice", at=at("22:10"),
                     code="NO_COMMIT_NEEDS_REASON")
        for sha in (SHA, SHA.upper()):
            with self.subTest(sha=sha):
                self.refused("log", "intent", "--item", "notice", "--command", f"git push origin {sha}", "--no-head", "x",
                             at=at("22:10"), code="NO_COMMIT_HAS_SHA")
        self.ok(run(self.dir, "log", "intent", "--item", "notice", "--command", "send the notice", "--no-head",
                    "a notice acts on no commit", at=at("22:11")))


class OrderTests(Base):
    """When two rules break, the final reason comes first."""

    def test_a_denied_item_with_a_bad_head_says_denied(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "denied", "--item", "PR 3", "--command", "m", "--blocks", "x", at=at("22:10")))
        self.refused(*intent_args("PR 3", "main"), at=at("22:11"), code="ITEM_DENIED")

    def test_after_the_stop_a_denied_item_says_after_the_stop(self):
        started(self.dir, stop="2026-01-10T23:00")
        self.ok(run(self.dir, "log", "denied", "--item", "PR 3", "--command", "m", "--blocks", "x", at=at("22:10")))
        self.refused(*intent_args("PR 3"), at=at("23:10"), code="AFTER_STOP")

    def test_an_unknown_result_with_a_bad_head_says_unknown(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.ok(run(self.dir, "log", "result", "--of", "3", "--outcome", "unknown", at=at("22:11")))
        self.refused(*intent_args("PR 1", "main"), at=at("22:12"), code="UNKNOWN_RESULT")

    def test_an_open_intent_with_no_command_says_open_intent(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.refused("log", "intent", "--item", "PR 1", "--head", SHA, at=at("22:12"), code="OPEN_INTENT")

    def test_no_rehearsal_comes_before_the_item_check(self):
        started(self.dir, rehearsal="none")
        self.refused(*intent_args("#3"), at=at("22:10"), code="NO_REHEARSAL")


class BlockTests(Base):
    def test_denied_item_stays_denied_until_an_owner_amend_opens_it(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "denied", "--item", "PR 3", "--command", "gh pr merge 3", "--blocks", "PR 4", at=at("22:10")))
        self.assertIn("denied stays denied", self.refused(*intent_args("PR 3"), at=at("22:20"), code="ITEM_DENIED"))
        self.ok(amend(self.dir, "yes: merge PR 3 now", "--reopen", "PR 3", when=at("22:30")))
        self.ok(intent(self.dir, "PR 3", at("22:31")))

    def test_a_denied_result_blocks_the_item_in_one_write_also_after_a_restart(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 3", at("22:10")))
        self.refused("log", "result", "--of", "E3", "--outcome", "denied", at=at("22:11"), code="DENIED_NEEDS_BLOCKS")
        self.ok(run(self.dir, "log", "result", "--of", "E3", "--outcome", "denied", "--blocks", "PR 4", "permission check",
                    at=at("22:11")))
        self.ok(run(self.dir, "status", at=at("23:00")))
        self.refused(*intent_args("PR 3"), at=at("23:01"), code="ITEM_DENIED")

    def test_a_result_blocks_the_item_of_its_intent_only(self):
        self.hand_edit = True
        write(self.dir, journal(go_at(), {**INTENT, "t": at("22:10"), "item": "PR 1"},
                                result("22:11", 3, "denied", blocks="x")))
        self.refused(*intent_args("PR 1"), at=at("22:12"), code="ITEM_DENIED")
        self.ok(intent(self.dir, "PR 2", at("22:13")))

    def test_denied_row_with_an_open_intent_is_refused(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 3", at("22:10")))
        out = self.refused("log", "denied", "--item", "PR 3", "--command", "m", "--blocks", "x", at=at("22:11"),
                           code="DENIED_OPEN_INTENT")
        self.assertIn("--outcome denied", out)

    def test_denied_row_needs_command_and_blocks(self):
        started(self.dir)
        out = self.refused("log", "denied", "--item", "PR 3", at=at("22:10"), code="DENIED_FIELDS")
        self.assertIn("--command and --blocks", out)

    def test_hold_blocks_an_intent_until_an_owner_amend_opens_it(self):
        started(self.dir)
        self.assertIn("needs --item and the reason", self.refused("log", "hold", "--item", "PR 12", at=at("22:05"),
                                                                    code="TEXT_MISSING"))
        self.ok(run(self.dir, "log", "hold", "changes an owner-only file", "--item", "PR 12", at=at("22:06")))
        self.assertIn("hold stays hold", self.refused(*intent_args("PR 12"), at=at("22:07"), code="ITEM_HELD"))
        self.ok(amend(self.dir, "yes: merge PR 12", "--reopen", "PR 12", when=at("22:08")))
        self.ok(intent(self.dir, "PR 12", at("22:09")))

    def test_one_reopen_opens_a_hold_and_a_denial_on_one_item(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "hold", "owner-only", "--item", "PR 12", at=at("22:06")))
        self.ok(run(self.dir, "log", "denied", "--item", "PR 12", "--command", "m", "--blocks", "x", at=at("22:07")))
        self.ok(amend(self.dir, "yes: merge PR 12", "--reopen", "PR 12", when=at("22:08")))
        self.ok(intent(self.dir, "PR 12", at("22:09")))


class FaultTests(Base):
    """A journal with a rule fault takes no new intent; the night can still be recorded and closed."""

    def test_a_hand_written_second_go_stops_new_intents(self):
        self.hand_edit = True
        write(self.dir, journal(go_at(stop=at("23:00")), go_at("22:05")))
        self.refused(*intent_args("PR 1"), at=at("22:10"), code="JOURNAL_FAULTS")
        self.ok(run(self.dir, "log", "alive", "x", at=at("22:11")))
        self.ok(run(self.dir, "report", at=at("22:12")))
        self.ok(run(self.dir, "close", "--reason", "stopped", "--without-page", "faults", at=at("22:13")))

    def test_a_reopen_with_no_words_stops_new_intents(self):
        self.hand_edit = True
        write(self.dir, journal(go_at(), {"t": at("22:10"), "kind": "denied", "item": "PR 3", "command": "m", "blocks": "x"},
                                {"t": at("22:11"), "kind": "amend", "reopen": "PR 3"}))
        self.refused(*intent_args("PR 3"), at=at("22:12"), code="JOURNAL_FAULTS")
        self.refused(*intent_args("PR 1"), at=at("22:12"), code="JOURNAL_FAULTS")


class IntentTests(Base):
    def test_intent_before_go_is_refused(self):
        new(self.dir)
        self.refused(*intent_args("PR 1"), code="NOT_STARTED")

    def test_intent_needs_a_passed_rehearsal_or_an_owner_override(self):
        started(self.dir, rehearsal="none")
        self.assertIn("rehearsal", self.refused(*intent_args("PR 1"), at=at("22:10"), code="NO_REHEARSAL"))
        other = self.folder("override")
        started(other, rehearsal="owner-override")
        self.ok(intent(other, "PR 1", at("22:10")))

    def test_intent_needs_an_item_and_a_command(self):
        started(self.dir)
        self.refused("log", "intent", "--item", "PR 1", "--head", SHA, at=at("22:10"), code="INTENT_FIELDS")
        self.refused("log", "intent", "--command", merge("PR 1"), "--head", SHA, at=at("22:10"), code="ITEM_MISSING")

    def test_second_intent_while_the_first_has_no_result_is_refused(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        out = self.refused(*intent_args("PR 1"), at=at("22:12"), code="OPEN_INTENT")
        for text in ("E3", at("22:10"), merge("PR 1"), "no result", "status"):
            self.assertIn(text, out)

    def test_unknown_result_blocks_a_new_intent_until_a_new_result(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.ok(run(self.dir, "log", "result", "--of", "3", "--outcome", "unknown", "timeout", at=at("22:11")))
        self.assertIn("is unknown", self.refused(*intent_args("PR 1"), at=at("22:12"), code="UNKNOWN_RESULT"))
        self.ok(run(self.dir, "log", "result", "--of", "E3", "--outcome", "failed", "not merged", at=at("22:13")))
        self.ok(intent(self.dir, "PR 1", at("22:14")))

    def test_a_final_result_cannot_change_and_a_result_needs_an_intent(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.ok(run(self.dir, "log", "result", "--of", "3", "--outcome", "done", "merged", at=at("22:11")))
        out = self.refused("log", "result", "--of", "3", "--outcome", "failed", at=at("22:12"), code="RESULT_FINAL")
        self.assertIn("already has the result", out)
        self.refused("log", "result", "--of", "2", "--outcome", "done", at=at("22:12"), code="RESULT_NOT_INTENT")
        self.refused("log", "result", "--of", "x", "--outcome", "done", at=at("22:12"), code="EVENT_ID")
        self.refused("log", "result", "--of", "3", at=at("22:12"), code="RESULT_FIELDS")
        self.refused("log", "result", "--of", "3", "--outcome", "pass", at=at("22:12"), code="RESULT_FIELDS")

    def test_decision_needs_a_source_or_an_owner_check(self):
        started(self.dir)
        out = self.refused("log", "decision", "keep the old name", at=at("22:10"), code="DECISION_SOURCE")
        self.assertIn("needs --source", out)
        self.refused("log", "decision", "--check", at=at("22:10"), code="TEXT_MISSING")
        self.ok(run(self.dir, "log", "decision", "keep it", "--check", at=at("22:11")))

    def test_resolves_names_an_open_wait_row(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "wait", "needs a review", "--item", "PR 2", at=at("22:10")))
        self.refused("log", "decision", "x", "--check", "--resolves", "E2", at=at("22:11"), code="RESOLVES_NOT_OPEN_WAIT")
        self.ok(run(self.dir, "log", "decision", "reviewed", "--source", "rule 1", "--resolves", "E3", at=at("22:12")))
        self.refused("log", "decision", "x", "--check", "--resolves", "E3", at=at("22:13"), code="RESOLVES_NOT_OPEN_WAIT")
        self.refused("log", "aware", "x", "--resolves", "E3", at=at("22:13"), code="ARG_NOT_FOR_KIND")


class WordsTests(Base):
    def test_amend_and_answer_need_the_exact_words_from_a_file(self):
        started(self.dir)
        self.refused("log", "amend", "--reopen", "PR 3", at=at("22:10"), code="WORDS_MISSING")
        out = self.refused("log", "amend", "yes", "--words-file", words_file(self.dir, "no"), at=at("22:10"),
                           code="WORDS_AS_ARGUMENT")
        self.assertIn("not as an argument", out)
        self.refused("log", "amend", "yes", "--reopen", "PR 3", at=at("22:10"), code="WORDS_AS_ARGUMENT")
        self.refused("log", "answer", "Q1: A", at=at("22:10"), code="WORDS_AS_ARGUMENT")
        self.refused("log", "answer", at=at("22:10"), code="WORDS_MISSING")
        self.refused("log", "amend", "--words-file", words_file(self.dir, "\n"), at=at("22:10"), code="WORDS_EMPTY")
        self.ok(amend(self.dir, "stop at 05:00", when=at("22:11")))
        self.assertEqual(self.events()[-1]["words"], "stop at 05:00")

    def test_an_argument_that_is_not_utf8_is_refused(self):
        started(self.dir)
        done = subprocess.run([os.fsencode(a) for a in argv(self.dir, "log", "alive")] + [b"bad \xff byte"],
                              capture_output=True, env=env_for(at("22:10")), check=False)
        out = (done.stdout + done.stderr).decode("utf-8", "replace")
        self.assertEqual((done.returncode, code_of(out)), (3, ["BAD_ARGUMENT"]), out)


class CheckTests(Base):
    def test_each_broken_journal_fails_check_with_its_code(self):
        self.hand_edit = True
        for name, (events, expected) in BROKEN.items():
            with self.subTest(name=name):
                folder = self.folder(re.sub(r"\W+", "-", name))
                code, out = check_broken(folder, events)
                self.assertEqual(code, 1, out)
                wanted = [expected] if isinstance(expected, str) else expected
                self.assertEqual([c for c in code_of(out) if c in wanted or c not in UNFINISHED], wanted, out)

    def test_good_night_passes_check(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "alive", "working", at=at("22:40")))
        self.ok(intent(self.dir, "PR 1", at("23:10")))
        self.ok(run(self.dir, "log", "result", "--of", "4", "--outcome", "done", "merged", at=at("23:11")))
        code, out = run(self.dir, "check", at=at("23:40"))
        self.assertEqual((code, out.strip()), (0, "check: OK"))

    def test_check_now_finds_a_silent_period_up_to_now(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "alive", "x", at=at("22:30")))
        self.assertEqual(run(self.dir, "check", at=at("23:50"))[0], 0)
        code, out = run(self.dir, "check", "--now", at=at("23:50"))
        self.assertEqual((code, code_of(out)), (1, ["GAP"]), out)
        self.assertIn("gap of 80 min from E3 to now", out)

    def test_plain_check_finds_a_passed_stop_time_but_no_gap_to_now(self):
        started(self.dir, stop="2026-01-10T23:00")
        self.ok(run(self.dir, "log", "alive", "x", at=at("22:30")))
        code, out = run(self.dir, "check", at=at("23:50"))
        self.assertEqual((code, code_of(out)), (1, ["STOP_NOT_CLOSED"]), out)

    def test_check_now_after_a_dead_session_does_not_stop_at_the_stop_time(self):
        self.expect = {"GAP"}
        started(self.dir)
        self.ok(run(self.dir, "log", "alive", "x", at=at("05:30", "2026-01-11")))
        code, out = run(self.dir, "check", "--now", at=at("13:00", "2026-01-11"))
        self.assertEqual(code, 1, out)
        self.assertIn("gap of 450 min", out)
        self.assertIn("STOP_NOT_CLOSED", code_of(out))

    def test_a_cut_last_line_stops_each_write_until_repair(self):
        cuts = {"a cut half line": '{"id": 3, "t": "2026',
                "a full entry with no newline": json.dumps({"id": 3, "t": at("22:05"), "kind": "alive"})}
        for label, tail in cuts.items():
            with self.subTest(cut=label):
                folder = self.folder(f"cut-{len(tail)}")
                started(folder)
                with open(os.path.join(folder, "journal.jsonl"), "a", encoding="utf-8") as handle:
                    handle.write(tail)
                code, out = run(folder, "check", at=at("22:10"))
                self.assertEqual((code, code_of(out)), (3, ["TORN_LINE"]), out)
                self.refused("log", "alive", "x", at=at("22:10"), code="TORN_LINE", folder=folder)
                self.refused("status", at=at("22:10"), code="TORN_LINE", folder=folder)
                self.ok(run(folder, "repair", at=at("22:11")))
                self.refused("repair", at=at("22:12"), code="REPAIR_NOTHING", folder=folder)
                cut = [f for f in os.listdir(folder) if f.startswith("journal.cut-")]
                self.assertEqual(len(cut), 1)
                with open(os.path.join(folder, cut[0]), encoding="utf-8") as handle:
                    self.assertEqual(handle.read(), tail)
                self.assertEqual(read_events(folder)[-1]["kind"], "repair")
                self.assertEqual(run(folder, "check", at=at("22:12"))[0], 0)

    def test_a_broken_line_inside_the_journal_stops_each_command(self):
        self.hand_edit = True
        started(self.dir)
        with open(os.path.join(self.dir, "journal.jsonl"), "a", encoding="utf-8") as handle:
            handle.write("not json\n")
        code, out = run(self.dir, "check", at=at("22:10"))
        self.assertEqual((code, code_of(out)), (3, ["BAD_LINE"]), out)
        self.refused("log", "alive", "x", at=at("22:10"), code="BAD_LINE")

    def test_an_entry_with_a_bad_shape_is_a_schema_fault_not_a_crash(self):
        self.hand_edit = True
        intent_row = {"t": at("22:10"), "kind": "intent", "item": "PR 1", "command": merge("PR 1"), "head": SHA}
        cases = {
            "intent with no item": ({**intent_row, "item": None}, "SCHEMA"),
            "result with no outcome": ({"t": at("22:10"), "kind": "result", "of": 2}, "SCHEMA"),
            "result of as text": ({"t": at("22:10"), "kind": "result", "of": "2", "outcome": "done"}, "SCHEMA"),
            "result outcome pass": ({"t": at("22:10"), "kind": "result", "of": 2, "outcome": "pass"}, "SCHEMA"),
            "result with an item": ({**intent_row, "kind": "result", "of": 2, "outcome": "done"}, "SCHEMA"),
            "heartbeat as text": ({**GO, "t": at("22:10"), "heartbeat_min": "30"}, "SCHEMA"),
            "rehearsal yes": ({**GO, "t": at("22:10"), "rehearsal": "yes"}, "SCHEMA"),
            "go with no stop": ({**{k: v for k, v in GO.items() if k != "stop"}, "t": at("22:10")}, "SCHEMA"),
            "pagecheck named layout": ({"t": at("22:10"), "kind": "pagecheck", "name": "layout", "outcome": "pass",
                                        "report": 2}, "SCHEMA"),
            "close reason done": ({"t": at("22:10"), "kind": "close", "reason": "done"}, "SCHEMA"),
            "report with no counts": ({"t": at("22:10"), "kind": "report"}, "SCHEMA"),
            "wait with no item": ({"t": at("22:10"), "kind": "wait", "text": "x"}, "SCHEMA"),
            "time of day only": ({"t": "06:00", "kind": "alive"}, "SCHEMA"),
            "an unknown kind": ({"t": at("22:10"), "kind": "nap"}, "SCHEMA"),
            "a time with no offset": ({"t": "2026-01-10T22:10:00", "kind": "alive"}, "SCHEMA"),
            "an unknown field": ({"t": at("22:10"), "kind": "alive", "note": "x"}, "SCHEMA"),
            "reopen on a note": ({"t": at("22:10"), "kind": "aware", "text": "x", "reopen": "PR 3"}, "SCHEMA"),
            "no time": ({"kind": "alive"}, "SCHEMA"),
            "denied with no item": ({"t": at("22:10"), "kind": "denied", "command": "m", "blocks": "x"}, "SCHEMA"),
            "hold with no item": ({"t": at("22:10"), "kind": "hold", "text": "x"}, "SCHEMA"),
            "pagecheck with no report": ({"t": at("22:10"), "kind": "pagecheck", "name": "truth", "outcome": "pass"}, "SCHEMA"),
            "close with no reason": ({"t": at("22:10"), "kind": "close"}, "SCHEMA"),
            "repair with no side file": ({"t": at("22:10"), "kind": "repair", "bytes": 3}, "SCHEMA"),
            "text that is not UTF-8": ({"t": at("22:10"), "kind": "alive", "text": "\udcff"}, "SCHEMA"),
            "no kind": ({"t": at("22:10")}, "SCHEMA"),
        }
        for name, (row, expected) in cases.items():
            with self.subTest(case=name):
                folder = self.folder("schema-" + re.sub(r"\W+", "-", name))
                row = {k: v for k, v in row.items() if v is not None}
                write(folder, journal(row))
                code, out = run(folder, "check", at=at("22:11"))
                self.assertEqual((code, code_of(out)), (3, [expected]), out)
                self.assertNotIn("Traceback", out)
                self.refused("log", "alive", "x", at=at("22:11"), code=expected, folder=folder)
        for name, events in (("no id", [*journal(), {"t": at("22:10"), "kind": "alive"}]),
                             ("format 2", [{**journal()[0], "format": 2}])):
            with self.subTest(case=name):
                folder = self.folder("schema-" + re.sub(r"\W+", "-", name))
                write(folder, events)
                code, out = run(folder, "check", at=at("22:11"))
                self.assertEqual((code, code_of(out)), (3, ["SCHEMA"]), out)
        for name, text in (("a string id", '{"id": "2", "t": "%s", "kind": "alive"}\n' % at("22:10")),
                           ("a list", "[1, 2]\n"), ("a blank line", "\n"), ("NUL bytes", "\x00\x00\n")):
            with self.subTest(case=name):
                folder = self.folder("line-" + re.sub(r"\W+", "-", name))
                write(folder, journal())
                with open(os.path.join(folder, "journal.jsonl"), "a", encoding="utf-8") as handle:
                    handle.write(text)
                code, out = run(folder, "check", at=at("22:11"))
                self.assertEqual(code, 3, out)
                self.assertIn(code_of(out)[0], ("BAD_LINE", "SCHEMA"), out)
                self.assertNotIn("Traceback", out)

    def test_a_missing_or_old_report_file_is_found_and_made_again(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))
        os.remove(os.path.join(self.dir, "report.md"))
        code, out = run(self.dir, "check", at=at("22:11"))
        self.assertEqual((code, code_of(out)), (1, ["REPORT_FILE"]), out)
        self.ok(run(self.dir, "render", at=at("22:11")))
        self.assertEqual(run(self.dir, "check", at=at("22:11"))[0], 0)
        first = read_report(self.dir)
        with open(os.path.join(self.dir, "report.md"), "a", encoding="utf-8") as handle:
            handle.write("hand edit\n")
        self.assertEqual(code_of(run(self.dir, "check", at=at("22:11"))[1]), ["REPORT_FILE"])
        self.ok(run(self.dir, "log", "aware", "x", at=at("22:12")))
        self.ok(run(self.dir, "report", at=at("22:13")))
        with open(os.path.join(self.dir, "report.md"), "w", encoding="utf-8") as handle:
            handle.write(first)  # a crash after the second report event, before its file write
        self.assertEqual(code_of(run(self.dir, "check", at=at("22:14"))[1]), ["REPORT_FILE"])
        self.ok(run(self.dir, "render", at=at("22:14")))
        before_close = read_report(self.dir)
        self.ok(run(self.dir, "close", "--reason", "nothing-left", "--without-page", "test", at=at("22:15")))
        with open(os.path.join(self.dir, "report.md"), "w", encoding="utf-8") as handle:
            handle.write(before_close)  # a crash after the close event, before its file write
        self.assertEqual(code_of(run(self.dir, "check", at=at("22:16"))[1]), ["REPORT_FILE"])
        self.ok(run(self.dir, "render", at=at("22:16")))
        self.assertIn("ended at the close", read_report(self.dir))
        self.assertEqual(run(self.dir, "check", at=at("22:16"))[0], 0)
        self.assertEqual(sorted(os.listdir(self.dir)), ["card.md", "journal.jsonl", "report.md"])

    def test_a_write_error_has_a_code(self):
        """A file size limit makes the append fail, also for root (a chmod does not stop root)."""
        import resource
        started(self.dir)
        size = os.path.getsize(os.path.join(self.dir, "journal.jsonl"))
        before = journal_bytes(self.dir)

        def limit():
            resource.setrlimit(resource.RLIMIT_FSIZE, (size, size))
        done = subprocess.run(argv(self.dir, "log", "alive", "x"), capture_output=True, text=True,
                              env=env_for(at("22:10")), preexec_fn=limit, check=False)
        out = done.stdout + done.stderr
        self.assertEqual((done.returncode, code_of(out)), (3, ["WRITE_FAILED"]), out)
        self.assertNotIn("Traceback", out)
        self.assertEqual(journal_bytes(self.dir), before)

    def test_an_error_that_no_rule_expects_gives_a_code_and_no_traceback(self):
        self.hand_edit = True
        os.makedirs(os.path.join(self.dir, "journal.jsonl"))
        code, out = run(self.dir, "check")
        self.assertEqual((code, code_of(out)), (3, ["INTERNAL"]), out)
        self.assertNotIn("Traceback", out)

    def test_each_command_but_new_needs_a_night(self):
        os.makedirs(self.dir)
        for command in (["check"], ["check", "--now"], ["status"], ["report"], ["render"], ["repair"],
                        ["close", "--reason", "stopped"], ["log", "alive", "x"], go_args()):
            with self.subTest(command=command):
                self.refused(*command, code="NO_NIGHT")

    def test_more_broken_journals(self):
        self.hand_edit = True
        cases = {
            "a recorded maximum above the default": (journal(go_at(heartbeat_min=300, gap_min=600, max_gap_min=600),
                                                             {"t": at("23:45"), "kind": "alive"}), ["GAP_TOO_HIGH", "GAP"]),
            "a name with a bar": (journal(go_at(items=[["a|b", "owner"]])), ["ITEM_NAME"]),
        }
        for name, (events, expected) in cases.items():
            with self.subTest(name=name):
                code, out = check_broken(self.folder("b-" + re.sub(r"\W+", "-", name)), events)
                self.assertEqual((code, code_of(out)), (1, expected), out)

    def test_wrong_type_of_each_field_is_a_schema_fault(self):
        self.hand_edit = True
        full = [go_at(), {**INTENT, "t": at("22:10"), "item": "PR 1"},
                {"t": at("22:11"), "kind": "result", "of": 3, "outcome": "denied", "blocks": "x", "text": "y"},
                {"t": at("22:12"), "kind": "decision", "text": "x", "source": "r", "check": True, "item": "PR 1"},
                {"t": at("22:13"), "kind": "amend", "words": "w", "reopen": "PR 1", "add_item": ["PR 7", "owner"]},
                {"t": at("22:14"), "kind": "report", "counts": {"new": 1}},
                {"t": at("22:15"), "kind": "close", "reason": "stopped", "without_page": "x"}]
        wrong = {str: 5, int: "x", bool: "x", list: "x", dict: "x"}
        for index, row in enumerate(full):
            for field, value in row.items():
                if field == "kind":
                    continue
                with self.subTest(kind=row["kind"], field=field):
                    folder = self.folder(f"w-{index}-{field}")
                    rows = [dict(r) for r in full[:index + 1]]
                    rows[index][field] = wrong[type(value)]
                    write(folder, journal(*rows))
                    code, out = run(folder, "check", at=at("22:30"))
                    self.assertEqual((code, code_of(out)), (3, ["SCHEMA"]), out)

    def test_a_second_repair_keeps_the_first_side_file_and_the_entries(self):
        started(self.dir)
        path = os.path.join(self.dir, "journal.jsonl")
        for n, tail in enumerate(("first cut", "second cut"), 1):
            with open(path, "a", encoding="utf-8") as handle:
                handle.write(tail)
            self.ok(run(self.dir, "repair", at=at("22:1%d" % n)))
        self.assertEqual([e["kind"] for e in self.events()], ["new", "go", "repair", "repair"])
        cuts = sorted(f for f in os.listdir(self.dir) if f.startswith("journal.cut-"))
        texts = []
        for name in cuts:
            with open(os.path.join(self.dir, name), encoding="utf-8") as handle:
                texts.append(handle.read())
        self.assertEqual(texts, ["first cut", "second cut"])


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


class RaceTests(Hooked):
    def test_eight_writers_at_one_gate_lose_no_entry(self):
        started(self.dir)
        for _ in range(3):
            outcomes = self.gated(8, ["log", "alive", "writer"], at("22:10"))
            self.assertEqual([code for code, _ in outcomes], [0] * 8, outcomes)
        self.assertEqual([e["id"] for e in self.events()], list(range(1, 27)))

    def test_eight_intents_on_one_item_at_one_gate_give_one_intent(self):
        started(self.dir)
        for _ in range(3):
            outcomes = self.gated(8, intent_args("PR 1"), at("22:10"))
            self.assertEqual(sorted(code for code, _ in outcomes), [0] + [3] * 7, outcomes)
            self.assertEqual(sum(code_of(out) == ["OPEN_INTENT"] for _, out in outcomes), 7, outcomes)
            last = [e for e in self.events() if e["kind"] == "intent"][-1]["id"]
            self.ok(run(self.dir, "log", "result", "--of", str(last), "--outcome", "failed", at=at("22:10")))
        self.assertEqual(sum(1 for e in self.events() if e["kind"] == "intent"), 3)

    def plant_lock(self, text, age_s=0):
        lock = os.path.join(self.dir, "journal.lock")
        with open(lock, "w", encoding="utf-8") as handle:
            handle.write(text)
        if age_s:
            old = time.time() - age_s
            os.utime(lock, (old, old))
        return lock

    def test_a_held_or_stale_lock_is_named_and_never_removed(self):
        started(self.dir)
        fast = {"NIGHT_LOCK_WAIT_S": "0.3"}
        lock = self.plant_lock(str(os.getpid()))
        self.assertIn(f"process {os.getpid()}", self.refused("log", "alive", "x", at=at("22:10"), env=fast, code="LOCK_HELD"))
        with open(lock, encoding="utf-8") as handle:
            self.assertEqual(handle.read(), str(os.getpid()), "a held lock must stay as it is")
        for text, age, shown in (("999999999", 0, "process 999999999 is not running"), ("0", 0, "no process id ('0')"),
                                 ("", 0, "no process id ('')"), (str(os.getpid()), 120, f"process {os.getpid()} has held it")):
            with self.subTest(lock=text, age=age):
                self.plant_lock(text, age)
                out = self.refused("log", "alive", "x", at=at("22:10"), env=fast, code="LOCK_STALE")
                self.assertIn(shown, out)
                self.assertIn(f"remove {lock} by hand", out)
                self.assertTrue(os.path.exists(lock))
        self.refused("check", at=at("22:10"), env=fast, code="LOCK_STALE")
        os.remove(lock)

    def test_a_waiter_that_is_stopped_leaves_the_lock_of_another_process(self):
        started(self.dir)
        lock = self.plant_lock(str(os.getpid()))
        proc = subprocess.Popen(argv(self.dir, "log", "alive", "x"), env=env_for(at("22:10"), extra={"NIGHT_LOCK_WAIT_S": "20"}),
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        time.sleep(0.5)
        proc.send_signal(signal.SIGTERM)
        proc.communicate(timeout=30)
        self.assertTrue(os.path.exists(lock))
        os.remove(lock)
        self.assertEqual(len(self.events()), 2)

    def test_lock_holder_is_named_and_term_releases_and_kill_leaves_a_stale_lock(self):
        started(self.dir)
        lock = os.path.join(self.dir, "journal.lock")
        fast = {"NIGHT_LOCK_WAIT_S": "0.3"}
        marker, (holder,) = self.hooked("hold-fsync", ["log", "alive", "x"], at("22:10"))
        self.wait_markers(marker, "held")
        with open(lock, encoding="utf-8") as handle:
            self.assertEqual(handle.read(), str(holder.pid))
        self.assertIn(f"process {holder.pid}", self.refused("log", "alive", "y", at=at("22:10"), env=fast, code="LOCK_HELD"))
        holder.send_signal(signal.SIGTERM)
        holder.communicate(timeout=30)
        self.assertFalse(os.path.exists(lock), "SIGTERM must release the lock of the holder")
        self.assertEqual(run(self.dir, "check", at=at("22:11"))[0], 0)
        marker, (holder,) = self.hooked("hold-fsync", ["log", "alive", "x"], at("22:12"))
        self.wait_markers(marker, "held")
        holder.kill()
        holder.communicate(timeout=30)
        out = self.refused("log", "alive", "y", at=at("22:12"), env=fast, code="LOCK_STALE")
        self.assertIn(f"process {holder.pid} is not running", out)
        self.assertTrue(os.path.exists(lock))
        os.remove(lock)

    def test_a_kill_between_the_report_entry_and_its_file_is_found_and_render_cleans_up(self):
        started(self.dir)
        marker, (proc,) = self.hooked("hold-replace", ["report"], at("22:10"))
        self.wait_markers(marker, "held")
        proc.kill()
        proc.communicate(timeout=30)
        self.assertEqual(self.events()[-1]["kind"], "report")
        os.remove(os.path.join(self.dir, "journal.lock"))
        code, out = run(self.dir, "check", at=at("22:11"))
        self.assertEqual((code, code_of(out)), (1, ["REPORT_FILE"]), out)
        self.ok(run(self.dir, "render", at=at("22:11")))
        self.assertEqual(sorted(os.listdir(self.dir)), ["card.md", "journal.jsonl", "report.md"])
        self.assertEqual(run(self.dir, "check", at=at("22:11"))[0], 0)

    def test_an_empty_lock_that_goes_away_during_the_wait_is_not_stale(self):
        started(self.dir)
        lock = self.plant_lock("")
        proc = subprocess.Popen(argv(self.dir, "log", "alive", "x"), env=env_for(at("22:10")), stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, text=True)
        time.sleep(0.6)
        os.remove(lock)
        out, err = proc.communicate(timeout=30)
        self.assertEqual(proc.returncode, 0, out + err)

    def test_the_time_of_an_entry_is_read_after_the_wait_for_the_lock(self):
        self.ok(run(self.dir, "new", "--words-file", words_file(self.dir, "w"), fake=False))
        lock = self.plant_lock(str(os.getpid()))
        proc = subprocess.Popen(argv(self.dir, "log", "aware", "x"), env=env_for(fake=False, extra={"NIGHT_LOCK_WAIT_S": "20"}),
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        time.sleep(2.5)
        released = time.time()
        os.remove(lock)
        out, err = proc.communicate(timeout=30)
        self.assertEqual(proc.returncode, 0, out + err)
        written = datetime.fromisoformat(self.events()[-1]["t"]).timestamp()
        self.assertGreaterEqual(written, released - 1, "the entry has a time from before the wait for the lock")

    def test_outside_test_mode_the_lock_wait_is_the_default(self):
        """A project cannot make the lock wait shorter or a lock stale sooner: the times come from night.py."""
        self.ok(run(self.dir, "new", "--words-file", words_file(self.dir, "w"), test_mode=False, fake=False))
        lock = self.plant_lock(str(os.getpid()))
        start = time.monotonic()
        code, out = run(self.dir, "log", "aware", "x", env={"NIGHT_LOCK_WAIT_S": "0.1", "NIGHT_LOCK_STALE_S": "0"},
                        test_mode=False, fake=False)
        self.assertEqual((code, code_of(out)), (3, ["LOCK_HELD"]), out)
        self.assertGreaterEqual(time.monotonic() - start, 5)
        os.remove(lock)

    def test_each_reader_takes_the_lock(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:05")))
        lock = self.plant_lock("999999999")
        for command in (["status"], ["check"], ["render"], ["report"], ["repair"]):
            with self.subTest(command=command):
                self.refused(*command, at=at("22:10"), env={"NIGHT_LOCK_WAIT_S": "0.2"}, code="LOCK_STALE")
        os.remove(lock)


class CrashTests(Hooked):
    """Findings of the consultant review of b315b63 (P2-3, P2-4)."""

    def test_a_short_write_of_the_journal_is_finished_or_refused(self):
        started(self.dir)
        marker, (proc,) = self.hooked("short-write", ["log", "alive", "x"], at("22:10"))
        out, err = proc.communicate(timeout=60)
        self.wait_markers(marker, "short")
        self.assertEqual(proc.returncode, 0, out + err)
        self.assertEqual([e["kind"] for e in self.events()][-1], "alive")

    def test_a_refused_repair_leaves_the_journal_as_it_was(self):
        self.hand_edit = True
        started(self.dir)
        self.ok(run(self.dir, "log", "alive", "x", at=at("22:10")))
        with open(os.path.join(self.dir, "journal.jsonl"), "a", encoding="utf-8") as handle:
            handle.write('{"id": 4, "t"')
        before = journal_bytes(self.dir)
        code, out = run(self.dir, "repair", at=at("22:05"))  # no parity copy: the event is judged on the cut journal
        self.assertEqual((code, code_of(out)), (3, ["TIME_BACK"]), out)
        self.assertEqual(journal_bytes(self.dir), before, "a refused repair changed the journal")
        self.assertEqual([f for f in os.listdir(self.dir) if f.startswith("journal.cut-")], [])
        self.ok(run(self.dir, "repair", at=at("22:11")))
        self.assertEqual(self.events()[-1]["kind"], "repair")
        self.assertEqual(run(self.dir, "check", at=at("22:12"))[0], 0)

    def test_a_crash_after_the_repair_cut_is_found_and_recorded(self):
        started(self.dir)
        with open(os.path.join(self.dir, "journal.jsonl"), "a", encoding="utf-8") as handle:
            handle.write('{"id": 3, "t"')
        marker, (proc,) = self.hooked("die-after-truncate", ["repair"], at("22:10"))
        proc.communicate(timeout=60)
        self.wait_markers(marker, "cut")
        os.remove(os.path.join(self.dir, "journal.lock"))
        code, out = run(self.dir, "check", at=at("22:11"))
        self.assertEqual((code, code_of(out)), (1, ["CUT_UNRECORDED"]), out)
        self.ok(run(self.dir, "repair", at=at("22:11")))
        self.assertEqual(self.events()[-1]["cut_file"], "journal.cut-1.txt")
        self.assertEqual(run(self.dir, "check", at=at("22:12"))[0], 0)


class AdvisorThreeTests(Base):
    """Findings of advisor point 3 (review of b315b63): each test kills a mutant that lived."""

    def test_the_closed_record_shows_a_failed_page_check_and_the_reason_of_the_close(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))  # E3
        self.ok(run(self.dir, "log", "pagecheck", "--name", "truth", "--outcome", "fail", "--report", "E3", "two numbers",
                    at=at("22:11")))
        self.ok(run(self.dir, "close", "--reason", "nothing-left", "--without-page", "no page tool", at=at("22:12")))
        after = part(read_report(self.dir), "## After E3", "## Permissions")
        self.assertIn("check truth of E3: fail; two numbers", after)
        self.assertIn("reason nothing-left; no checked page: no page tool", after)

    def test_a_close_reason_of_spaces_or_nothing_does_not_skip_the_page_checks(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))
        for reason in (" ", ""):
            with self.subTest(reason=reason):
                self.refused("close", "--reason", "nothing-left", "--without-page", reason, at=at("22:11"), code="PAGE_CHECKS")

    def test_each_part_of_the_report_shows_its_rows(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))  # E3
        self.ok(run(self.dir, "log", "result", "--of", "3", "--outcome", "done", "merged", at=at("22:11")))
        self.ok(intent(self.dir, "PR 2", at("22:12")))  # E5
        self.ok(run(self.dir, "log", "result", "--of", "5", "--outcome", "failed", "conflict", at=at("22:13")))
        self.ok(run(self.dir, "log", "aware", "a note for you", "--item", "PR 2", at=at("22:14")))
        self.ok(run(self.dir, "log", "hold", "owner-only file", "--item", "PR 12", at=at("22:15")))
        self.ok(intent(self.dir, "PR 3", at("22:16")))  # E9, no result
        with open(os.path.join(self.dir, "journal.jsonl"), "a", encoding="utf-8") as handle:
            handle.write('{"id": 10, "t"')
        self.ok(run(self.dir, "repair", at=at("22:17")))  # E10
        self.ok(run(self.dir, "report", at=at("22:18")))  # E11
        report = read_report(self.dir)
        self.assertIn("Go: 2026-01-10T22:01:00+00:00. Stop time: 2026-01-11T06:00:00+00:00", report)
        self.assertIn("| org/one#3 | commit |", part(report, "## Items", "## Needs you"))
        needs = part(report, "## Needs you", "## My errors")
        self.assertIn("| PR 12 | held: owner-only file |", needs)
        self.assertIn("| PR 3 | intent with no result |", needs)
        self.assertIn("| PR 1 | gh pr merge", part(report, "## Done and not reversible", "## Failed"))
        self.assertIn("merged", part(report, "## Done and not reversible", "## Failed"))
        self.assertIn("conflict", part(report, "## Failed", "## Owner messages"))
        self.assertIn("| PR 2 | a note for you |", part(report, "## Notes for the owner", "## Stops and gaps"))
        self.assertIn("repair at E10: 14 cut bytes moved to journal.cut-1.txt", part(report, "## Stops and gaps", "## Decisions"))
        counts = part(report, "## Counts (report E11)", "## Permissions")
        self.assertIn("| intent | 3 |", counts)
        self.assertIn("| report | 1 |", counts)
        self.assertNotIn("## After", report)

    def test_a_stop_time_in_a_wrong_form_has_a_code(self):
        new(self.dir)
        card(self.dir)
        for stop in ("tomorrow", "25:00+07:00", "2026-13-01T06:00+07:00"):
            with self.subTest(stop=stop):
                self.refused("go", "--stop", stop, "--goal", "set", "--rehearsal", "passed", at=at("22:01"), code="STOP_NO_OFFSET")

    def test_a_hand_written_commit_row_with_no_option_gives_codes_not_a_crash(self):
        self.hand_edit = True
        write(self.dir, journal(go_at(items=[["PR 1", "commit"]]), {**INTENT, "t": at("22:10"), "item": "PR 1"},
                                result("22:11", 3)))
        code, out = run(self.dir, "check", at=at("22:12"))
        self.assertEqual(code, 1, out)
        self.assertIn("HEAD_OPTION_MISSING", code_of(out))
        self.assertNotIn("INTERNAL", out)
        self.ok(run(self.dir, "status", at=at("22:12")))

    def test_random_journals_that_pass_the_schema_crash_nothing(self):
        """A fixed-seed fuzz of the fold, the views and the rules (advisor point 3, F5)."""
        m, rng = night_module(), random.Random(1)
        start = datetime(2026, 1, 10, 22, 0, tzinfo=timezone.utc)
        names = ["PR 1", "PR 2", "notice", "PR 4", "ghost"]
        rows = [["PR 1", "commit", OPT], ["PR 1", "commit"], ["PR 2", "commit", "--m"], ["notice", "no-commit"],
                ["PR 4", "owner"], ["PR 4", "owner", "--x"], ["pr 1", "owner"], ["", "owner"], ["a|b", "merge"]]

        def value(spec, n):
            if isinstance(spec, tuple):
                return rng.choice(spec)
            return {"str": lambda: rng.choice(names + ["", " ", "x", SHA, merge("PR 1")]),
                    "int": lambda: rng.choice([0, 1, 2, 3, n, n - 1, 30, 60, 600, -1]),
                    "bool": lambda: rng.choice([True, False]),
                    "time": lambda: (start + timedelta(minutes=rng.choice([-5, 30, 600]))).isoformat(),
                    "row": lambda: rng.choice(rows), "rows": lambda: rng.sample(rows, rng.randint(0, 4)),
                    "counts": lambda: rng.choice([{}, {"new": 1}, {"new": 1, "go": 1, "report": 1}])}[spec]()

        with tempfile.TemporaryDirectory() as tmp:
            for _ in range(2000):
                when, entries = start, []
                for i in range(1, rng.randint(2, 12) + 1):
                    kind = "new" if i == 1 and rng.random() < 0.9 else ("go" if i == 2 and rng.random() < 0.8
                                                                        else rng.choice(m.KINDS))
                    when += timedelta(minutes=rng.choice([0, 1, 1, 5, 90, -3]))
                    entry = {"id": i if rng.random() < 0.97 else i + 1, "t": when.isoformat(), "kind": kind}
                    for name, spec in m.FIELDS[kind].items():
                        if name in m.REQUIRED.get(kind, ()) or rng.random() < 0.6:
                            entry[name] = value(spec, i)
                    if kind == "intent" and rng.random() < 0.7:
                        entry["item"] = rng.choice(names[:4])
                    if m.schema_problem(entry) is None:
                        entries.append(entry)
                if not entries:
                    continue
                night = m.fold(entries)
                now = start + timedelta(hours=3)
                m.status_data(night, now)
                m.state_problems(night, tmp, now, True)
                if night.reports:
                    m.render(entries)
                for name in names[:4]:
                    m.judge(night, {"id": night.last["id"] + 1, "t": (start + timedelta(hours=2)).isoformat(),
                                    "kind": "intent", "item": name, "command": merge(name), "head": SHA})

    def test_status_of_a_closed_night_prints_the_close_line_and_the_last_entry(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))
        self.ok(run(self.dir, "close", "--reason", "nothing-left", "--without-page", "x", at=at("22:11")))
        out = self.ok(run(self.dir, "status", at=at("22:12")))
        self.assertIn("E4 NIGHT CLOSED night-", out)
        self.assertIn("last: E4 close 2026-01-10T22:11:00+00:00", out)

    def test_a_write_error_after_the_append_names_the_entry(self):
        self.expect = {"REPORT_FILE"}
        started(self.dir)
        os.makedirs(os.path.join(self.dir, "report.md"))
        code, out = run(self.dir, "report", at=at("22:10"))
        self.assertEqual((code, code_of(out)), (3, ["WRITE_FAILED"]), out)
        self.assertIn("entry E3 is in the journal: run `render`", out)
        self.assertEqual(self.events()[-1]["kind"], "report")
        os.rmdir(os.path.join(self.dir, "report.md"))
        self.ok(run(self.dir, "render", at=at("22:11")))
        self.expect = set()

    def test_an_intent_with_an_empty_command_is_refused(self):
        started(self.dir)
        self.refused("log", "intent", "--item", "notice", "--command", "  ", "--no-head", "x", at=at("22:10"),
                     code="INTENT_FIELDS")

    def test_a_reopen_name_is_stripped(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "denied", "--item", "PR 3", "--command", "m", "--blocks", "x", at=at("22:10")))
        self.ok(amend(self.dir, "yes: PR 3", "--reopen", " PR 3 ", when=at("22:11")))
        self.ok(intent(self.dir, "PR 3", at("22:12")))

    def test_a_name_with_a_delete_character_is_refused(self):
        self.ok(new(self.dir))
        card(self.dir, raw="PR\x7f9 | owner")
        self.refused("items", code="ITEM_NAME")

    def test_status_shows_the_stop_its_passing_and_the_entries_that_make_the_report_old(self):
        started(self.dir, stop="2026-01-10T23:00")
        self.ok(run(self.dir, "report", at=at("22:10")))
        self.ok(run(self.dir, "log", "aware", "x", at=at("22:11")))
        data = json.loads(self.ok(run(self.dir, "status", "--json", at=at("22:12"))))
        self.assertEqual((data["stop"], data["stop_passed"], data["report_old_by"]),
                         ("2026-01-10T23:00:00+00:00", False, ["E4"]))
        data = json.loads(self.ok(run(self.dir, "status", "--json", at=at("23:01"))))
        self.assertTrue(data["stop_passed"])

    def test_the_time_from_new_to_go_is_no_gap(self):
        self.ok(new(self.dir, when=at("20:00")))
        card(self.dir)
        self.ok(run(self.dir, *go_args(), at=at("22:01")))
        self.assertEqual(run(self.dir, "check", at=at("22:02"))[0], 0)

    def test_a_tilde_fence_holds_the_items_and_go_prints_them(self):
        self.ok(new(self.dir))
        with open(os.path.join(self.dir, "card.md"), "a", encoding="utf-8") as handle:
            handle.write("\n~~~night-items\nPR 1 | commit | --match-head-commit\nPR 4 | owner\n~~~\n")
        out = self.ok(run(self.dir, *go_args(), at=at("22:01")))
        self.assertIn("  PR 1 | commit | --match-head-commit\n  PR 4 | owner", out)

    def test_a_second_go_by_hand_does_not_change_the_stop_time(self):
        self.hand_edit = True
        write(self.dir, journal(go_at(), go_at("22:05", stop=at("23:00"))))
        data = json.loads(self.ok(run(self.dir, "status", "--json", at=at("22:10"))))
        self.assertEqual(data["stop"], "2026-01-11T06:00:00+00:00")

    def test_a_fake_clock_with_no_test_mode_stops_each_command(self):
        self.ok(new(self.dir))
        card(self.dir)
        for command in (["items"], ["status"]):
            with self.subTest(command=command):
                self.refused(*command, test_mode=False, code="FAKE_CLOCK_NO_TEST")

    def test_a_card_that_is_a_folder_has_a_code(self):
        os.makedirs(os.path.join(self.dir, "card.md"))
        self.refused("items", code="CARD_MISSING")


    def test_outside_test_mode_a_refusal_prints_no_entry(self):
        self.ok(run(self.dir, "new", "--words-file", words_file(self.dir, "w"), test_mode=False, fake=False))
        self.refused("new", "--words-file", words_file(self.dir, "w"), test_mode=False, fake=False, code="NEW_TWICE")

    def test_output_that_the_terminal_cannot_show_is_escaped(self):
        os.makedirs(self.dir)
        card(self.dir, raw="Caf\u00e9 | owner")
        done = subprocess.run([sys.executable, "-X", "utf8=0", "-I", NIGHT, "items", "--dir", self.dir],
                              capture_output=True, env=env_for(extra={"LC_ALL": "C"}), check=False, timeout=60)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn(b"Caf\\xe9 | owner", done.stdout)

    def test_a_new_entry_with_a_bad_shape_is_refused_before_the_rules(self):
        os.makedirs(self.dir)
        m = night_module()
        with self.assertRaises(m.Refused) as caught:
            m.write_entry(self.dir, "new", {"run": 5})
        self.assertEqual(caught.exception.code, "SCHEMA")
        self.assertIsNone(journal_bytes(self.dir))

    def test_a_report_file_that_is_a_folder_is_a_check_code(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))
        os.remove(os.path.join(self.dir, "report.md"))
        os.makedirs(os.path.join(self.dir, "report.md"))
        code, out = run(self.dir, "check", at=at("22:11"))
        self.assertEqual((code, code_of(out)), (1, ["REPORT_FILE"]), out)
        os.rmdir(os.path.join(self.dir, "report.md"))
        self.ok(run(self.dir, "render", at=at("22:11")))


class BoundaryTests(Base):
    """Bounds and edges: each test kills a mutant that the first suite let live (advisor point 2)."""

    def test_after_the_close_a_note_and_an_answer_are_written_and_check_is_ok(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))
        self.ok(run(self.dir, "close", "--reason", "nothing-left", "--without-page", "x", at=at("22:11")))
        self.ok(run(self.dir, "log", "aware", "late note", at=at("22:12")))
        self.ok(run(self.dir, "log", "answer", "--words-file", words_file(self.dir, "Q1: A"), at=at("08:00", "2026-01-11")))
        self.assertEqual([e["kind"] for e in self.events()][-3:], ["close", "aware", "answer"])
        code, out = run(self.dir, "check", at=at("08:01", "2026-01-11"))
        self.assertEqual((code, out.strip()), (0, "check: OK"))

    def test_after_the_stop_a_result_the_page_checks_and_the_close_pass(self):
        started(self.dir, stop="2026-01-10T23:00")
        self.ok(intent(self.dir, "PR 1", at("22:59")))
        self.ok(run(self.dir, "log", "result", "--of", "3", "--outcome", "done", at=at("23:05")))
        self.ok(run(self.dir, "report", at=at("23:06")))
        for name in ("mechanics", "truth", "counts"):
            self.ok(run(self.dir, "log", "pagecheck", "--name", name, "--outcome", "pass", "--report", "E5", at=at("23:07")))
        self.ok(run(self.dir, "close", "--reason", "stop-time", at=at("23:08")))
        self.assertEqual(run(self.dir, "check", at=at("23:09"))[0], 0)

    def test_a_gap_is_not_a_fault_that_stops_intents(self):
        self.expect = {"GAP"}
        started(self.dir)
        self.ok(run(self.dir, "log", "alive", "x", at=at("23:45")))
        self.ok(intent(self.dir, "PR 1", at("23:46")))

    def test_a_gap_is_longer_than_the_alarm_not_equal_to_it(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "alive", "x", at=at("23:01")))
        self.assertEqual(run(self.dir, "check", "--now", at=at("23:01"))[0], 0)
        self.assertEqual(run(self.dir, "check", "--now", at=at("00:01", "2026-01-11"))[0], 0)
        code, out = run(self.dir, "check", "--now", at=at("00:02", "2026-01-11"))
        self.assertEqual((code, code_of(out)), (1, ["GAP"]), out)

    def test_status_lists_each_open_row_of_each_kind(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "hold", "owner-only", "--item", "PR 12", at=at("22:05")))
        self.ok(run(self.dir, "log", "denied", "--item", "PR 12", "--command", "m", "--blocks", "x", at=at("22:06")))
        self.ok(intent(self.dir, "PR 1", at("22:07")))
        data = json.loads(self.ok(run(self.dir, "status", "--json", at=at("22:08"))))
        self.assertEqual((data["open_holds"], data["open_denials"], data["open_intents"]),
                         (["E3 PR 12"], ["E4 PR 12"], ["E5 PR 1"]))

    def test_an_open_intent_or_an_unknown_result_blocks_only_its_item(self):
        """Each block is about the state of its own item: an unknown result of PR 1 says nothing about PR 2."""
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.ok(intent(self.dir, "PR 2", at("22:11")))
        self.ok(run(self.dir, "log", "result", "--of", "3", "--outcome", "unknown", at=at("22:12")))
        self.ok(run(self.dir, "log", "result", "--of", "4", "--outcome", "done", at=at("22:12")))
        self.ok(intent(self.dir, "PR 2", at("22:13")))
        self.refused(*intent_args("PR 1"), at=at("22:14"), code="UNKNOWN_RESULT")

    def test_page_checks_count_only_for_their_report_and_the_newest_outcome_wins(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))  # E3
        ReportTests.page_checks(self, at("22:11"), report="E3")  # E4-E6
        self.ok(run(self.dir, "log", "aware", "late", at=at("22:12")))  # E7
        self.ok(run(self.dir, "report", at=at("22:13")))  # E8
        self.refused("close", "--reason", "nothing-left", at=at("22:14"), code="PAGE_CHECKS")
        ReportTests.page_checks(self, at("22:15"), report="E8")  # E9-E11
        self.ok(run(self.dir, "log", "pagecheck", "--name", "counts", "--outcome", "fail", "--report", "E8", at=at("22:16")))
        self.refused("close", "--reason", "nothing-left", at=at("22:17"), code="PAGE_CHECKS")
        self.ok(run(self.dir, "log", "pagecheck", "--name", "counts", "--outcome", "pass", "--report", "E8", at=at("22:18")))
        self.ok(run(self.dir, "log", "alive", "x", at=at("22:19")))
        self.ok(run(self.dir, "close", "--reason", "nothing-left", at=at("22:20")))

    def test_row_rules_for_the_card_for_add_item_and_for_items(self):
        for raw, code in ((" | owner", "ITEM_NAME"), ("PR 1 | commit | head", "ITEM_OPTION"), ("PR 1 | commit | #", "ITEM_OPTION"),
                          ("PR 1 | merge", "ITEM_KIND"), ("PR 1 | owner\npr 1 | owner", "ITEM_DUPLICATE")):
            with self.subTest(raw=raw):
                folder = self.folder("row-" + re.sub(r"\W+", "-", raw))
                self.ok(new(folder))
                card(folder, raw=raw)
                self.refused("items", code=code, folder=folder)
                self.refused(*go_args(), at=at("22:01"), code=code, folder=folder)
        started(self.dir)
        self.is_refused(amend(self.dir, "also", "--add-item", "PR\x015 | owner", when=at("22:10")), "ITEM_NAME")

    def test_go_bounds(self):
        self.ok(new(self.dir))
        card(self.dir)
        self.refused(*go_args(heartbeat="-5"), "--gap-min", "30", at=at("22:01"), code="HEARTBEAT_NOT_POSITIVE")
        self.refused(*go_args(stop="2026-01-10T22:01"), at=at("22:01"), code="GO_STOP_NOT_FUTURE")

    def test_the_option_is_a_word_of_its_own_in_the_command(self):
        started(self.dir)
        self.refused(*intent_args("PR 1", SHA, f"gh pr merge 1 --no{OPT} {SHA}"), at=at("22:10"), code="HEAD_OPTION_MISSING")

    def test_a_denied_row_needs_each_of_command_and_blocks(self):
        started(self.dir)
        self.refused("log", "denied", "--item", "PR 3", "--command", "m", at=at("22:10"), code="DENIED_FIELDS")
        self.refused("log", "denied", "--item", "PR 3", "--blocks", "x", at=at("22:10"), code="DENIED_FIELDS")

    def test_error_and_reserve_take_only_card_names(self):
        started(self.dir)
        self.refused("log", "error", "x", "--item", "PR 9", at=at("22:10"), code="ITEM_NOT_ON_CARD")
        self.refused("log", "reserve", "x", "--item", "PR 9", at=at("22:10"), code="ITEM_NOT_ON_CARD")

    def test_a_reason_of_spaces_and_a_row_with_no_text_are_refused(self):
        started(self.dir)
        self.refused("log", "intent", "--item", "notice", "--command", "send", "--no-head", "  ", at=at("22:10"),
                     code="NO_COMMIT_NEEDS_REASON")
        for kind in ("wait", "aware", "error"):
            with self.subTest(kind=kind):
                self.refused("log", kind, "--item", "PR 1", at=at("22:10"), code="TEXT_MISSING")

    def test_a_refusal_says_its_class(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "denied", "--item", "PR 3", "--command", "m", "--blocks", "x", at=at("22:10")))
        self.assertIn("final: do not retry", self.refused(*intent_args("PR 3"), at=at("22:11"), code="ITEM_DENIED"))
        self.assertNotIn("final", self.refused(*intent_args("PR 1", "main"), at=at("22:11"), code="HEAD_FORM"))

    def test_the_fence_is_longer_than_each_run_of_backticks(self):
        self.ok(new(self.dir, "a ```` b\n```night-items\nPR 9 | owner\n```"))
        card(self.dir)
        self.ok(run(self.dir, *go_args(), at=at("22:01")))
        self.assertEqual(len(self.events()[-1]["items"]), len(ITEMS))
        self.ok(run(self.dir, "report", at=at("22:02")))
        self.assertIn("`````", read_report(self.dir))

    def test_new_keeps_a_card_that_exists(self):
        os.makedirs(self.dir)
        with open(os.path.join(self.dir, "card.md"), "w", encoding="utf-8") as handle:
            handle.write("# my card\n")
        self.ok(new(self.dir))
        with open(os.path.join(self.dir, "card.md"), encoding="utf-8") as handle:
            self.assertEqual(handle.read(), "# my card\n")


class ReportTests(Base):
    def night_with_report(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 3", at("22:10")))
        self.ok(run(self.dir, "log", "result", "--of", "E3", "--outcome", "denied", "--blocks", "PR 4", at=at("22:11")))
        self.ok(run(self.dir, "log", "wait", "needs the owner's choice", "--item", "PR 2", at=at("22:12")))
        self.ok(run(self.dir, "log", "wait", "needs a review", "--item", "PR 12", at=at("22:13")))
        self.ok(run(self.dir, "log", "decision", "review done", "--item", "PR 12", "--source", "rule 1", "--resolves", "E6",
                    at=at("22:14")))
        self.ok(intent(self.dir, "PR 1", at("22:20")))
        self.ok(run(self.dir, "log", "result", "--of", "8", "--outcome", "unknown", "timeout", at=at("22:21")))
        self.ok(run(self.dir, "log", "error", "I typed a wrong count; corrected", at=at("22:25")))
        self.ok(run(self.dir, "report", at=at("22:30")))  # E11

    def page_checks(self, when, report="E11", outcome="pass"):
        for name in ("mechanics", "truth", "counts"):
            self.ok(run(self.dir, "log", "pagecheck", "--name", name, "--outcome", outcome, "--report", report, at=when))

    def test_report_lists_what_needs_the_owner_and_names_its_event(self):
        self.night_with_report()
        report = read_report(self.dir)
        self.assertIn("Report E11", report)
        needs = part(report, "## Needs you", "## My errors")
        for text in ("PR 3", "denied", "PR 2", "result unknown"):
            self.assertIn(text, needs)
        self.assertNotIn("PR 12", needs)
        self.assertIn("I typed a wrong count", report)
        self.assertIn("The night is not closed", report)

    def test_report_escapes_cells_and_fences_the_owner_words(self):
        self.ok(new(self.dir, "goal: x\n```\n## Needs you\nfake"))
        card(self.dir)
        self.ok(run(self.dir, *go_args(), at=at("22:01")))
        self.ok(amend(self.dir, "```\n## Needs you\nfake", when=at("22:05")))
        self.ok(run(self.dir, "log", "decision", "a <b> | c", "--check", at=at("22:06")))
        self.ok(run(self.dir, "report", at=at("22:07")))
        report = read_report(self.dir)
        self.assertEqual(sum(1 for line in report.splitlines() if line == "## Needs you"), 2)
        self.assertIn("````", report)
        self.assertIn("a &lt;b> \\| c", report)

    def test_report_freezes_its_counts_and_status_prints_them(self):
        self.night_with_report()
        frozen = self.events()[-1]["counts"]
        self.assertEqual(frozen["report"], 1)
        self.assertEqual(sum(frozen.values()), 11)
        self.ok(run(self.dir, "log", "alive", "x", at=at("22:31")))
        self.ok(run(self.dir, "log", "aware", "a note after the report", at=at("22:31")))
        self.assertNotIn("REPORT_FILE", code_of(run(self.dir, "check", at=at("22:31"))[1]))
        out = self.ok(run(self.dir, "status", "--report", "E11", "--json", at=at("22:32")))
        self.assertEqual(json.loads(out)["counts"], frozen)
        self.refused("status", "--report", "E10", at=at("22:32"), code="ID_NOT_REPORT")

    def test_status_lists_what_is_open(self):
        self.night_with_report()
        data = json.loads(self.ok(run(self.dir, "status", "--json", at=at("22:31"))))
        self.assertEqual(data["open_denials"], ["E4 PR 3"])
        self.assertEqual(data["open_waits"], ["E5 PR 2"])
        self.assertEqual(data["unknown_results"], ["E9 PR 1"])
        self.assertEqual((data["open_intents"], data["open_holds"], data["newest_report"]), ([], [], "E11"))

    def test_the_report_shows_the_rule_faults_of_the_journal(self):
        self.hand_edit = True
        write(self.dir, journal(go_at(), go_at("22:05")))
        self.ok(run(self.dir, "report", at=at("22:10")))
        self.assertIn("rule fault at E3: GO_TWICE", part(read_report(self.dir), "## Stops and gaps", "## Decisions to check"))

    def test_status_and_the_open_report_show_faults_and_gaps(self):
        self.hand_edit = True
        write(self.dir, journal(go_at(), go_at("22:05"), {"t": at("23:45"), "kind": "alive"}))
        data = json.loads(self.ok(run(self.dir, "status", "--json", at=at("23:46"))))
        self.assertEqual(data["faults"], ["E3 GO_TWICE"])
        self.assertEqual(len(data["gaps"]), 1)
        self.ok(run(self.dir, "report", at=at("23:46")))
        self.assertIn("gap of 100 min", part(read_report(self.dir), "## Stops and gaps", "## Decisions to check"))

    def test_the_close_note_names_the_gap(self):
        self.expect = {"GAP"}
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))
        out = self.ok(run(self.dir, "close", "--reason", "nothing-left", "--without-page", "x", at=at("23:30")))
        self.assertIn("gap of 80 min", "".join(line for line in out.splitlines() if line.startswith("NOTE:")))

    def test_the_open_report_stays_as_its_report_entry_made_it(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))
        self.ok(run(self.dir, "log", "error", "a late error", at=at("22:11")))
        self.assertEqual(run(self.dir, "check", at=at("22:12"))[0], 0)
        self.ok(run(self.dir, "render", at=at("22:12")))
        self.assertNotIn("a late error", read_report(self.dir))

    def test_report_shows_the_owner_messages_after_the_start(self):
        started(self.dir)
        self.ok(amend(self.dir, "stop at 05:00 please", when=at("22:10")))
        self.ok(run(self.dir, "report", at=at("22:11")))
        self.assertIn("stop at 05:00 please", part(read_report(self.dir), "## Owner messages after the start", "## Notes"))

    def test_page_checks_name_the_newest_report(self):
        self.night_with_report()
        self.refused("log", "pagecheck", "--name", "counts", "--outcome", "pass", at=at("22:31"), code="PAGECHECK_FIELDS")
        self.refused("log", "pagecheck", "--name", "layout", "--outcome", "pass", "--report", "E11", at=at("22:31"),
                     code="PAGECHECK_FIELDS")
        self.refused("log", "pagecheck", "--name", "counts", "--outcome", "pass", "--report", "E10", at=at("22:31"),
                     code="PAGECHECK_REPORT")
        self.ok(run(self.dir, "log", "aware", "late note", at=at("22:32")))
        self.ok(run(self.dir, "report", at=at("22:33")))  # E13
        self.refused("log", "pagecheck", "--name", "counts", "--outcome", "pass", "--report", "E11", at=at("22:34"),
                     code="PAGECHECK_REPORT")

    def test_close_writes_the_record_with_the_gap_and_ended_permissions(self):
        self.expect = {"GAP"}
        self.night_with_report()
        self.ok(run(self.dir, "log", "wait", "owner to choose", "--item", "PR 4", at=at("22:30")))
        self.ok(run(self.dir, "report", at=at("22:31")))  # E13
        self.page_checks(at("22:31"), report="E13")
        out = self.ok(run(self.dir, "close", "--reason", "nothing-left", at=at("23:41")))
        self.assertIn("NIGHT CLOSED night-20260110T2200Z reason nothing-left", out)
        self.assertIn("NOTE:", out)
        self.assertIn("PR 4", "".join(line for line in out.splitlines() if line.startswith("NOTE:")))
        report = read_report(self.dir)
        self.assertIn("Report E13", report)
        self.assertIn("After E13", report)
        self.assertIn("gap of 70 min", part(report, "## Stops and gaps", "## Decisions to check"))
        permissions = report.split("## Permissions")[1]
        self.assertIn("ended at the close", permissions)
        self.assertNotIn("end at the close", permissions)
        self.assertEqual(self.events()[-1]["kind"], "close")
        self.assertEqual(sum(1 for e in self.events() if e["kind"] == "report"), 2)
        self.assertIn("CLOSED", self.refused("report", at=at("23:42"), code="CLOSED"))

    def test_close_needs_a_fresh_report_and_three_passed_page_checks(self):
        started(self.dir)
        self.refused("close", "--reason", "nothing-left", at=at("22:09"), code="REPORT_NONE_YET")
        self.ok(run(self.dir, "report", at=at("22:10")))  # E3
        self.refused("close", "--reason", "nothing-left", at=at("22:11"), code="PAGE_CHECKS")
        self.ok(run(self.dir, "log", "aware", "late note", at=at("22:12")))
        self.refused("log", "pagecheck", "--name", "counts", "--outcome", "pass", "--report", "E3", at=at("22:13"),
                     code="REPORT_OLD")
        self.refused("close", "--reason", "nothing-left", "--without-page", "x", at=at("22:14"), code="REPORT_OLD")
        self.ok(run(self.dir, "report", at=at("22:15")))  # E5
        self.ok(run(self.dir, "log", "pagecheck", "--name", "mechanics", "--outcome", "pass", "--report", "E5", at=at("22:16")))
        self.ok(run(self.dir, "log", "pagecheck", "--name", "truth", "--outcome", "pass", "--report", "E5", at=at("22:16")))
        self.ok(run(self.dir, "log", "pagecheck", "--name", "counts", "--outcome", "fail", "--report", "E5", at=at("22:16")))
        self.refused("close", "--reason", "nothing-left", at=at("22:17"), code="PAGE_CHECKS")
        self.ok(run(self.dir, "log", "pagecheck", "--name", "counts", "--outcome", "pass", "--report", "E5", at=at("22:17")))
        self.ok(run(self.dir, "close", "--reason", "nothing-left", at=at("22:18")))

    def test_close_with_an_open_intent_is_refused(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.ok(run(self.dir, "report", at=at("22:11")))
        out = self.refused("close", "--reason", "stop-time", "--without-page", "test", at=at("22:12"), code="CLOSE_OPEN_INTENT")
        self.assertIn("intents with no result", out)

    def test_after_the_close_only_notes_and_answers(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))
        self.ok(run(self.dir, "close", "--reason", "nothing-left", "--without-page", "no page tool", at=at("22:11")))
        self.assertIn("the night is closed", self.refused(*intent_args("PR 1"), at=at("22:12"), code="CLOSED"))
        self.refused("close", "--reason", "nothing-left", at=at("22:12"), code="CLOSED")
        self.ok(run(self.dir, "log", "answer", "--words-file", words_file(self.dir, "Q1: A"), at=at("08:00", "2026-01-11")))


STUB = "import sys\nprint('check: OK')\nsys.exit(0)\n"


class MetaTests(unittest.TestCase):
    def test_each_journal_read_is_under_the_lock(self):
        """A read outside the lock can act on a journal that another process changes (DQ-917, advisor point 3 F13)."""
        with open(NIGHT, encoding="utf-8") as handle:
            tree = ast.parse(handle.read())
        # read_journal is the read itself; the read() of cmd_repair runs inside the lock of write_entry.
        free = {"read_journal", "read"}
        found = []

        def walk(node, function, locked):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                function, locked = node.name, False
                for default in node.args.defaults:
                    walk(default, "<default>", True)  # a default names the function; it is not a call
                for child in node.body:
                    walk(child, function, locked)
                return
            if isinstance(node, ast.With) and any(isinstance(i.context_expr, ast.Call) and
                                                  getattr(i.context_expr.func, "id", "") == "Lock" for i in node.items):
                locked = True
            if (isinstance(node, ast.Call) and getattr(node.func, "id", "") in ("read_journal", "journal_bytes")
                    and not locked and function not in free):
                found.append(f"{function} line {node.lineno}")
            for child in ast.iter_child_nodes(node):
                walk(child, function, locked)

        walk(tree, "<module>", False)
        self.assertEqual(found, [])

    def test_the_pre_event_codes_of_the_script_are_the_pinned_ones(self):
        self.assertEqual(set(night_module().PRE_EVENT_CODES), PRE_EVENT_CODES)

    def test_the_final_codes_are_the_pinned_ones(self):
        """The agent acts on the class (final: do not retry), so a class change must be a test change."""
        final = {code for code, (kind, _) in night_module().CODES.items() if kind == "final"}
        self.assertEqual(final, FINAL_CODES)

    def test_each_code_has_its_own_message_and_a_test_that_asserts_it(self):
        module = night_module()
        codes = module.CODES
        messages = [message for _, message in codes.values()]
        self.assertEqual(len(messages), len(set(messages)), "two codes share one message")
        self.assertTrue(all(kind in ("final", "fix") for kind, _ in codes.values()))
        self.assertTrue(set(module.PRE_EVENT_CODES) <= set(codes))
        self.assertEqual(set(module.STATE_CODES), STATE_CODES)
        with open(os.path.abspath(__file__), encoding="utf-8") as handle:
            source = handle.read()
        missing = [code for code in codes
                   if not re.search(rf'code="{code}"|"{code}"\)|\["{code}"[\],]|"{code}": ', source)]
        self.assertEqual(missing, [], "codes with no test that asserts them")

    def test_the_mutant_runner_counts_no_kill_when_the_suite_cannot_run(self):
        """A script that fails at import makes each test fail: that is no proof of a kill (P2-6)."""
        with tempfile.TemporaryDirectory() as tmp:
            broken = os.path.join(tmp, "night.py")
            with open(NIGHT, encoding="utf-8") as handle:
                source = handle.read()
            with open(broken, "w", encoding="utf-8") as handle:
                handle.write("import no_such_module_for_this_test\n" + source)
            env = {"PATH": os.environ.get("PATH", ""), "NIGHT_PY": broken}
            done = subprocess.run([sys.executable, "-I", os.path.join(HERE, "mutants.py"), "a bad line is skipped"],
                                  capture_output=True, text=True, env=env, check=False, timeout=600)
        out = done.stdout + done.stderr
        self.assertNotIn("KILLED", out)
        self.assertIn("BASELINE FAILED", out)
        self.assertEqual(done.returncode, 2, out)

    def test_show_red_fails_when_a_broken_journal_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            stub = os.path.join(tmp, "night.py")
            with open(stub, "w", encoding="utf-8") as handle:
                handle.write(STUB)
            env = {"PATH": os.environ.get("PATH", ""), "NIGHT_PY": stub}
            done = subprocess.run([sys.executable, "-I", os.path.abspath(__file__), "--show-red"],
                                  capture_output=True, text=True, env=env, check=False)
            self.assertEqual(done.returncode, 1, done.stdout + done.stderr)
            self.assertIn("NOT RED: time goes back", done.stdout)


def show_red():
    """Print the check run of each broken journal; exit 1 if one does not fail with its code."""
    misses = []
    with tempfile.TemporaryDirectory() as tmp:
        for name, (events, expected) in BROKEN.items():
            folder = os.path.join(tmp, re.sub(r"\W+", "-", name))
            code, out = check_broken(folder, events)
            print(f"## {name}\nexpected code: {expected}\nexit code: {code}\n{out}")
            wanted = [expected] if isinstance(expected, str) else expected
            if code != 1 or not set(wanted) <= set(code_of(out)):
                misses.append(name)
    for name in misses:
        print(f"NOT RED: {name}")
    print("ALL RED" if not misses else f"{len(misses)} broken journal(s) did not fail")
    return 1 if misses else 0


if __name__ == "__main__":
    if "--show-red" in sys.argv:
        sys.exit(show_red())
    unittest.main()
