"""Tests of night.py: new, the card, go, the phases, the clock, the items, the head, the order.

Run all test files with `python3 -I run_tests.py`.
"""

import json
import os
import re
import shutil
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `-I` drops this folder
from night_testlib import (  # noqa: E402
    Base, ITEMS, SHA, SHA2, WRITE_COMMANDS, amend, at, card, code_of, go_args, intent, intent_args,
    journal_bytes, ordinary_write, new, read_events, read_report, run, started, words_file)


class StartTests(Base):
    def test_new_records_exact_words_from_a_file(self):
        text = 'goal: X; "quoted" $HOME `tick`; until 06:00'
        self.ok(new(self.dir, text, when=at("21:59")))
        first = self.events()[0]
        self.assertEqual((first["words"], first["t"], first["test"], first["format"]), (text, at("21:59"), True, 3))
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
            "ITEM_KIND": "PR 1 | unknown",
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

    def test_card_parse_ignores_a_block_in_the_owner_words_and_reads_crlf(self):
        self.ok(new(self.dir, "goal: x\n```night-items\nPR 9 | owner\n```\n## Needs you\nuntil 06:00"))
        with open(os.path.join(self.dir, "card.md"), "a", encoding="utf-8", newline="") as handle:
            handle.write(f"\r\n```night-items\r\nPR 1 | night\r\nPR 4 | owner\r\n```\r\n")
        self.ok(run(self.dir, *go_args(), at=at("22:01")))
        self.assertEqual(self.events()[-1]["items"], [["PR 1", "night"], ["PR 4", "owner"]])

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
        self.refused("log", "intent", "--item", "PR 4", "--command", "gh pr merge 4", at=at("22:10"),
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
        self.refused("log", "amend", "--add-item", "PR 5 | night", at=at("22:10"), code="WORDS_MISSING")
        self.refused("log", "amend", "--add-item", "PR 5 | owner", at=at("22:10"), code="WORDS_MISSING")

    def test_add_item_for_a_name_on_the_card_is_refused(self):
        started(self.dir)
        self.is_refused(amend(self.dir, "also PR 1", "--add-item", "PR 1 | owner", when=at("22:10")), "ITEM_ON_CARD")
        self.is_refused(amend(self.dir, "also pr 1", "--add-item", "pr  1 | owner", when=at("22:10")), "ITEM_ON_CARD")
        self.is_refused(amend(self.dir, "also PR 5", "--add-item", "PR 5 commit", when=at("22:10")), "ITEM_LINE")
        self.is_refused(amend(self.dir, "also PR 5", "--add-item", "PR 5 | merge", when=at("22:10")), "MERGE_TARGET_FORM")
        self.is_refused(amend(self.dir, "also PR 5", "--add-item", "PR 5 | unknown", when=at("22:10")), "ITEM_KIND")

    def test_intent_on_a_new_item_before_its_amend_is_refused(self):
        started(self.dir)
        self.refused(*intent_args("PR 5"), at=at("22:10"), code="ITEM_NOT_ON_CARD")
        out = self.ok(amend(self.dir, "also merge PR 5 after the bar", "--add-item", "PR 5 | night",
                            when=at("22:11")))
        self.assertIn("read it back", out)
        self.ok(intent(self.dir, "PR 5", at("22:12")))
        items = json.loads(self.ok(run(self.dir, "status", "--json", at=at("22:13"))))["items"]
        self.assertIn({"name": "PR 5", "kind": "night", "from": "E3"}, items)
        self.assertIn({"name": "PR 1", "kind": "night", "from": "E2"}, items)



class OrderTests(Base):
    """When two rules break, the final reason comes first."""

    def test_a_denied_item_with_no_command_says_denied(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "denied", "--item", "PR 3", "--command", "m", "--blocks", "x", at=at("22:10")))
        self.refused("log", "intent", "--item", "PR 3", at=at("22:11"), code="ITEM_DENIED")

    def test_after_the_stop_a_denied_item_says_after_the_stop(self):
        started(self.dir, stop="2026-01-10T23:00")
        self.ok(run(self.dir, "log", "denied", "--item", "PR 3", "--command", "m", "--blocks", "x", at=at("22:10")))
        self.refused(*intent_args("PR 3"), at=at("23:10"), code="AFTER_STOP")

    def test_an_unknown_result_with_no_command_says_unknown(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.ok(run(self.dir, "log", "result", "--of", "3", "--outcome", "unknown", at=at("22:11")))
        self.refused("log", "intent", "--item", "PR 1", at=at("22:12"), code="UNKNOWN_RESULT")

    def test_an_open_intent_with_no_command_says_open_intent(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.refused("log", "intent", "--item", "PR 1", at=at("22:12"), code="OPEN_INTENT")

    def test_no_rehearsal_comes_before_the_item_check(self):
        started(self.dir, rehearsal="none")
        self.refused(*intent_args("#3"), at=at("22:10"), code="NO_REHEARSAL")
