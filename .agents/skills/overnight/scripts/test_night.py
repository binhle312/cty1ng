#!/usr/bin/env python3
"""Tests of night.py. Run: `python3 -I test_night.py -v` in this folder.

`python3 -I test_night.py --show-red` runs `night.py check` on each broken journal, prints the
output, and exits 1 if a broken journal does not fail as expected.
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
HEAD = ["--head", "abc1234", "--head-now", "abc1234"]


def run(folder, *args, at=T0, env=None):
    full_env = {"PATH": os.environ.get("PATH", ""), "TZ": "UTC", "NIGHT_FAKE_NOW": at}
    full_env.update(env or {})
    done = subprocess.run(
        [sys.executable, "-I", NIGHT, args[0], "--dir", folder, *args[1:]],
        capture_output=True, text=True, env=full_env, check=False,
    )
    return done.returncode, done.stdout + done.stderr


def at(hhmm, day="2026-01-10"):
    return f"{day}T{hhmm}:00+00:00"


def words_file(folder, text):
    """The owner's exact words go in through a file (a quoted heredoc in real use)."""
    os.makedirs(os.path.dirname(folder) or ".", exist_ok=True)
    path = folder + f".words-{abs(hash(text))}.txt"
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)
    return path


def new(folder, text="goal: fix the typos; merge PR 1; until 06:00", when=at("22:00")):
    return run(folder, "new", "--words-file", words_file(folder, text), at=when)


def started(folder, stop="2026-01-11T06:00", heartbeat="30", rehearsal="passed", goal="set"):
    """A night with a go at 22:01 UTC."""
    assert new(folder)[0] == 0
    code, out = run(folder, "go", "--stop", stop + "+00:00", "--goal", goal, "--rehearsal", rehearsal,
                    "--heartbeat-min", heartbeat, at=at("22:01"))
    assert code == 0, out


def intent(folder, item, when, head=HEAD):
    return run(folder, "log", "intent", "--item", item, "--command", f"merge {item}", *head, at=when)


def amend(folder, text, *extra, when):
    return run(folder, "log", "amend", "--words-file", words_file(folder, text), *extra, at=when)


# Broken journals for `check`. Each one breaks one rule; `check` must name it.
GO = {"kind": "go", "stop": "2026-01-11T06:00:00+00:00", "heartbeat_min": 30, "gap_min": 60,
      "goal": "set", "rehearsal": "passed"}


def journal(*rows):
    events = [{"id": 1, "t": at("22:00"), "kind": "new", "run": "night-test", "words": "w"}]
    for row in rows:
        event = {"id": len(events) + 1}
        event.update(row)
        events.append(event)
    return events


