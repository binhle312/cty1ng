#!/usr/bin/env python3
"""Tests of night.py. Run: `python3 -I test_night.py -v` in this folder.

`python3 -I test_night.py --show-red` prints the `check` run of each broken journal.
NIGHT_PY replaces the script under test (for a run against a changed copy).
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
NIGHT = os.environ.get("NIGHT_PY", os.path.join(HERE, "night.py"))
T0 = "2026-01-10T22:00:00+00:00"


def run(folder, *args, at=T0):
    env = {"PATH": os.environ.get("PATH", ""), "TZ": "UTC", "NIGHT_FAKE_NOW": at}
    done = subprocess.run(
        [sys.executable, "-I", NIGHT, args[0], "--dir", folder, *args[1:]],
        capture_output=True, text=True, env=env, check=False,
    )
    return done.returncode, done.stdout + done.stderr


def at(hhmm, day="2026-01-10"):
    return f"{day}T{hhmm}:00+00:00"


def started(folder, stop="2026-01-11T06:00", heartbeat="30"):
    """A night with a go at 22:01 UTC."""
    assert run(folder, "new", "--words", "goal: fix the typos; merge PR 1; until 06:00", at=at("22:00"))[0] == 0
    code, out = run(folder, "go", "--stop", stop + "+00:00", "--goal", "set", "--heartbeat-min", heartbeat, at=at("22:01"))
    assert code == 0, out


# Broken journals for `check`. Each one breaks one rule; `check` must name it.
GO = {"kind": "go", "stop": "2026-01-11T06:00:00+00:00", "heartbeat_min": 30, "goal": "set"}


def journal(*rows):
    events = [{"id": 1, "t": at("22:00"), "kind": "new", "run": "night-test", "words": "w"}]
    for row in rows:
        event = {"id": len(events) + 1}
        event.update(row)
        events.append(event)
    return events


BROKEN = {
    "gap": (journal({**GO, "t": at("22:01")}, {"t": at("23:45"), "kind": "alive", "text": "x"}),
            "gap of 104 min"),
    "open intent": (journal({**GO, "t": at("22:01")},
                            {"t": at("22:10"), "kind": "intent", "item": "PR 1", "command": "merge 1"}),
                    "has no result"),
    "time goes back": (journal({**GO, "t": at("22:01")}, {"t": at("22:20"), "kind": "alive"},
                               {"t": at("22:05"), "kind": "alive"}),
                       "time goes back"),
    "intent on a denied item": (journal({**GO, "t": at("22:01")},
                                        {"t": at("22:10"), "kind": "denied", "item": "PR 3", "command": "merge 3", "blocks": "x"},
                                        {"t": at("22:20"), "kind": "intent", "item": "PR 3", "command": "merge 3"},
                                        {"t": at("22:21"), "kind": "result", "of": 4, "outcome": "done", "item": "PR 3"}),
                                "which was denied"),
    "decision with no source": (journal({**GO, "t": at("22:01")}, {"t": at("22:10"), "kind": "decision", "text": "x"}),
                                "no source and no owner check"),
    "intent after the stop": (journal({**GO, "t": at("22:01"), "stop": at("22:30")},
                                      {"t": at("22:20"), "kind": "alive"},
                                      {"t": at("22:40"), "kind": "intent", "item": "PR 1", "command": "merge 1"},
                                      {"t": at("22:41"), "kind": "result", "of": 4, "outcome": "done", "item": "PR 1"}),
                              "after the stop time"),
    "no go": (journal({"t": at("22:10"), "kind": "alive"}), "no go"),
    "denied row with no command": (journal({**GO, "t": at("22:01")},
                                           {"t": at("22:10"), "kind": "denied", "item": "PR 3", "blocks": "x"}),
                                   "no exact command"),
}


def write(folder, events):
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, "journal.jsonl"), "w", encoding="utf-8") as handle:
        for event in events:
            handle.write(json.dumps(event) + "\n")


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = os.path.join(self.tmp.name, "night")

    def tearDown(self):
        self.tmp.cleanup()

    def events(self):
        with open(os.path.join(self.dir, "journal.jsonl"), encoding="utf-8") as handle:
            return [json.loads(line) for line in handle if line.strip()]

    def refused(self, *args, at=T0, says=""):
        code, out = run(self.dir, *args, at=at)
        self.assertEqual(code, 3, out)
        self.assertIn("REFUSED", out)
        self.assertIn(says, out)
        return out


class StartTests(Base):
    def test_new_records_exact_words_and_clock_time(self):
        code, out = run(self.dir, "new", "--words", "goal: X; until 06:00", at=at("21:59"))
        self.assertEqual(code, 0, out)
        first = self.events()[0]
        self.assertEqual(first["words"], "goal: X; until 06:00")
        self.assertEqual(first["t"], at("21:59"))
        with open(os.path.join(self.dir, "card.md"), encoding="utf-8") as handle:
            self.assertIn("goal: X; until 06:00", handle.read())

    def test_second_new_in_one_folder_is_refused(self):
        run(self.dir, "new", "--words", "w")
        self.refused("new", "--words", "w", says="One folder holds one night")

    def test_go_needs_a_stop_time(self):
        run(self.dir, "new", "--words", "w")
        code, out = run(self.dir, "go", "--goal", "set")
        self.assertEqual(code, 2, out)
        self.assertIn("--stop", out)

    def test_go_with_a_past_stop_time_is_refused(self):
        run(self.dir, "new", "--words", "w", at=at("22:00"))
        self.refused("go", "--stop", at("21:00"), "--goal", "set", at=at("22:01"), says="not in the future")

    def test_second_go_is_refused(self):
        started(self.dir)
        self.refused("go", "--stop", "2026-01-11T06:00+00:00", "--goal", "set", at=at("22:05"), says="already has a go")

    def test_log_before_new_is_refused(self):
        self.refused("log", "alive", "x", says="run `new` first")


class ActionTests(Base):
    def test_intent_before_go_is_refused(self):
        run(self.dir, "new", "--words", "w")
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", says="no go")

    def test_intent_after_the_stop_time_is_refused(self):
        started(self.dir, stop="2026-01-10T23:00")
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", at=at("23:00"), says="has passed")

    def test_denied_item_stays_denied_until_an_owner_amend_opens_it(self):
        started(self.dir)
        code, out = run(self.dir, "log", "denied", "--item", "PR 3", "--command", "gh pr merge 3", "--blocks", "PR 4", at=at("22:10"))
        self.assertEqual(code, 0, out)
        self.refused("log", "intent", "--item", "PR 3", "--command", "gh pr merge 3 --admin", at=at("22:20"), says="denied stays denied")
        run(self.dir, "log", "amend", "yes: merge PR 3 now", "--reopen", "PR 3", at=at("22:30"))
        code, out = run(self.dir, "log", "intent", "--item", "PR 3", "--command", "gh pr merge 3", at=at("22:31"))
        self.assertEqual(code, 0, out)

    def test_second_intent_while_the_first_has_no_result_is_refused(self):
        started(self.dir)
        run(self.dir, "log", "intent", "--item", "PR 1", "--command", "merge 1", at=at("22:10"))
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", at=at("22:12"), says="no result")

    def test_unknown_result_can_get_a_later_result_but_done_cannot(self):
        started(self.dir)
        run(self.dir, "log", "intent", "--item", "PR 1", "--command", "merge 1", at=at("22:10"))
        self.assertEqual(run(self.dir, "log", "result", "--of", "3", "--outcome", "unknown", at=at("22:11"))[0], 0)
        self.assertEqual(run(self.dir, "log", "result", "--of", "3", "--outcome", "done", "merged", at=at("22:15"))[0], 0)
        self.refused("log", "result", "--of", "3", "--outcome", "failed", at=at("22:16"), says="already has the result")

    def test_decision_needs_a_source_or_an_owner_check(self):
        started(self.dir)
        self.refused("log", "decision", "keep the old name", at=at("22:10"), says="needs --source")
        self.assertEqual(run(self.dir, "log", "decision", "keep it", "--check", at=at("22:11"))[0], 0)

    def test_denied_row_needs_command_and_blocks(self):
        started(self.dir)
        self.refused("log", "denied", "--item", "PR 3", at=at("22:10"), says="--command and --blocks")


class CheckTests(Base):
    def test_each_broken_journal_fails_check(self):
        for name, (events, expected) in BROKEN.items():
            with self.subTest(name=name):
                folder = os.path.join(self.tmp.name, name.replace(" ", "-"))
                write(folder, events)
                code, out = run(folder, "check", at=at("23:50"))
                self.assertEqual(code, 1, out)
                self.assertIn(expected, out)

    def test_good_night_passes_check(self):
        started(self.dir)
        run(self.dir, "log", "alive", "working", at=at("22:40"))
        run(self.dir, "log", "intent", "--item", "PR 1", "--command", "merge 1", at=at("23:10"))
        run(self.dir, "log", "result", "--of", "4", "--outcome", "done", "merged at abc123", at=at("23:11"))
        code, out = run(self.dir, "check", at=at("23:40"))
        self.assertEqual((code, out.strip()), (0, "check: OK"))

    def test_check_now_finds_a_silent_period_up_to_now(self):
        started(self.dir)
        run(self.dir, "log", "alive", "x", at=at("22:30"))
        self.assertEqual(run(self.dir, "check", at=at("23:50"))[0], 0)
        code, out = run(self.dir, "check", "--now", at=at("23:50"))
        self.assertEqual(code, 1, out)
        self.assertIn("gap of 80 min from E3 to now", out)


class CloseTests(Base):
    def night_with_report(self):
        started(self.dir)
        run(self.dir, "log", "denied", "--item", "PR 3", "--command", "gh pr merge 3", "--blocks", "PR 4", at=at("22:10"))
        run(self.dir, "log", "wait", "needs the owner's choice", "--item", "PR 2", at=at("22:12"))
        run(self.dir, "log", "wait", "needs a review", "--item", "PR 5", at=at("22:13"))
        run(self.dir, "log", "decision", "review done", "--item", "PR 5", "--source", "rule 1", "--resolves", "5", at=at("22:14"))
        run(self.dir, "log", "intent", "--item", "PR 1", "--command", "merge 1", at=at("22:20"))
        run(self.dir, "log", "result", "--of", "7", "--outcome", "unknown", "timeout", at=at("22:21"))
        run(self.dir, "log", "error", "I typed a wrong count; corrected", at=at("22:25"))
        self.assertEqual(run(self.dir, "report", at=at("22:30"))[0], 0)

    def test_report_lists_what_needs_the_owner(self):
        self.night_with_report()
        with open(os.path.join(self.dir, "report.md"), encoding="utf-8") as handle:
            report = handle.read()
        needs = report.split("## Needs you")[1].split("## My errors")[0]
        self.assertIn("gh pr merge 3", needs)
        self.assertIn("PR 2", needs)
        self.assertNotIn("PR 5", needs)
        self.assertIn("result unknown", needs)
        self.assertIn("I typed a wrong count", report)
        self.assertIn("The night is not closed", report)

    def test_close_needs_a_fresh_report_and_three_page_checks(self):
        self.night_with_report()
        self.refused("close", "--reason", "nothing-left", at=at("22:40"), says="mechanics, truth, counts")
        run(self.dir, "log", "aware", "late note", at=at("22:41"))
        for name in ("mechanics", "truth", "counts"):
            run(self.dir, "log", "pagecheck", "--name", name, "--outcome", "pass", at=at("22:42"))
        self.refused("close", "--reason", "nothing-left", at=at("22:43"), says="run `report` again")
        run(self.dir, "report", at=at("22:44"))
        for name in ("mechanics", "truth", "counts"):
            run(self.dir, "log", "pagecheck", "--name", name, "--outcome", "pass", at=at("22:45"))
        code, out = run(self.dir, "close", "--reason", "nothing-left", at=at("22:46"))
        self.assertEqual(code, 0, out)
        self.assertIn("NIGHT CLOSED night-20260110T2200Z reason nothing-left", out)

    def test_close_with_an_open_intent_is_refused(self):
        started(self.dir)
        run(self.dir, "log", "intent", "--item", "PR 1", "--command", "merge 1", at=at("22:10"))
        run(self.dir, "report", at=at("22:11"))
        self.refused("close", "--reason", "stop-time", "--without-page", "test", at=at("22:12"), says="intents with no result")

    def test_after_the_close_only_notes_and_answers(self):
        started(self.dir)
        run(self.dir, "report", at=at("22:10"))
        self.assertEqual(run(self.dir, "close", "--reason", "nothing-left", "--without-page", "no page tool", at=at("22:11"))[0], 0)
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", at=at("22:12"), says="the night is closed")
        self.refused("log", "decision", "x", "--check", at=at("22:12"), says="the night is closed")
        self.assertEqual(run(self.dir, "log", "answer", "Q1: A", at=at("08:00", "2026-01-11"))[0], 0)


def show_red():
    with tempfile.TemporaryDirectory() as tmp:
        for name, (events, expected) in BROKEN.items():
            folder = os.path.join(tmp, name.replace(" ", "-"))
            write(folder, events)
            code, out = run(folder, "check", at=at("23:50"))
            print(f"## {name}\nexpected text: {expected!r}\nexit code: {code}\n{out}")


if __name__ == "__main__":
    if "--show-red" in sys.argv:
        show_red()
    else:
        unittest.main()
