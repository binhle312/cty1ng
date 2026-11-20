"""Retained historical breaks with exact source edits and assertion sites."""

from mutant_list import MUTANTS
from plan_r3_breaks import at


def historical(name, filename, test, anchor, subtest=""):
    row = next(row for row in MUTANTS if row[0] == name)
    edits = row[1] if len(row) == 2 else [row[1:]]
    if len(edits) != 1:
        raise ValueError(f"{name}: expected one source edit")
    old, new = edits[0]
    if not isinstance(old, str):
        raise ValueError(f"{name}: expected one source edit")
    return name, filename, old, new, test, at(test, anchor, subtest)


CHECK = "test_check.CheckTests."
RULES = "test_rules."
REPORT = "test_report.ReportTests."

BREAKS = [
    ("a bad line is skipped", "night_files.py",
     "        entry = json_record(raw, number)",
     "        try:\n            entry = json_record(raw, number)\n        except Refused:\n            continue",
     CHECK + "test_a_broken_line_inside_the_journal_stops_each_command",
     at(CHECK + "test_a_broken_line_inside_the_journal_stops_each_command",
        'self.assertEqual((code, code_of(out)), (3, ["BAD_LINE"]), out)')),
    historical("no rehearsal gate", "night_rules.py",
        RULES + "IntentTests.test_intent_needs_a_passed_rehearsal_or_an_owner_override",
        'self.assertIn("rehearsal", self.refused(*intent_args("PR 1"), at=at("22:10"), code="NO_REHEARSAL"))'),
    historical("an open intent passes", "night_rules.py",
        RULES + "IntentTests.test_second_intent_while_the_first_has_no_result_is_refused",
        'out = self.refused(*intent_args("PR 1"), at=at("22:12"), code="OPEN_INTENT")'),
    historical("an unknown result passes", "night_rules.py",
        RULES + "IntentTests.test_unknown_result_blocks_a_new_intent_until_a_new_result",
        'self.assertIn("is unknown", self.refused(*intent_args("PR 1"), at=at("22:12"), code="UNKNOWN_RESULT"))'),
    historical("--resolves not checked", "night_rules.py",
        RULES + "IntentTests.test_resolves_names_an_open_wait_row",
        'self.refused("log", "decision", "x", "--check", "--resolves", "E2", at=at("22:11"), code="RESOLVES_NOT_OPEN_WAIT")'),
    historical("words not needed", "night_rules.py",
        RULES + "WordsTests.test_amend_and_answer_need_the_exact_words_from_a_file",
        'self.refused("log", "amend", "--reopen", "PR 3", at=at("22:10"), code="WORDS_MISSING")'),
    historical("a bad argument byte passes", "night.py",
        RULES + "WordsTests.test_an_argument_that_is_not_utf8_is_refused",
        'self.assertEqual((done.returncode, code_of(out)), (3, ["BAD_ARGUMENT"]), out)'),
    historical("no gap to now", "night_report.py",
        CHECK + "test_check_now_finds_a_silent_period_up_to_now",
        'self.assertEqual((code, code_of(out)), (1, ["GAP"]), out)'),
    historical("no stop rule", "night_report.py",
        CHECK + "test_plain_check_finds_a_passed_stop_time_but_no_gap_to_now",
        'self.assertEqual((code, code_of(out)), (1, ["STOP_NOT_CLOSED"]), out)'),
    historical("report.md not compared", "night_files.py",
        CHECK + "test_a_missing_or_old_report_file_is_found_and_made_again",
        'self.assertEqual((code, code_of(out)), (1, ["REPORT_FILE"]), out)'),
    historical("close with no page checks", "night_rules.py",
        REPORT + "test_close_needs_a_fresh_report_and_three_passed_page_checks",
        'self.refused("close", "--reason", "nothing-left", at=at("22:11"), code="PAGE_CHECKS")'),
    historical("no cell escape", "night_report.py",
        REPORT + "test_report_escapes_cells_and_fences_the_owner_words",
        'self.assertIn("a &lt;b>'),
    historical("empty open_denials in status", "night_report.py",
        REPORT + "test_status_lists_what_is_open",
        'self.assertEqual(data["open_denials"], ["E4 PR 3"])'),
]

# A retirement needs an explicit removed command or transport rule and its reason.
RETIREMENTS = {}