INTENT = {"kind": "intent", "command": "merge", "head": "abc1234", "head_now": "abc1234"}
BROKEN = {
    "gap": (journal({**GO, "t": at("22:01")}, {"t": at("23:45"), "kind": "alive", "text": "x"}),
            "gap of 104 min"),
    "open intent": (journal({**GO, "t": at("22:01")}, {**INTENT, "t": at("22:10"), "item": "PR 1"}),
                    "has no result"),
    "time goes back": (journal({**GO, "t": at("22:01")}, {"t": at("22:20"), "kind": "alive"},
                               {"t": at("22:05"), "kind": "alive"}),
                       "time goes back"),
    "intent on a denied item": (journal({**GO, "t": at("22:01")},
                                        {"t": at("22:10"), "kind": "denied", "item": "PR 3", "command": "merge 3", "blocks": "x"},
                                        {**INTENT, "t": at("22:20"), "item": "PR 3"},
                                        {"t": at("22:21"), "kind": "result", "of": 4, "outcome": "done", "item": "PR 3"}),
                                "which was denied"),
    "intent after a denied result": (journal({**GO, "t": at("22:01")},
                                             {**INTENT, "t": at("22:10"), "item": "PR 3"},
                                             {"t": at("22:11"), "kind": "result", "of": 3, "outcome": "denied", "item": "PR 3", "blocks": "x"},
                                             {**INTENT, "t": at("22:20"), "item": "pull/3"},
                                             {"t": at("22:21"), "kind": "result", "of": 5, "outcome": "done", "item": "pull/3"}),
                                     "which was denied"),
    "decision with no source": (journal({**GO, "t": at("22:01")}, {"t": at("22:10"), "kind": "decision", "text": "x"}),
                                "no source and no owner check"),
    "intent after the stop": (journal({**GO, "t": at("22:01"), "stop": at("22:30")},
                                      {"t": at("22:20"), "kind": "alive"},
                                      {**INTENT, "t": at("22:40"), "item": "PR 1"},
                                      {"t": at("22:41"), "kind": "result", "of": 4, "outcome": "done", "item": "PR 1"}),
                              "after the stop time"),
    "no go": (journal({"t": at("22:10"), "kind": "alive"}), "no go"),
    "denied row with no command": (journal({**GO, "t": at("22:01")},
                                           {"t": at("22:10"), "kind": "denied", "item": "PR 3", "blocks": "x"}),
                                   "no exact command"),
    "intent on a held item": (journal({**GO, "t": at("22:01")},
                                      {"t": at("22:10"), "kind": "hold", "item": "PR 12", "text": "owner-only file"},
                                      {**INTENT, "t": at("22:20"), "item": "#12"},
                                      {"t": at("22:21"), "kind": "result", "of": 4, "outcome": "done", "item": "#12"}),
                              "which was held"),
    "gap alarm above the maximum": (journal({**GO, "t": at("22:01"), "heartbeat_min": 600, "gap_min": 1200},
                                            {"t": at("23:15"), "kind": "alive"}),
                                    "gap of 74 min"),
    "stop passed, not closed": (journal({**GO, "t": at("22:01"), "stop": at("23:00")},
                                        {"t": at("22:30"), "kind": "alive"}, {"t": at("22:59"), "kind": "alive"}),
                                "not closed"),
}


def write(folder, events):
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, "journal.jsonl"), "w", encoding="utf-8") as handle:
        for event in events:
            handle.write(json.dumps(event) + "\n")


def read_report(folder):
    with open(os.path.join(folder, "report.md"), encoding="utf-8") as handle:
        return handle.read()


def part(report, title, next_title):
    return report.split(title)[1].split(next_title)[0]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = os.path.join(self.tmp.name, "night")

    def tearDown(self):
        self.tmp.cleanup()

    def events(self):
        with open(os.path.join(self.dir, "journal.jsonl"), encoding="utf-8") as handle:
            return [json.loads(line) for line in handle if line.strip()]

    def ok(self, result):
        code, out = result
        self.assertEqual(code, 0, out)
        return out

    def refused(self, *args, at=T0, says="", env=None):
        code, out = run(self.dir, *args, at=at, env=env)
        self.assertEqual(code, 3, out)
        self.assertIn("REFUSED", out)
        self.assertIn(says, out)
        return out


