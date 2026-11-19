"""Tests of night.py: blocks, faults, intents, the owner's words; and the findings of advisor point 3.

Run all test files with `python3 -I run_tests.py`.
"""

import json
import os
import random
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `-I` drops this folder
from night_testlib import (  # noqa: E402
    Base, INTENT, NIGHT, OPT, SHA, amend, argv, at, card, code_of, env_for, go_args, go_at, intent, intent_args,
    journal, journal_bytes, merge, new, night_module, part, read_report, result, run, started, words_file, write)


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
