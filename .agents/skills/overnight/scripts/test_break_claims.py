"""Tests that isolate one journal or report rule for the break runner."""

import base64
import json
import os
from pathlib import Path
from unittest.mock import patch

from night_testlib import (Base, INTENT, at, card, code_of, go_args, go_at, intent, journal, new,
                           night_module, read_report, result, run, started, words_file, write)


class BreakClaimTests(Base):
    def test_unknown_journal_field(self):
        problem = night_module().schema_problem(journal({"kind": "alive", "t": at("22:10"), "note": "x"})[-1])
        self.assertEqual(problem, "field 'note' is not a field of alive")

    def test_wrong_journal_field_type(self):
        problem = night_module().schema_problem(journal({"kind": "alive", "t": at("22:10"), "text": 42})[-1])
        self.assertEqual(problem, "field 'text' has a bad value 42")

    def test_result_outcome_must_be_in_the_enum(self):
        problem = night_module().schema_problem(journal(result("22:10", 3, "bogus"))[-1])
        self.assertEqual(problem, "field 'outcome' has a bad value 'bogus'")

    def test_missing_item_field_on_wait(self):
        problem = night_module().schema_problem({"id": 3, "kind": "wait", "t": at("22:10")})
        self.assertEqual(problem, "missing field 'item'")

    def test_new_schema_checks_the_format_separately_from_the_reader(self):
        event = {**journal()[0], "format": 99}
        self.assertEqual(night_module().schema_problem(event), "field 'format' has a bad value 99")

    def test_missing_item_field_on_hold_and_denied(self):
        module = night_module()
        problems = [module.schema_problem({"id": 3, "kind": kind, "t": at("22:10")}) for kind in ("hold", "denied")]
        self.assertEqual(problems, ["missing field 'item'"] * 2)

    def test_missing_close_repair_and_pagecheck_fields(self):
        module = night_module()
        problems = [module.schema_problem({"id": 3, "kind": kind, "t": at("22:10")})
                    for kind in ("close", "repair", "pagecheck")]
        self.assertEqual(problems, ["missing field 'reason'", "missing field 'cut_file'", "missing field 'name'"])

    def test_invalid_utf8_text_field(self):
        event = journal({"kind": "alive", "t": at("22:10"), "text": "\udcff"})[-1]
        self.assertEqual(night_module().schema_problem(event), "field 'text' has a bad value '\\udcff'")

    def test_format_guard_precedes_later_incomplete_bytes(self):
        module = night_module()
        with self.assertRaisesRegex(module.Refused, "FORMAT_UNSUPPORTED"):
            module.check_version(b'{"format": 3}\n{"partial":')

    def test_replay_cannot_replace_the_first_new(self):
        module = night_module()
        rows = journal()
        rows.append({**rows[0], "id": 2, "words": "different"})
        self.assertEqual(module.fold(rows).words, rows[0]["words"])

    def test_first_event_must_be_new(self):
        module = night_module()
        self.assertEqual(module.rule_order(module.Night(), {"id": 1, "kind": "alive"}),
                         [("FIRST_NOT_NEW", "it is alive")])

    def test_report_carries_test_marker_on_the_first_line(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:05")))
        self.assertIn("TEST JOURNAL", read_report(self.dir).splitlines()[0])

    def test_report_comparison_checks_text_after_header(self):
        self.hand_edit = True
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:05")))
        file = Path(self.dir) / "report.md"
        file.write_text(file.read_text().splitlines()[0] + "\nstale body\n")
        status, out = run(self.dir, "check", at=at("22:06"))
        self.assertEqual((status, code_of(out)), (1, ["REPORT_FILE"]), out)

    def test_report_shows_the_go_line(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:05")))
        self.assertIn(f"Go: {at('22:01')}.", read_report(self.dir))

    def test_report_has_the_owner_decision_to_check(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "decision", "fixture decision", "--check", at=at("22:05")))
        self.ok(run(self.dir, "report", at=at("22:06")))
        self.assertIn("|  | fixture decision | E3 |", read_report(self.dir))

    def test_report_cannot_omit_its_own_count_on_replay(self):
        self.hand_edit = True
        write(self.dir, journal(go_at(), {"t": at("22:10"), "kind": "report", "counts": {"new": 1, "go": 1}}))
        self.ok(run(self.dir, "render", at=at("22:11")))
        status, out = run(self.dir, "check", at=at("22:11"))
        self.assertEqual((status, code_of(out)), (1, ["COUNTS_WRONG"]), out)

    def test_replay_ignores_future_entries_in_an_open_report(self):
        module = night_module()
        rows = journal(go_at(), {"t": at("22:10"), "kind": "report", "counts": {"new": 1, "go": 1, "report": 1}},
                       {"t": at("22:11"), "kind": "error", "text": "later error"})
        self.assertNotIn("later error", module.render(rows))

    def test_go_records_the_lower_maximum(self):
        self.ok(new(self.dir))
        card(self.dir)
        self.ok(run(self.dir, *go_args(), "--gap-min", "45", at=at("22:01"), env={"NIGHT_MAX_GAP_MIN": "45"}))
        self.assertEqual(self.events()[-1]["max_gap_min"], 45)

    def test_stop_at_the_go_time(self):
        self.ok(new(self.dir))
        card(self.dir)
        self.refused(*go_args(stop="2026-01-10T22:01"), at=at("22:01"), code="GO_STOP_NOT_FUTURE")

    def test_alarm_after_stop_with_now(self):
        self.hand_edit = True
        started(self.dir, stop="2026-01-10T22:15")
        status, out = run(self.dir, "check", "--now", at=at("22:20"))
        self.assertEqual((status, code_of(out)), (1, ["STOP_NOT_CLOSED"]), out)

    def test_append_syncs_the_journal_file(self):
        module = night_module()
        os.makedirs(self.dir)
        seen = []
        sync = os.fsync

        def capture(fd):
            seen.append(os.fstat(fd).st_ino)
            sync(fd)

        with patch("os.fsync", capture):
            module.append(self.dir, journal()[0], first=False)
        self.assertEqual(seen, [(Path(self.dir) / "journal.jsonl").stat().st_ino])

    def test_short_append_writes_the_remaining_bytes(self):
        self.hand_edit = True
        module = night_module()
        os.makedirs(self.dir)
        entry = journal()[0]
        real_write = os.write

        def short_write(fd, content):
            return real_write(fd, content[:8])

        with patch("os.write", short_write):
            module.append(self.dir, entry, first=False)
        self.assertEqual((Path(self.dir) / "journal.jsonl").read_bytes(), module.entry_bytes(entry))

    def test_lock_with_zero_pid(self):
        os.makedirs(self.dir)
        lock = Path(self.dir) / "journal.lock"
        lock.write_text("0")
        module = night_module()
        try:
            with patch("os.kill") as probe:
                error = module.Lock(self.dir).refusal()
        finally:
            lock.unlink()
        self.assertEqual((error.code, probe.call_count), ("LOCK_STALE", 0))

    def test_old_lock_with_live_owner_is_stale(self):
        os.makedirs(self.dir)
        lock = Path(self.dir) / "journal.lock"
        lock.write_text(str(os.getpid()))
        module = night_module()
        try:
            with patch("os.path.getmtime", return_value=0):
                error = module.Lock(self.dir).refusal()
        finally:
            lock.unlink()
        self.assertEqual(error.code, "LOCK_STALE")

    def test_no_text_for_aware(self):
        started(self.dir)
        self.refused("log", "aware", "--item", "PR 1", at=at("22:10"), code="TEXT_MISSING")

    def test_items_validates_the_kind(self):
        self.ok(new(self.dir))
        card(self.dir, raw="PR 1 | unknown")
        self.refused("items", code="ITEM_KIND")

    def test_bad_max_gap_from_environment(self):
        self.ok(new(self.dir))
        card(self.dir)
        self.refused(*go_args(), at=at("22:01"), env={"NIGHT_MAX_GAP_MIN": "61"}, code="MAX_GAP_ENV")

    def test_check_refuses_without_journal(self):
        os.makedirs(self.dir)
        self.refused("check", code="NO_NIGHT")

    def test_alive_preserves_report_freshness(self):
        module = night_module()
        rows = journal(go_at(), {"t": at("22:10"), "kind": "report", "counts": {"new": 1, "go": 1, "report": 1}},
                       {"t": at("22:11"), "kind": "alive"})
        self.assertEqual(module.fold(rows).made_old_by, [])

    def test_no_blank_close_override(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:04")))
        self.refused("close", "--reason", "nothing-left", "--without-page", "  ", at=at("22:05"), code="PAGE_CHECKS")

    def test_check_finds_a_later_final_result_on_replay(self):
        self.hand_edit = True
        write(self.dir, journal(go_at(), {**INTENT, "item": "PR 1", "t": at("22:05")},
                                result("22:06", 3), result("22:07", 3, "failed")))
        status, out = run(self.dir, "check", at=at("22:08"))
        self.assertEqual((status, code_of(out)), (1, ["RESULT_FINAL"]), out)

    def test_generated_report_includes_its_own_count(self):
        started(self.dir)
        status, out = run(self.dir, "report", at=at("22:10"))
        self.assertEqual((status, code_of(out)), (0, []), out)
        self.assertEqual(self.events()[-1]["counts"]["report"], 1)

    def test_pagecheck_needs_a_report(self):
        started(self.dir)
        self.refused("log", "pagecheck", "--name", "truth", "--outcome", "pass", "--report", "E2",
                     at=at("22:10"), code="REPORT_NONE_YET")

    def test_close_refuses_stale_report(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))
        self.ok(run(self.dir, "log", "aware", "new information", at=at("22:11")))
        self.refused("close", "--reason", "nothing-left", "--without-page", "fixture", at=at("22:12"), code="REPORT_OLD")

    def test_add_item_rejects_control_character(self):
        started(self.dir)
        self.refused("log", "amend", "--words-file", words_file(self.dir, "add the item"),
                     "--add-item", "P\x01R | night", at=at("22:10"), code="ITEM_NAME")

    def test_item_argument_is_stripped(self):
        self.expect = {"INTENT_NO_RESULT"}
        started(self.dir)
        self.ok(intent(self.dir, " PR 1 ", at("22:10")))
        self.assertEqual(self.events()[-1]["item"], "PR 1")

    def test_repair_side_holds_original_cut(self):
        started(self.dir)
        path = Path(self.dir) / "journal.jsonl"
        tail = b'{"id":'
        with path.open("ab") as handle:
            handle.write(tail)
        self.ok(run(self.dir, "repair", at=at("22:10")))
        side = Path(self.dir) / "journal.cut-1.txt"
        self.assertEqual(base64.b64decode(json.loads(side.read_text())["cut"]), tail)

    def test_cannot_read_cut_tail(self):
        self.hand_edit = True
        started(self.dir)
        path = Path(self.dir) / "journal.jsonl"
        with path.open("ab") as handle:
            handle.write(b'{"id":')
        status, out = run(self.dir, "check", at=at("22:10"))
        self.assertEqual((status, code_of(out)), (3, ["TORN_LINE"]), out)

    def test_repair_preserves_the_last_complete_entry(self):
        self.hand_edit = True
        started(self.dir)
        path = Path(self.dir) / "journal.jsonl"
        prefix = path.read_bytes()
        with path.open("ab") as handle:
            handle.write(b'{"id":')
        self.ok(run(self.dir, "repair", at=at("22:10")))
        self.assertTrue(path.read_bytes().startswith(prefix))

    def test_new_records_test_mode_with_a_real_clock(self):
        self.ok(run(self.dir, "new", "--words-file", words_file(self.dir, "fixture"), fake=False))
        self.assertIs(self.events()[0].get("test"), True)

    def test_new_records_the_fake_clock_flag(self):
        self.ok(new(self.dir))
        self.assertIs(self.events()[0].get("fake_clock"), True)

    def test_alive_after_close_is_refused(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:05")))
        self.ok(run(self.dir, "close", "--reason", "nothing-left", "--without-page", "fixture", at=at("22:06")))
        self.refused("log", "alive", "late", at=at("22:07"), code="CLOSED")

    def test_full_stop_timestamp_requires_its_own_offset(self):
        module = night_module()
        with self.assertRaisesRegex(module.Refused, "STOP_NO_OFFSET"):
            module.parse_stop("2026-01-11T06:00", module.entry_time(at("22:01")))

    def test_stop_refuses_an_offset_of_twenty_four_hours(self):
        module = night_module()
        with self.assertRaisesRegex(module.Refused, "STOP_NO_OFFSET"):
            module.parse_stop("06:00+24:00", module.entry_time(at("22:01")))

    def test_short_merge_row_stops_before_comparing_task_targets(self):
        module = night_module()
        row = go_at(items=[["PR 12", "merge", "github.com/example/app#12"]], chief="chief", review_policy={})
        events = journal(row)
        problems = module.rule_go(module.fold(events[:1]), events[-1])
        self.assertEqual([code for code, _ in problems], ["MERGE_TARGET_FORM"])

    def test_close_rewrites_the_report(self):
        self.hand_edit = True
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:05")))
        self.ok(run(self.dir, "close", "--reason", "nothing-left", "--without-page", "fixture", at=at("22:06")))
        self.assertIn("The night is closed at", read_report(self.dir))

    def test_refused_write_preserves_journal_bytes(self):
        self.hand_edit = True
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:05")))
        file = Path(self.dir) / "journal.jsonl"
        original = file.read_bytes()
        status, out = intent(self.dir, "PR 1", at("22:06"))
        self.assertEqual((status, code_of(out)), (3, ["OPEN_INTENT"]), out)
        self.assertEqual(file.read_bytes(), original)

    def test_gap_equal_to_alarm_is_allowed(self):
        module = night_module()
        rows = journal(go_at(), {"kind": "alive", "t": at("23:01")})
        self.assertEqual(module.gaps(module.fold(rows)), [])

    def test_gaps_stop_at_close(self):
        module = night_module()
        rows = journal(go_at(), {"t": at("22:10"), "kind": "report", "counts": {"new": 1, "go": 1, "report": 1}},
                       {"t": at("22:11"), "kind": "close", "reason": "nothing-left", "without_page": "fixture"},
                       {"t": at("23:45"), "kind": "aware", "text": "later note"})
        self.assertEqual(module.gaps(module.fold(rows)), [])

    def test_gaps_start_at_go(self):
        module = night_module()
        rows = journal(go_at("23:30"))
        self.assertEqual(module.gaps(module.fold(rows)), [])

    def test_report_directory_gets_report_file_code(self):
        self.hand_edit = True
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:05")))
        path = Path(self.dir) / "report.md"
        path.unlink()
        path.mkdir()
        status, out = run(self.dir, "check", at=at("22:06"))
        self.assertEqual((status, code_of(out)), (1, ["REPORT_FILE"]), out)

    def test_lock_overrides_apply_only_in_test_mode(self):
        module = night_module()
        with patch.dict(os.environ, {"NIGHT_TEST_MODE": "0", "NIGHT_LOCK_WAIT_S": "0.1", "NIGHT_LOCK_STALE_S": "0"}):
            wait = module.env_number("NIGHT_LOCK_WAIT_S", module.DEFAULT_LOCK_WAIT_S)
            stale = module.env_number("NIGHT_LOCK_STALE_S", module.DEFAULT_LOCK_STALE_S)
        self.assertEqual((wait, stale), (module.DEFAULT_LOCK_WAIT_S, module.DEFAULT_LOCK_STALE_S))

    def test_lock_record_contains_process_id(self):
        os.makedirs(self.dir)
        module = night_module()
        with module.Lock(self.dir):
            self.assertEqual((Path(self.dir) / "journal.lock").read_text(), str(os.getpid()))

    def test_lock_creation_does_not_replace_existing_marker(self):
        os.makedirs(self.dir)
        lock = Path(self.dir) / "journal.lock"
        original = str(os.getpid())
        lock.write_text(original)
        module = night_module()
        try:
            with patch.dict(os.environ, {"NIGHT_TEST_MODE": "1", "NIGHT_LOCK_WAIT_S": "0.01"}):
                with self.assertRaisesRegex(module.Refused, "LOCK_HELD"):
                    with module.Lock(self.dir):
                        pass
            self.assertEqual(lock.read_text(), original)
        finally:
            lock.unlink(missing_ok=True)

    def test_entry_clock_runs_inside_the_lock(self):
        started(self.dir)
        module = night_module()
        lock = Path(self.dir) / "journal.lock"
        observed = []

        def clock():
            observed.append(lock.exists())
            return module.entry_time(at("22:10")), True

        with patch.dict(module.write_entry.__globals__, {"clock": clock}):
            module.write_entry(self.dir, "alive", {"text": "fixture"})
        self.assertEqual(observed, [True])

    def test_empty_marker_can_clear_during_lock_wait(self):
        os.makedirs(self.dir)
        lock = Path(self.dir) / "journal.lock"
        lock.touch()
        module = night_module()
        try:
            with patch("time.sleep", side_effect=lambda _: lock.unlink()) as wait:
                try:
                    with module.Lock(self.dir):
                        status = "acquired"
                except module.Refused as error:
                    status = error.code
            self.assertEqual((status, wait.call_count), ("acquired", 1))
        finally:
            lock.unlink(missing_ok=True)