class StartTests(Base):
    def test_new_records_exact_words_from_a_file_and_clock_time(self):
        text = 'goal: X; "quoted" $HOME `tick`; until 06:00'
        self.ok(new(self.dir, text, when=at("21:59")))
        first = self.events()[0]
        self.assertEqual(first["words"], text)
        self.assertEqual(first["t"], at("21:59"))
        with open(os.path.join(self.dir, "card.md"), encoding="utf-8") as handle:
            self.assertIn(text, handle.read())

    def test_new_refuses_an_empty_words_file(self):
        self.refused("new", "--words-file", words_file(self.dir, "  \n"), says="exact words")

    def test_second_new_in_one_folder_is_refused(self):
        new(self.dir)
        self.refused("new", "--words-file", words_file(self.dir, "w"), says="One folder holds one night")

    def test_go_needs_a_stop_time_and_a_rehearsal_state(self):
        new(self.dir)
        for missing in (["--goal", "set", "--rehearsal", "passed"], ["--stop", "06:00", "--goal", "set"]):
            with self.subTest(args=missing):
                code, out = run(self.dir, "go", *missing)
                self.assertEqual(code, 2, out)

    def test_go_has_no_goal_not_set_path(self):
        new(self.dir)
        code, out = run(self.dir, "go", "--stop", "06:00", "--goal", "not-set", "--rehearsal", "passed")
        self.assertEqual(code, 2, out)

    def test_go_records_an_environment_with_no_goal_command(self):
        new(self.dir, when=at("22:00"))
        self.ok(run(self.dir, "go", "--stop", "06:00", "--goal", "no-goal-command", "--rehearsal", "passed", at=at("22:01")))
        self.assertEqual(self.events()[-1]["goal"], "no-goal-command")

    def test_go_with_a_past_stop_time_is_refused(self):
        new(self.dir, when=at("22:00"))
        self.refused("go", "--stop", at("21:00"), "--goal", "set", "--rehearsal", "passed", at=at("22:01"),
                     says="not in the future")

    def test_second_go_is_refused(self):
        started(self.dir)
        self.refused("go", "--stop", "2026-01-11T06:00+00:00", "--goal", "set", "--rehearsal", "passed",
                     at=at("22:05"), says="already has a go")

    def test_gap_alarm_cannot_go_above_the_maximum(self):
        new(self.dir, when=at("22:00"))
        go = ["go", "--stop", "06:00", "--goal", "set", "--rehearsal", "passed"]
        self.refused(*go, "--heartbeat-min", "600", at=at("22:01"), says="at most 60")
        self.refused(*go, "--gap-min", "90", at=at("22:01"), says="at most 60")
        self.refused(*go, "--gap-min", "60", at=at("22:01"), env={"NIGHT_MAX_GAP_MIN": "45"}, says="at most 45")
        self.ok(run(self.dir, *go, "--heartbeat-min", "20", "--gap-min", "40", at=at("22:01")))
        self.assertEqual(self.events()[-1]["gap_min"], 40)

    def test_log_before_new_is_refused(self):
        self.refused("log", "alive", "x", says="run `new` first")


