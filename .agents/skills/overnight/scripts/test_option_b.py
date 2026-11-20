"""Option B tests. GitHub requests use a fake gh with synthetic data."""
import fcntl
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).parent))
from night_testlib import NIGHT, SHA, SHA2, at, card, new, night_module, run, started, write, words_file

TARGET = "github.com/example/app#12"
OTHER = "github.com/example/app#13"
PAIR = [
    dict(provider="claude", model="opus-5.5", effort="high", role="reviewer"),
    dict(provider="codex", model="gpt-6.2-astra", effort="high", role=""),
]
LOWER = [PAIR[0], dict(provider="codex", model="gpt-6.1-sol", effort="high", role="reviewer")]
EVIDENCE = dict(reports=["trace:claude", "trace:codex"], ci=["check:12"], ledger=["ledger:checked"], p3=["P3: remove old text"])
POLICY = dict(allowed=PAIR, roles={"claude:reviewer": PAIR[0], "codex:reviewer": LOWER[1]})
ROWS = [("notice", "night"), ("release", "owner"), ("merge app", "merge", TARGET, "main", "squash", "leader"),
        ("merge other", "merge", OTHER, "main", "squash", "leader")]


class OptionBTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.chief = self.root / "chief"
        self.worktree = self.root / "leader"

    def command(self, *args, time="22:10", env=None):
        return run(str(self.chief), *args, at=at(time), env=env)

    def expect(self, outcome, code):
        self.assertEqual(outcome[0], 3, outcome[1])
        self.assertIn(f"[{code}]", outcome[1])
        self.assertNotIn("Traceback", outcome[1])

    def ok(self, outcome):
        self.assertEqual(outcome[0], 0, outcome[1])
        return outcome[1]

    def journal(self):
        return self.chief / "journal.jsonl"

    def entries(self):
        return [json.loads(line) for line in self.journal().read_text().splitlines()]

    def input(self, name, data):
        path = self.root / name
        path.write_text(json.dumps(data))
        return str(path)

    def begin(self, cap=None, rehearsal="passed", empty=False):
        self.ok(new(str(self.chief), "overnight fixture"))
        card(str(self.chief), ROWS[:2] if empty else ROWS)
        options = [] if cap is None else ["--review-cap", str(cap)]
        self.ok(self.command("go", "--stop", "23:00Z", "--goal", "set", "--rehearsal", rehearsal,
                             "--chief", "chief", "--review-policy", self.input("policy.json", POLICY),
                             "--allow-empty-checks", *options, time="22:01"))
        self.run_id = self.entries()[0]["run"]
        self.worktree.mkdir()

    def assign(self, target=TARGET, pair=PAIR, time="22:02", **updates):
        fields = dict(chief="chief", target=target, leader="leader", reviewers=pair, helpers=["implementer"],
                      worktree=str(self.worktree))
        fields.update(updates)
        return self.command("assign", "--data", self.input("assign.json", fields), time=time)

    def grant(self, target=TARGET, head=SHA, time="22:03", **updates):
        fields = dict(chief="chief", run=self.run_id, target=target, head=head, leader="leader", base="main",
                      method="squash", assignment=3, reviewers=PAIR, evidence=EVIDENCE)
        fields.update(updates)
        return self.command("grant", "--data", self.input("grant.json", fields), time=time)

    def round(self, number, blocked=True, target=TARGET, time="22:08"):
        reports = [dict(who=who, head=SHA, source=f"{who['provider']}:{number}", p1=["open"] if blocked else [],
                        p2=[], p3=["P3: tiny"]) for who in PAIR]
        fields = dict(target=target, leader="leader", reports=reports,
                      spec=dict(done="work done", findings=[dict(severity="P1", text="open")], next="next step"))
        return self.command("review", "--data", self.input("round.json", fields), time=time)

    def test_retired_gate_and_typed_consumers(self):
        for name in ("night_hook.py", "test_hook.py", "test_command.py"):
            self.assertFalse(Path(NIGHT).with_name(name).exists())
        self.begin()
        data = json.loads(self.ok(self.command("status", "--json")))
        self.assertIn(dict(name="notice", kind="night", **{"from": "E2"}), data["items"])
        self.assertIn(TARGET, json.dumps(data))
        self.ok(self.command("report"))
        report = (self.chief / "report.md").read_text()
        self.assertIn("| notice | night | E2 |", report)
        self.assertIn(TARGET, report)

    def test_format_boundary(self):
        for version in (1, None, 3):
            for row in (["work", "commit"], ["work", "commit", "words"]):
                with self.subTest(version=version, row=row):
                    if self.chief.exists():
                        shutil.rmtree(self.chief)
                    self.ok(new(str(self.chief), "fixture"))
                    entries = self.entries()
                    if version is None:
                        entries[0].pop("format", None)
                    else:
                        entries[0]["format"] = version
                    before = (json.dumps(entries[0]) + "\n" + json.dumps(row)).encode()
                    self.journal().write_bytes(before)
                    for command in ("status", "report", "repair", "check", "render", "items"):
                        self.expect(self.command(command), "FORMAT_UNSUPPORTED")
                        self.assertEqual(self.journal().read_bytes(), before)

    def test_stop_offset(self):
        self.ok(new(str(self.chief), "fixture"))
        card(str(self.chief), ROWS[:2])
        for stop in ("06:00+25:00", "06:00+07:99", "06:00+24:00"):
            with self.subTest(stop=stop):
                self.expect(self.command("go", "--stop", stop, "--goal", "set", "--rehearsal", "passed"),
                            "STOP_NO_OFFSET")
        self.ok(self.command("go", "--stop", "06:00+07:59", "--goal", "set", "--rehearsal", "passed"))

    def test_grant_scope_and_duplicate(self):
        self.begin()
        self.ok(self.assign())
        self.expect(self.grant(run="20087b2e-e691-4d67-abda-d576d83d5faa"), "MERGE_PERMISSION_NIGHT")
        self.expect(self.grant(head="1234"), "HEAD_FORM")
        self.expect(self.grant(target="github.com/example/app#99"), "MERGE_PR_NOT_ON_CARD")
        self.expect(self.grant(chief="leader"), "MERGE_CHIEF_ONLY")
        self.ok(self.grant())
        self.expect(self.grant(), "MERGE_PERMISSION_DUPLICATE")
        self.assertEqual([e["kind"] for e in self.entries()].count("merge-permission"), 1)

    def test_grant_same_minute(self):
        self.ok(new(str(self.chief), "fixture"))
        first = self.entries()[0]["run"]
        self.chief = self.root / "other-chief"
        self.ok(new(str(self.chief), "fixture"))
        self.assertNotEqual(first, self.entries()[0]["run"])

    def test_grant_reviewer_assignment(self):
        self.begin()
        self.expect(self.grant(), "REVIEWER_NOT_ASSIGNED")
        self.expect(self.assign(pair=LOWER), "REVIEWER_NOT_ASSIGNED")
        self.ok(self.assign())
        for field, value in dict(provider="codex", model="opus-5.6", effort="medium", role="").items():
            with self.subTest(field=field):
                self.expect(self.grant(reviewers=[dict(PAIR[0], **{field: value}), PAIR[1]]),
                            "REVIEWER_NOT_ASSIGNED")
        self.ok(self.assign(time="22:03"))
        self.expect(self.grant(time="22:04"), "REVIEWER_NOT_ASSIGNED")
        self.ok(self.grant(time="22:04", assignment=4))

    def test_review_cap_stops_only_a_blocking_round(self):
        self.begin(cap=2)
        self.ok(self.assign())
        self.assertEqual(self.entries()[1]["review_cap"], 2)
        card(str(self.chief), ROWS[:2])
        self.ok(self.round(1))
        self.ok(self.round(1))
        self.assertIn(" cap", self.ok(self.round(2)))
        self.expect(self.round(3), "REVIEW_CAP_REACHED")
        self.expect(self.grant(time="22:09"), "REVIEW_CAP_REACHED")
        path, = self.worktree.glob(".overnight/*/*/leader-events.jsonl")
        self.assertEqual([json.loads(line)["kind"] for line in path.read_text().splitlines()], ["review", "cap"])
        self.ok(self.command("report"))
        report = (self.chief / "report.md").read_text().split("## Needs you", 1)[1].split("## Merge attempts", 1)[0]
        for phrase in (TARGET, "work done", "P1", "next step"):
            self.assertIn(phrase, report)

    def test_review_cap_default_refuses_round_six(self):
        self.begin()
        self.ok(self.assign())
        self.assertEqual(self.entries()[1]["review_cap"], 5)
        for number in range(1, 5):
            self.assertIn(" review", self.ok(self.round(number)))
        self.assertIn(" cap", self.ok(self.round(5)))
        self.expect(self.round(6), "REVIEW_CAP_REACHED")

    def test_p3_round_goes_to_permission_at_cap(self):
        self.begin(cap=2)
        self.ok(self.assign())
        self.ok(self.round(1))
        self.assertIn(" review", self.ok(self.round(2, blocked=False)))
        self.ok(self.grant(time="22:09"))
        self.assertNotIn("cap", [e["kind"] for e in self.entries()])

    def test_invalid_go_or_grant_fields_refuse(self):
        self.ok(new(str(self.chief), "fixture"))
        card(str(self.chief), ROWS)
        go = ["go", "--stop", "23:00Z", "--goal", "set", "--rehearsal", "passed"]
        self.expect(self.command(*go, "--review-cap", "0"), "REVIEW_CAP_FORM")
        self.expect(self.command(*go), "MERGE_NOT_ALLOWED")
        self.ok(self.command(*go, "--chief", "chief", "--review-policy", self.input("policy.json", POLICY), time="22:01"))
        self.run_id = self.entries()[0]["run"]
        self.ok(self.assign())
        self.expect(self.grant(evidence={}), "MERGE_EVIDENCE_INVALID")

    def test_first_entry_rule(self):
        module = night_module()
        night = module.Night()
        faults = module.rule_order(night, {"kind": "alive", "id": 1})
        self.assertEqual(faults[0][0], "FIRST_NOT_NEW")

    def test_root_allocation_preserves_existing_run(self):
        import uuid
        folder = self.root / "nights"
        folder.mkdir()
        first = uuid.UUID("5834abd5-a023-4ae8-9d4b-cd8e15e535e5")
        second = uuid.UUID("f439bd7e-1793-4524-9bcd-353fa620c22d")
        already = folder / str(first)
        already.mkdir()
        (already / "marker").write_text("first night")
        source = words_file(str(self.chief), "fixture")
        module = night_module()
        with patch.dict(os.environ, {"NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:00")}), patch(
                "uuid.uuid4", side_effect=[first, second]):
            self.assertEqual(module.main(["new", "--root", str(folder), "--words-file", source]), 0)
        self.assertEqual((already / "marker").read_text(), "first night")
        self.assertTrue((folder / str(second) / "journal.jsonl").is_file())

    def test_report_recovers_complete_append_without_second_entry(self):
        started(str(self.chief))
        module = night_module()
        with patch.dict(os.environ, {"NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:02")}), patch(
                "os.fsync", side_effect=OSError(5, "sync failed after write")):
            self.assertEqual(module.main(["report", "--dir", str(self.chief)]), 3)
        self.assertEqual([e["kind"] for e in self.entries()].count("report"), 1)
        self.ok(self.command("report"))
        self.assertEqual([e["kind"] for e in self.entries()].count("report"), 1)
        self.assertTrue((self.chief / "report.md").exists())

    def test_grant_readback_after_failed_sync(self):
        self.begin()
        self.ok(self.assign())
        fields = dict(chief="chief", run=self.run_id, target=TARGET, head=SHA, leader="leader", base="main",
                      method="squash", assignment=3, reviewers=PAIR, evidence=EVIDENCE)
        module = night_module()
        data = self.input("grant.json", fields)
        with patch.dict(os.environ, {"NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:03")}), patch(
                "os.fsync", side_effect=OSError(5, "grant sync")):
            self.assertEqual(module.main(["grant", "--dir", str(self.chief), "--data", data]), 3)
        before = self.journal().read_bytes()
        self.expect(self.grant(), "MERGE_PERMISSION_DUPLICATE")
        self.assertEqual(self.journal().read_bytes(), before)
        self.assertEqual([e["kind"] for e in self.entries()].count("merge-permission"), 1)

    def test_cleanup_owns_temp(self):
        self.ok(new(str(self.chief), "fixture"))
        unrelated = self.chief / ".report.md.other.tmp"
        unrelated.write_text("other writer")
        card(str(self.chief), ROWS[:2])
        self.ok(self.command("go", "--stop", "23:00Z", "--goal", "set", "--rehearsal", "passed"))
        self.ok(self.command("report"))
        self.assertTrue(unrelated.exists(), "report removed an unrelated temp file")

    def test_repair_resumes_at_the_same_cut(self):
        started(str(self.chief))
        with self.journal().open("ab") as file:
            file.write(b"partial")
        module = night_module()
        with patch.dict(os.environ, {"NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:02")}), patch("os.truncate", side_effect=OSError(5, "before truncate")):
            self.assertEqual(module.main(["repair", "--dir", str(self.chief)]), 3)
        self.assertEqual(len(list(self.chief.glob("journal.cut-*.txt"))), 1)
        self.expect(self.command("log", "alive", "other write"), "REPAIR_PENDING")
        self.ok(self.command("repair"))
        self.assertEqual(len(list(self.chief.glob("journal.cut-*.txt"))), 1)
        self.assertEqual([e["kind"] for e in self.entries()].count("repair"), 1)


if __name__ == "__main__":
    unittest.main()
