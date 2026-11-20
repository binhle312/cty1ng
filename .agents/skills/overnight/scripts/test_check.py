"""Tests of night.py: `check`, the broken journals, the schema, repair; and `show_red()`.

Run all test files with `python3 -I run_tests.py`.
"""

import base64
import json
import os
import re
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `-I` drops this folder
from night_testlib import (  # noqa: E402
    Base, GO, INTENT, RUN, UNFINISHED, argv, at, code_of, env_for, go_args, go_at, intent, journal,
    journal_bytes, ordinary_write, read_events, read_report, result, run, started, write)


BROKEN = {
    "gap": (journal(go_at(), {"t": at("23:45"), "kind": "alive"}), "GAP"),
    "open intent": (journal(go_at(), {**INTENT, "t": at("22:10"), "item": "PR 1"}), "INTENT_NO_RESULT"),
    "time goes back": (journal(go_at(), {"t": at("22:20"), "kind": "alive"}, {"t": at("22:05"), "kind": "alive"}),
                       "TIME_BACK"),
    "intent on a denied item": (journal(go_at(),
                                        {"t": at("22:10"), "kind": "denied", "item": "PR 3", "command": "m", "blocks": "x"},
                                        {**INTENT, "t": at("22:20"), "item": "PR 3", "command": ordinary_write("PR 3")},
                                        result("22:21", 4)), "ITEM_DENIED"),
    "intent after a reopen of another repository": (journal(
        go_at(),
        {"t": at("22:10"), "kind": "denied", "item": "org/one#3", "command": "m", "blocks": "x"},
        {"t": at("22:11"), "kind": "denied", "item": "org/two#3", "command": "m", "blocks": "x"},
        {"t": at("22:12"), "kind": "amend", "words": "yes: org/two#3", "reopen": "org/two#3"},
        {**INTENT, "t": at("22:13"), "item": "org/one#3", "command": ordinary_write("org/one#3")},
        result("22:14", 6)), "ITEM_DENIED"),
    "decision with no source": (journal(go_at(), {"t": at("22:10"), "kind": "decision", "text": "x"}), "DECISION_SOURCE"),
    "intent after the stop": (journal(go_at(stop=at("22:30")), {"t": at("22:20"), "kind": "alive"},
                                      {**INTENT, "t": at("22:40"), "item": "PR 1"}, result("22:41", 4)), "AFTER_STOP"),
    "intent with no go": (journal({**INTENT, "t": at("22:10"), "item": "PR 1"}), ["NOT_STARTED", "ITEM_NOT_ON_CARD"]),
    "no go": (journal({"t": at("22:10"), "kind": "alive"}), "NO_GO"),
    "denied row with no command": (journal(go_at(), {"t": at("22:10"), "kind": "denied", "item": "PR 3", "blocks": "x"}),
                                   "DENIED_FIELDS"),
    "intent on a held item": (journal(go_at(), {"t": at("22:10"), "kind": "hold", "item": "PR 12", "text": "owner-only"},
                                      {**INTENT, "t": at("22:20"), "item": "PR 12", "command": ordinary_write("PR 12")},
                                      result("22:21", 4)), "ITEM_HELD"),
    "gap alarm above the maximum": (journal(go_at(heartbeat_min=600, gap_min=1200), {"t": at("23:15"), "kind": "alive"}),
                                    ["GAP_TOO_HIGH", "GAP"]),
    "gap alarm above its recorded maximum": (journal(go_at(max_gap_min=45), {"t": at("22:10"), "kind": "alive"}),
                                             "GAP_TOO_HIGH"),
    "stop passed, not closed": (journal(go_at(stop=at("23:00")), {"t": at("22:30"), "kind": "alive"},
                                        {"t": at("23:05"), "kind": "alive"}), "STOP_NOT_CLOSED"),
    "fake time in a real journal": (journal(go_at(), {"t": at("22:10"), "kind": "alive", "fake_clock": True}, test=False),
                                    "FAKE_CLOCK"),
    "item not on the card": (journal(go_at(), {**INTENT, "t": at("22:10"), "item": "#3", "command": ordinary_write("#3")},
                                     result("22:11", 3)), "ITEM_NOT_ON_CARD"),
    "intent on an owner item": (journal(go_at(), {"t": at("22:10"), "kind": "intent", "item": "PR 4", "command": "m",
                                                 }, result("22:11", 3)), "OWNER_ITEM"),
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
    "a second new": (journal({"t": at("22:01"), "kind": "new", "run": RUN, "words": "w", "format": 2, "chief_path": "/fixture"}), "NEW_TWICE"),
    "a repeated id": ([*journal(go_at()), {"id": 2, "t": at("22:10"), "kind": "alive"}], "ID_ORDER"),
    "a skipped id": ([*journal(go_at()), {"id": 9, "t": at("22:10"), "kind": "alive"}], "ID_ORDER"),
    "no new first": ([{"id": 1, **go_at()}], "FORMAT_UNSUPPORTED"),
    "a near duplicate name": (journal(go_at(items=[["PR 1", "owner"], ["pr  1", "owner"]])), "ITEM_DUPLICATE"),
    "a name with spaces at its ends": (journal(go_at(items=[[" PR 1", "owner"]])), "ITEM_NAME"),
    "an unknown kind of item": (journal(go_at(items=[["PR 1", "unknown"]])), "ITEM_KIND"),
}


def check_broken(folder, events):
    """`check` on a hand-written journal; a journal that is not a test journal gets the real clock."""
    write(folder, events)
    return run(folder, "check", at=at("23:50"), fake=bool(events[0].get("test")))


class CheckTests(Base):
    def test_each_broken_journal_fails_check_with_its_code(self):
        self.hand_edit = True
        for name, (events, expected) in BROKEN.items():
            with self.subTest(name=name):
                folder = self.folder(re.sub(r"\W+", "-", name))
                code, out = check_broken(folder, events)
                self.assertEqual(code, 3 if expected == "FORMAT_UNSUPPORTED" else 1, out)
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
                    self.assertEqual(base64.b64decode(json.load(handle)["cut"]).decode(), tail)
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
        intent_row = {"t": at("22:10"), "kind": "intent", "item": "PR 1", "command": ordinary_write("PR 1")}
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
                             ("format 2 bad run", [{**journal()[0], "run": "bad"}])):
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
        self.assertEqual(sorted(os.listdir(self.dir)), ["card.md", "journal.jsonl", "night.flock", "report.md"])

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
                texts.append(base64.b64decode(json.load(handle)["cut"]).decode())
        self.assertEqual(texts, ["first cut", "second cut"])


def show_red():
    """Print the check run of each broken journal; exit 1 if one does not fail with its code."""
    misses = []
    with tempfile.TemporaryDirectory() as tmp:
        for name, (events, expected) in BROKEN.items():
            folder = os.path.join(tmp, re.sub(r"\W+", "-", name))
            code, out = check_broken(folder, events)
            print(f"## {name}\nexpected code: {expected}\nexit code: {code}\n{out}")
            wanted = [expected] if isinstance(expected, str) else expected
            if code != (3 if expected == "FORMAT_UNSUPPORTED" else 1) or not set(wanted) <= set(code_of(out)):
                misses.append(name)
    for name in misses:
        print(f"NOT RED: {name}")
    print("ALL RED" if not misses else f"{len(misses)} broken journal(s) did not fail")
    return 1 if misses else 0