class ActionTests(Base):
    def test_intent_before_go_is_refused(self):
        new(self.dir)
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", *HEAD, says="no go")

    def test_intent_after_the_stop_time_is_refused(self):
        started(self.dir, stop="2026-01-10T23:00")
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", *HEAD, at=at("23:00"), says="has passed")

    def test_intent_needs_a_passed_rehearsal_or_an_owner_override(self):
        started(self.dir, rehearsal="none")
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", *HEAD, at=at("22:10"), says="rehearsal")
        other = os.path.join(self.tmp.name, "override")
        started(other, rehearsal="owner-override")
        self.ok(intent(other, "PR 1", at("22:10")))

    def test_intent_needs_the_reviewed_head_and_the_head_now(self):
        started(self.dir)
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", at=at("22:10"), says="needs --head <")
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", "--head-now", "abc1234", at=at("22:10"),
                     says="needs --head <")
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", "--head", "abc1234", at=at("22:10"),
                     says="needs --head-now <")
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", "--head", "abc1234", "--head-now", "def5678",
                     at=at("22:10"), says="the head moved")
        self.ok(run(self.dir, "log", "intent", "--item", "PR 1", "--command", "merge 1", "--head", "ABC1234",
                    "--head-now", "abc1234ffff", at=at("22:11")))
        self.ok(run(self.dir, "log", "intent", "--item", "release", "--command", "tag v1", "--no-head", "a tag has no head",
                    at=at("22:12")))

    def test_denied_item_stays_denied_until_an_owner_amend_opens_it(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "denied", "--item", "PR 3", "--command", "gh pr merge 3", "--blocks", "PR 4", at=at("22:10")))
        self.refused("log", "intent", "--item", "PR 3", "--command", "gh pr merge 3 --admin", *HEAD, at=at("22:20"),
                     says="denied stays denied")
        self.ok(amend(self.dir, "yes: merge PR 3 now", "--reopen", "PR 3", when=at("22:30")))
        self.ok(intent(self.dir, "PR 3", at("22:31")))

    def test_a_denied_result_blocks_the_item_in_one_write(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 3", at("22:10")))
        self.refused("log", "result", "--of", "E3", "--outcome", "denied", at=at("22:11"), says="--blocks")
        self.ok(run(self.dir, "log", "result", "--of", "E3", "--outcome", "denied", "--blocks", "PR 4", "permission check",
                    at=at("22:11")))
        self.refused("log", "intent", "--item", "PR 3", "--command", "gh pr merge 3", *HEAD, at=at("22:12"),
                     says="denied stays denied")
        # A restart: a new process reads only the journal, and the block holds.
        self.ok(run(self.dir, "status", at=at("23:00")))
        self.refused("log", "intent", "--item", "pull/3", "--command", "gh pr merge 3", *HEAD, at=at("23:01"),
                     says="denied stays denied")

    def test_denied_row_with_an_open_intent_points_to_the_denied_result(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 3", at("22:10")))
        self.refused("log", "denied", "--item", "PR 3", "--command", "gh pr merge 3", "--blocks", "x", at=at("22:11"),
                     says="--outcome denied")

    def test_amend_and_answer_need_the_exact_words_from_a_file(self):
        started(self.dir)
        self.refused("log", "amend", "--reopen", "PR 3", at=at("22:10"), says="--words-file")
        self.refused("log", "amend", "yes", "--reopen", "PR 3", at=at("22:10"), says="--words-file")
        self.refused("log", "amend", "yes", "--words-file", words_file(self.dir, "no"), at=at("22:10"),
                     says="not as an argument")
        self.refused("log", "amend", "--words-file", words_file(self.dir, "\n"), at=at("22:10"), says="empty")
        self.refused("log", "answer", "Q1: A", at=at("22:10"), says="--words-file")
        self.ok(amend(self.dir, "stop at 05:00", when=at("22:11")))
        self.assertEqual(self.events()[-1]["text"], "stop at 05:00")

    def test_one_pr_has_one_name_in_each_form(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "denied", "--item", "PR 3", "--command", "gh pr merge 3", "--blocks", "x", at=at("22:10")))
        for other in ("#3", "pr3", "Pr #3", "PR-3", "pull/3", "owner/repo#3", "3.", "3",
                      "https://github.com/owner/repo/pull/3", "pull request 3"):
            with self.subTest(item=other):
                self.refused("log", "intent", "--item", other, "--command", "merge", *HEAD, at=at("22:11"),
                             says="denied stays denied")
        self.ok(intent(self.dir, "PR 31", at("22:12")))

    def test_second_intent_while_the_first_has_no_result_is_refused(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", *HEAD, at=at("22:12"), says="no result")

    def test_unknown_result_can_get_a_later_result_but_done_cannot(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.ok(run(self.dir, "log", "result", "--of", "3", "--outcome", "unknown", at=at("22:11")))
        self.ok(run(self.dir, "log", "result", "--of", "3", "--outcome", "done", "merged", at=at("22:15")))
        self.refused("log", "result", "--of", "3", "--outcome", "failed", at=at("22:16"), says="already has the result")

    def test_decision_needs_a_source_or_an_owner_check(self):
        started(self.dir)
        self.refused("log", "decision", "keep the old name", at=at("22:10"), says="needs --source")
        self.ok(run(self.dir, "log", "decision", "keep it", "--check", at=at("22:11")))

    def test_denied_row_needs_command_and_blocks(self):
        started(self.dir)
        self.refused("log", "denied", "--item", "PR 3", at=at("22:10"), says="--command and --blocks")

    def test_hold_blocks_an_intent_until_an_owner_amend_opens_it(self):
        started(self.dir)
        self.refused("log", "hold", "--item", "PR 12", at=at("22:05"), says="needs --item and the reason")
        self.ok(run(self.dir, "log", "hold", "changes an owner-only file", "--item", "PR 12", at=at("22:06")))
        self.refused("log", "intent", "--item", "PR 12", "--command", "merge 12", *HEAD, at=at("22:07"), says="hold stays hold")
        self.ok(amend(self.dir, "yes: merge PR 12", "--reopen", "PR 12", when=at("22:08")))
        self.ok(intent(self.dir, "PR 12", at("22:09")))

    def test_unknown_result_blocks_a_new_intent_until_a_new_result(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.ok(run(self.dir, "log", "result", "--of", "3", "--outcome", "unknown", "timeout", at=at("22:11")))
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", *HEAD, at=at("22:12"), says="is unknown")
        self.ok(run(self.dir, "log", "result", "--of", "E3", "--outcome", "failed", "not merged", at=at("22:13")))
        self.ok(intent(self.dir, "PR 1", at("22:14")))

    def test_bare_time_of_day_is_the_next_such_time(self):
        new(self.dir, when=at("22:00"))
        self.ok(run(self.dir, "go", "--stop", "06:00", "--goal", "set", "--rehearsal", "passed", at=at("22:01")))
        self.assertEqual(self.events()[-1]["stop"], "2026-01-11T06:00:00+00:00")


class CheckTests(Base):
    def test_each_broken_journal_fails_check(self):
        for name, (events, expected) in BROKEN.items():
            with self.subTest(name=name):
                folder = os.path.join(self.tmp.name, name.replace(" ", "-").replace(",", ""))
                write(folder, events)
                code, out = run(folder, "check", at=at("23:50"))
                self.assertEqual(code, 1, out)
                self.assertIn(expected, out)

    def test_good_night_passes_check(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "alive", "working", at=at("22:40")))
        self.ok(intent(self.dir, "PR 1", at("23:10")))
        self.ok(run(self.dir, "log", "result", "--of", "4", "--outcome", "done", "merged at abc123", at=at("23:11")))
        code, out = run(self.dir, "check", at=at("23:40"))
        self.assertEqual((code, out.strip()), (0, "check: OK"))

    def test_check_now_finds_a_silent_period_up_to_now(self):
        started(self.dir)
        self.ok(run(self.dir, "log", "alive", "x", at=at("22:30")))
        self.assertEqual(run(self.dir, "check", at=at("23:50"))[0], 0)
        code, out = run(self.dir, "check", "--now", at=at("23:50"))
        self.assertEqual(code, 1, out)
        self.assertIn("gap of 80 min from E3 to now", out)

    def test_check_now_after_a_dead_session_does_not_stop_at_the_stop_time(self):
        started(self.dir, stop="2026-01-11T06:00")
        for hhmm in ("22:30", "23:00", "23:30"):
            self.ok(run(self.dir, "log", "alive", "x", at=at(hhmm)))
        for hhmm in ("00:00", "00:30", "01:00", "01:30", "02:00", "02:30", "03:00", "03:30", "04:00",
                     "04:30", "05:00", "05:30"):
            self.ok(run(self.dir, "log", "alive", "x", at=at(hhmm, "2026-01-11")))
        code, out = run(self.dir, "check", "--now", at=at("13:00", "2026-01-11"))
        self.assertEqual(code, 1, out)
        self.assertIn("gap of 450 min", out)
        self.assertIn("not closed", out)


class CloseTests(Base):
    def night_with_report(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 3", at("22:10")))
        self.ok(run(self.dir, "log", "result", "--of", "E3", "--outcome", "denied", "--blocks", "PR 4", at=at("22:11")))
        self.ok(run(self.dir, "log", "wait", "needs the owner's choice", "--item", "PR 2", at=at("22:12")))
        self.ok(run(self.dir, "log", "wait", "needs a review", "--item", "PR 5", at=at("22:13")))
        self.ok(run(self.dir, "log", "decision", "review done", "--item", "PR 5", "--source", "rule 1", "--resolves", "E6",
                    at=at("22:14")))
        self.ok(intent(self.dir, "PR 1", at("22:20")))
        self.ok(run(self.dir, "log", "result", "--of", "8", "--outcome", "unknown", "timeout", at=at("22:21")))
        self.ok(run(self.dir, "log", "error", "I typed a wrong count; corrected", at=at("22:25")))
        self.ok(run(self.dir, "report", at=at("22:30")))

    def page_checks(self, when):
        for name in ("mechanics", "truth", "counts"):
            self.ok(run(self.dir, "log", "pagecheck", "--name", name, "--outcome", "pass", at=when))

    def test_report_lists_what_needs_the_owner(self):
        self.night_with_report()
        report = read_report(self.dir)
        needs = part(report, "## Needs you", "## My errors")
        self.assertIn("merge PR 3", needs)
        self.assertIn("denied", needs)
        self.assertIn("PR 2", needs)
        self.assertNotIn("PR 5", needs)
        self.assertIn("result unknown", needs)
        self.assertIn("I typed a wrong count", report)
        self.assertIn("The night is not closed", report)

    def test_report_counts_include_the_report_event(self):
        self.night_with_report()
        counts = part(read_report(self.dir), "## Counts", "## Permissions")
        self.assertIn("| report | 1 |", counts)

    def test_close_writes_the_report_again_with_the_gap_and_ended_permissions(self):
        self.night_with_report()
        self.page_checks(at("22:31"))
        out = self.ok(run(self.dir, "close", "--reason", "nothing-left", at=at("23:41")))
        self.assertIn("NIGHT CLOSED night-20260110T2200Z reason nothing-left", out)
        report = read_report(self.dir)
        self.assertIn("gap of 70 min", part(report, "## Stops and gaps", "## Decisions to check"))
        permissions = report.split("## Permissions")[1]
        self.assertIn("ended at the close", permissions)
        self.assertNotIn("end at the close", permissions)
        self.assertIn("| close | 1 |", part(report, "## Counts", "## Permissions"))

    def test_close_needs_a_fresh_report_and_three_page_checks(self):
        self.night_with_report()
        self.refused("close", "--reason", "nothing-left", at=at("22:40"), says="mechanics, truth, counts")
        self.ok(run(self.dir, "log", "aware", "late note", at=at("22:41")))
        self.page_checks(at("22:42"))
        self.refused("close", "--reason", "nothing-left", at=at("22:43"), says="run `report` again")
        self.ok(run(self.dir, "report", at=at("22:44")))
        self.page_checks(at("22:45"))
        self.ok(run(self.dir, "close", "--reason", "nothing-left", at=at("22:46")))

    def test_close_with_an_open_intent_is_refused(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        self.ok(run(self.dir, "report", at=at("22:11")))
        self.refused("close", "--reason", "stop-time", "--without-page", "test", at=at("22:12"), says="intents with no result")

    def test_after_the_close_only_notes_and_answers(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:10")))
        self.ok(run(self.dir, "close", "--reason", "nothing-left", "--without-page", "no page tool", at=at("22:11")))
        self.refused("log", "intent", "--item", "PR 1", "--command", "merge 1", *HEAD, at=at("22:12"), says="the night is closed")
        self.refused("log", "decision", "x", "--check", at=at("22:12"), says="the night is closed")
        self.ok(run(self.dir, "log", "answer", "--words-file", words_file(self.dir, "Q1: A"), at=at("08:00", "2026-01-11")))


class ShowRedTests(unittest.TestCase):
    def test_show_red_fails_when_a_broken_journal_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            with open(os.path.join(HERE, "night.py"), encoding="utf-8") as handle:
                source = handle.read()
            marker = 'out.append(f"time goes back'
            self.assertIn(marker, source)
            broken_copy = os.path.join(tmp, "night.py")
            with open(broken_copy, "w", encoding="utf-8") as handle:
                handle.write(source.replace(marker, 'pass  # ' + marker))
            env = {"PATH": os.environ.get("PATH", ""), "NIGHT_PY": broken_copy}
            done = subprocess.run([sys.executable, "-I", os.path.abspath(__file__), "--show-red"],
                                  capture_output=True, text=True, env=env, check=False)
            self.assertEqual(done.returncode, 1, done.stdout + done.stderr)
            self.assertIn("NOT RED: time goes back", done.stdout)


def show_red():
    """Print the check run of each broken journal; exit 1 if one does not fail as expected."""
    misses = []
    with tempfile.TemporaryDirectory() as tmp:
        for name, (events, expected) in BROKEN.items():
            folder = os.path.join(tmp, name.replace(" ", "-").replace(",", ""))
            write(folder, events)
            code, out = run(folder, "check", at=at("23:50"))
            print(f"## {name}\nexpected text: {expected!r}\nexit code: {code}\n{out}")
            if code != 1 or expected not in out:
                misses.append(name)
    for name in misses:
        print(f"NOT RED: {name}")
    print("ALL RED" if not misses else f"{len(misses)} broken journal(s) did not fail")
    return 1 if misses else 0


if __name__ == "__main__":
    if "--show-red" in sys.argv:
        sys.exit(show_red())
    unittest.main()
