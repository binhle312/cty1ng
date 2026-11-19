"""Tests of night.py: the report, the page checks, the close, and the bounds of each rule.

Run all test files with `python3 -I run_tests.py`.
"""

import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `-I` drops this folder
from night_testlib import (  # noqa: E402
    Base, ITEMS, OPT, SHA, amend, at, card, code_of, go_args, go_at, intent, intent_args, journal, merge, new, part,
    read_report, run, started, words_file, write)


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
        for raw, code in ((" | owner", "ITEM_NAME"), ("PR 1 | commit | head", "ITEM_COMMAND"), ("PR 1 | commit | #", "COMMAND_SHELL"),
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

    def test_the_head_option_is_a_word_of_its_own_in_the_command(self):
        started(self.dir)
        self.refused(*intent_args("PR 1", SHA, merge("PR 1").replace(OPT, f"--no{OPT}")), at=at("22:10"),
                     code="COMMAND_NOT_ROW")

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
        tick = "\N{GRAVE ACCENT}"
        self.ok(new(self.dir, f"a {tick * 4} b\n{tick * 3}night-items\nPR 9 | owner\n{tick * 3}"))
        card(self.dir)
        self.ok(run(self.dir, *go_args(), at=at("22:01")))
        self.assertEqual(len(self.events()[-1]["items"]), len(ITEMS))
        self.ok(run(self.dir, "report", at=at("22:02")))
        self.assertIn(tick * 5, read_report(self.dir))

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
