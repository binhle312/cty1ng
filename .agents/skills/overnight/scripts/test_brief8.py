"""Exercise the chief review flow with a local checkout and a fake GitHub CLI."""
import json
import os
from pathlib import Path
import sys
from subprocess import CalledProcessError
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
from night_review_testlib import ReviewFixture, TARGET, OTHER
from test_option_b import LOWER
from night_testlib import at, night_module


class Brief8Tests(ReviewFixture, unittest.TestCase):
    def test_chief_starts_review(self):
        self.begin()
        self.expect(self.start(chief="leader"), "MERGE_CHIEF_ONLY")
        self.ok(self.start())
        self.expect(self.start(chief="leader"), "MERGE_CHIEF_ONLY")
        brief = self.entries()[-1]["brief"]
        self.assertTrue(Path(brief).is_relative_to(self.reviews))
        self.assertIn(self.head, Path(brief).read_text())

    def test_same_head_reports_cannot_cross_prs(self):
        self.begin()
        self.ok(self.start(TARGET))
        reports = self.reports()
        self.ok(self.start(OTHER))
        before = self.journal().read_bytes()
        self.expect(self.typed("review", chief="chief", target=OTHER, reports=reports,
                               ledger=["ledger fixture"]), "REVIEW_REPORT")
        self.assertEqual(self.journal().read_bytes(), before)
        self.expect(self.grant(reports), "REVIEW_START_REQUIRED")

    def test_report_verdict_refuses_wrong_target_alone(self):
        self.begin(second=False)
        self.ok(self.start())
        reports = self.reports()
        report = Path(reports[0])
        text = report.read_text()
        report.write_text(text.replace(TARGET, OTHER))
        before = self.journal().read_bytes()
        self.expect(self.typed("review", chief="chief", target=TARGET, reports=reports,
                               ledger=["ledger fixture"]), "REVIEW_REPORT")
        self.assertEqual(self.journal().read_bytes(), before)

    def test_merge_bonus_is_frozen_per_pr(self):
        self.begin()
        initial = self.head
        self.git("switch", "-qc", "side", self.main)
        self.commit("side.txt", "side change")
        self.git("switch", "-q", "--detach", initial)
        self.git("merge", "--no-ff", "--no-edit", "side")
        self.head = self.git("rev-parse", "HEAD")
        self.config()
        self.ok(self.start())
        self.assertEqual(self.entries()[-1]["cap"], 5)
        self.update_main(1)
        self.ok(self.start())
        first = self.entries()[-1]
        self.assertEqual(first["cap"], 8)
        self.assertEqual(first["main_merges"], [self.head])
        with (self.chief / "card.md").open("a") as card:
            card.write("\nreview_cap: 1\nmerge_main_bonus: 1\n")
        self.ok(self.typed("review", chief="chief", target=TARGET, ledger=["ledger fixture"], reports=self.reports()))
        self.update_main(2)
        self.ok(self.start())
        self.assertEqual(self.entries()[-1]["cap"], 11)
        self.expect(self.start(head="1" * 40), "MERGE_HEAD_CHANGED")
        self.assertEqual(self.entries()[1]["merge_main_bonus"], 3)

    def test_later_clean_round_preserves_prior_p3(self):
        self.begin(second=False)
        self.complete(p3=["Prior risk remains visible"])
        self.head = self.commit("owned.txt", "Change reviewed head")
        self.config()
        reports = self.complete()
        self.expect(self.grant(reports), "REVIEW_FINDINGS_OPEN")
        self.ok(self.command("report"))
        self.assertIn("Prior risk remains visible", (self.chief / "report.md").read_text())

    def test_p3_needs_fix_then_advisor_at_cap(self):
        self.begin(cap=2, consult=True)
        paths = self.complete(p3=["small item"])
        self.expect(self.grant(paths), "REVIEW_FINDINGS_OPEN")
        self.head = self.commit("owned.txt", "fix first P3")
        self.config(body="small item")
        paths = self.complete(p3=["small item"])
        self.expect(self.grant(paths), "REVIEW_ADVICE_REQUIRED")
        self.expect(self.typed("advice", chief="chief", target=TARGET, advisor="allow", consultants=[]),
                    "REVIEW_ADVICE_REQUIRED")
        self.ok(self.typed("advice", chief="chief", target=TARGET, advisor="allow", consultants=["allow"]))
        self.ok(self.grant(paths))
        self.ok(self.command("report"))
        report = (self.chief / "report.md").read_text()
        self.assertIn("small item", report)
        self.assertIn("| github.com/example/app#12 | allow | allow |", report)

    def test_new_head_needs_full_round(self):
        self.begin()
        paths = self.complete()
        self.head = self.commit("owned.txt", "another PR commit")
        self.config()
        self.expect(self.grant(paths), "MERGE_HEAD_CHANGED")
        self.update_main(1)
        self.expect(self.grant(paths), "MERGE_HEAD_CHANGED")
        self.ok(self.start())
        review = self.entries()[-1]
        self.assertEqual(review["merge_base"], self.main)
        self.assertEqual(review["files"], ["owned.txt"])
        self.assertEqual(review["main_merges"], [self.head])

    def test_review_brief_shows_main_intersection_and_resolution(self):
        self.begin()
        self.complete()
        self.git("switch", "-q", "main")
        self.main = self.commit("owned.txt", "independent change from main")
        self.git("switch", "-q", "--detach", self.head)
        with self.assertRaises(CalledProcessError):
            self.git("merge", "--no-ff", "--no-edit", "main")
        self.head = self.commit("owned.txt", "resolved PR change")
        self.config()
        self.ok(self.start())
        start = self.entries()[-1]
        self.assertEqual(start["intersections"], ["owned.txt"])
        self.assertIn(f"git show --remerge-diff for {self.head}", Path(start["brief"]).read_text())

    def test_section_seven_has_no_grant(self):
        self.begin(task_class="owner")
        self.expect(self.assign(), "REVIEW_OWNER_TASK")
        self.ok(self.command("report"))
        self.assertIn(TARGET, (self.chief / "report.md").read_text().split("## Needs you")[1])

    def test_unchecked_plan_cannot_start(self):
        self.begin(planned=False)
        self.expect(self.start(), "REVIEW_PLAN_REQUIRED")
        self.ok(self.plan())
        self.ok(self.start())

    def test_checkout_and_report_verdict(self):
        self.begin()
        (self.checkout / "untracked.txt").touch()
        self.expect(self.start(), "REVIEW_CHECKOUT")
        (self.checkout / "untracked.txt").unlink()
        self.ok(self.start())
        for invalid in ("bad_role", "bad_count"):
            with self.subTest(invalid=invalid):
                paths = self.reports(**{invalid: True})
                self.expect(self.typed("review", chief="chief", target=TARGET, ledger=["ledger fixture"], reports=paths),
                            "REVIEW_REPORT")
        paths = self.reports()
        outside = self.root / "copied-report.md"
        outside.write_text(Path(paths[0]).read_text())
        self.expect(self.typed("review", chief="chief", target=TARGET, ledger=["ledger fixture"], reports=[str(outside), paths[1]]),
                    "REVIEW_REPORT")
        self.ok(self.typed("review", chief="chief", target=TARGET, ledger=["ledger fixture"], reports=paths))

    def test_only_chief_rules_on_findings(self):
        self.begin()
        self.complete(p3=["small item"])
        fields = dict(target=TARGET, finding="small item", source=self.entries()[-1]["reports"][0]["source"], severity="drop", reason="duplicate of an existing point")
        self.expect(self.typed("ruling", chief="leader", **fields), "MERGE_CHIEF_ONLY")
        self.ok(self.typed("ruling", chief="chief", **fields))
        self.assertEqual(self.entries()[-1]["finding"], "small item")

    def test_grant_reads_live_head_ci_and_scope(self):
        self.begin()
        clean_head = self.head
        self.head = self.commit("another.txt", "out of scope")
        self.config(files_override=[{"filename": name, "status": "modified"} for name in ("another.txt", "owned.txt")],
                    changed_files=2)
        self.expect(self.grant(self.complete()), "REVIEW_SCOPE")
        self.head = clean_head
        self.git("switch", "-q", "--detach", self.head)
        self.config()
        paths = self.complete()
        self.config(rules=[{"type": "required_status_checks", "parameters": {
            "required_status_checks": [{"context": "CI", "integration_id": 42}]}}],
            checks=[dict(name="CI", head_sha=self.main, app={"id": 42}, status="completed", conclusion="success")])
        self.expect(self.grant(paths), "MERGE_CI_NOT_GREEN")
        self.config()
        self.ok(self.grant(paths))

    def test_grant_waits_for_merge_and_green_main(self):
        self.begin()
        first = self.complete()
        second = self.complete(OTHER)
        self.ok(self.grant(first))
        entry = next(e["id"] for e in self.entries() if e["kind"] == "merge-permission")
        self.expect(self.grant(second), "MERGE_PENDING")
        self.expect(self.typed("confirm", chief="chief", grant=entry), "MERGE_NOT_CONFIRMED")
        self.config(pulls={"12": {"merged": True, "state": "closed", "head": {"sha": "2" * 40}, "merge_commit_sha": self.main}})
        self.expect(self.typed("confirm", chief="chief", grant=entry), "MERGE_NOT_CONFIRMED")
        self.config(pulls={"12": {"merged": True, "state": "closed", "merge_commit_sha": self.main}})
        self.ok(self.typed("confirm", chief="chief", grant=entry))
        self.config(red_main=True)
        self.expect(self.grant(second), "MERGE_CI_NOT_GREEN")
        self.config()
        self.ok(self.grant(second))

    def test_replacement_needs_release(self):
        self.begin()
        latest = next(e["id"] for e in self.entries() if e["kind"] == "assign" and e["target"] == TARGET)
        self.expect(self.assign(leader="replacement"), "REVIEW_REPLACEMENT")
        self.ok(self.assign(leader="replacement", replaces=latest, released="Old session stopped and access revoked"))
        self.expect(self.start(), "REVIEW_PLAN_REQUIRED")
        self.ok(self.plan())
        self.ok(self.start())
        self.assertEqual(self.entries()[-1]["leader"], "replacement")

    def test_grant_readback_after_failed_sync(self):
        self.begin()
        reports = self.complete()
        args = ["grant", "--dir", str(self.chief), "--data", self.input("grant.json", {"reports": reports})]
        with patch.dict(os.environ, {**self.env, "NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:10")}), patch(
                "os.fsync", side_effect=OSError(5, "grant sync")):
            self.assertEqual(night_module().main(args), 3)
        before = self.journal().read_bytes()
        self.expect(self.grant(reports), "MERGE_PERMISSION_DUPLICATE")
        self.assertEqual(self.journal().read_bytes(), before)
        self.assertEqual([e["kind"] for e in self.entries()].count("merge-permission"), 1)

    def test_review_cap_stops_at_eight_for_one_main_merge(self):
        self.begin()
        self.update_main(1)
        for number in range(1, 9):
            if number > 1:
                self.head = self.commit("owned.txt", f"Review head {number}")
                self.config()
            paths = self.complete(p1=["blocking issue"])
            self.assertEqual(self.entries()[-1]["kind"], "cap" if number == 8 else "review")
        self.expect(self.start(), "REVIEW_CAP_REACHED")
        self.expect(self.grant(paths), "REVIEW_CAP_REACHED")
        status = json.loads(self.ok(self.command("status", "--json")))
        self.assertEqual(status["review_rounds"][TARGET], 8)
        self.ok(self.start(OTHER))
        self.ok(self.command("report"))
        report = (self.chief / "report.md").read_text().split("## Needs you", 1)[1].split("## Merge attempts", 1)[0]
        self.assertIn("P1 blocking issue", report)

    def test_secondary_reads_recheck_reports_and_cap_state(self):
        self.begin(cap=1)
        reports = self.complete(p1=["blocking issue"])
        self.expect(self.grant(reports), "REVIEW_CAP_REACHED")
        entry = self.entries()[-1]
        self.ok(self.typed("review", chief="chief", target=TARGET, reports=reports, ledger=["ledger fixture"]))
        self.assertEqual(self.entries()[-1], entry)
        for path in reports:
            self.ok(self.typed("ruling", chief="chief", target=TARGET, source=path,
                               finding="blocking issue", severity="drop", reason="Duplicate of verified work"))
        Path(reports[0]).write_text(Path(reports[0]).read_text().replace("Review details", "modified afterwards"))
        self.expect(self.grant(reports), "REVIEW_REPORT")

    def test_replacement_rejects_outdated_leader(self):
        self.begin()
        latest = [e for e in self.entries() if e["kind"] == "assign" and e["target"] == TARGET][-1]
        self.ok(self.assign(leader="replacement", replaces=latest["id"], released="Old leader access revoked"))
        self.ok(self.plan())
        self.ok(self.grant(self.complete()))
        outcome = self.command("merge", "--run", self.run_id, "--head", self.head, "--target", TARGET,
                               "--leader", "leader", "--grant", str(self.entries()[-1]["id"]))
        self.expect(outcome, "MERGE_LEADER_ONLY")

    def test_refuses_duplicate_grant_after_withdrawal(self):
        self.begin()
        reports = self.complete()
        self.ok(self.grant(reports))
        self.ok(self.typed("withdraw", chief="chief", grant=self.entries()[-1]["id"], reason="leader stopped"))
        self.expect(self.grant(reports), "MERGE_PERMISSION_DUPLICATE")

    def test_clean_round_cannot_reuse_reports_for_a_new_head(self):
        self.begin()
        original = self.complete()
        self.head = self.commit("owned.txt", "new head")
        self.config()
        self.ok(self.start())
        self.expect(self.typed("review", chief="chief", target=TARGET, reports=original, ledger=["ledger fixture"]),
                    "REVIEW_REPORT")
        self.ok(self.typed("review", chief="chief", target=TARGET, reports=self.reports(), ledger=["ledger fixture"]))

    def test_grant_refuses_legacy_fields(self):
        self.begin()
        self.expect(self.typed("grant", head=self.head, target=TARGET, ci=["fake green"]), "MERGE_EVIDENCE_INVALID")

    def test_assignment_refuses_unapproved_role(self):
        self.begin()
        before = self.journal().read_bytes()
        self.expect(self.assign(reviewers=LOWER), "REVIEWER_NOT_ASSIGNED")
        self.assertEqual(self.journal().read_bytes(), before)

    def test_started_round_requires_current_assignments(self):
        self.begin()
        self.ok(self.start())
        paths = self.reports()
        self.ok(self.assign())
        self.expect(self.typed("review", chief="chief", target=TARGET, reports=paths, ledger=["ledger fixture"]),
                    "REVIEW_PLAN_REQUIRED")
        self.ok(self.plan())
        self.expect(self.typed("review", chief="chief", target=TARGET, reports=paths, ledger=["ledger fixture"]),
                    "REVIEW_START_REQUIRED")

if __name__ == "__main__":
    unittest.main()
