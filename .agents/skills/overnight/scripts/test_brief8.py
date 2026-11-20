"""Exercise the chief review flow with a local checkout and a fake GitHub CLI."""
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
from test_option_b import OTHER, PAIR, POLICY, ROWS, TARGET
import test_option_b as fixtures
from test_option_b_merge import FAKE_GH
from night_testlib import card, new


class Brief8Tests(unittest.TestCase):
    for name in ("setUp", "expect", "ok", "journal", "entries", "input"):
        locals()[name] = getattr(fixtures.OptionBTests, name)

    def command(self, *args, time="22:10", env=None):
        return fixtures.OptionBTests.command(self, *args, time=time, env=env or self.env)

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.checkout), *args], text=True).strip()

    def commit(self, name, content):
        (self.checkout / name).write_text(content)
        self.git("add", name)
        self.git("commit", "-qm", content)
        return self.git("rev-parse", "HEAD")

    def begin(self, cap=5, task_class="night", consult=False, planned=True):
        self.ok(new(str(self.chief), "synthetic workflow"))
        self.reviews = self.chief / "reviews"
        self.reviews.mkdir()
        self.checkout = self.reviews / "checkout"
        self.checkout.mkdir()
        self.git("init", "-qb", "main")
        self.git("config", "user.name", "Fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.main = self.commit("base.txt", "base")
        self.git("switch", "-qc", "pr")
        self.head = self.commit("owned.txt", "change")
        self.git("switch", "-q", "--detach", self.head)
        self.worktree.mkdir()
        self.other = self.root / "second-leader"
        self.other.mkdir()
        tool = self.root / "gh"
        tool.write_text(f"#!{sys.executable}\n" + FAKE_GH)
        tool.chmod(0o755)
        self.env = {"PATH": f"{self.root}:{os.environ['PATH']}", "FAKE_GITHUB": str(self.root)}
        self.config()
        rows = [*ROWS[:3], (*ROWS[3][:5], "second")]
        card(str(self.chief), rows)
        tasks = {target: {"class": kind, "criteria": ["Change the owned file"], "owned": ["owned.txt"]}
                 for target, kind in ((TARGET, task_class), (OTHER, "night"))}
        options = ["--consultants"] if consult else []
        self.ok(self.command("go", "--stop", "23:00Z", "--goal", "set", "--rehearsal", "passed",
                             "--chief", "chief", "--review-policy", self.input("policy.json", POLICY),
                             "--tasks", self.input("tasks.json", tasks), "--review-cap", str(cap),
                             "--merge-main-bonus", "3", "--allow-empty-checks", *options))
        if task_class == "night":
            self.ok(self.assign())
            if planned:
                self.ok(self.plan())
        self.ok(self.assign(OTHER))
        self.ok(self.plan(OTHER))

    def config(self, **updates):
        self.input("config", dict(head=self.head, base_sha=self.main, files=[{"filename": "owned.txt", "status": "modified"}],
                                  changed_files=1, **updates))

    def typed(self, command, **data):
        return self.command(command, "--data", self.input("data.json", data))

    def assign(self, target=TARGET, **changes):
        fields = dict(chief="chief", target=target, leader="leader" if target == TARGET else "second",
                      reviewers=PAIR, helpers=[], worktree=str(self.worktree if target == TARGET else self.other))
        return self.typed("assign", **(fields | changes))

    def plan(self, target=TARGET):
        return self.typed("plan", chief="chief", target=target, plan="plan.md", strategy="test-strategy.md")

    def start(self, target=TARGET, **changes):
        fields = dict(chief="chief", target=target, head=self.head, checkout=str(self.checkout))
        return self.typed("review-start", **(fields | changes))

    def reports(self, p3=(), *, bad_count=False):
        paths = []
        for who in PAIR:
            path = self.reviews / f"{len(self.entries())}-{who['provider']}.md"
            findings = {"p1": [], "p2": [], "p3": list(p3)}
            verdict = dict(head=self.head, model=who["model"], effort=who["effort"], p1=0,
                           p2=0, p3=len(p3) + int(bad_count))
            path.write_text("Review details\n\nFindings: " + json.dumps(findings) +
                            "\nVerdict: " + json.dumps(verdict) + "\n")
            paths.append(str(path))
        return paths

    def complete(self, target=TARGET, p3=()):
        self.ok(self.start(target))
        paths = self.reports(p3)
        self.ok(self.typed("review", chief="chief", target=target, reports=paths))
        return paths

    def grant(self, reports):
        return self.typed("grant", reports=reports)

    def update_main(self, number):
        self.git("switch", "-q", "main")
        self.main = self.commit(f"main-{number}.txt", f"advance {number}")
        self.git("switch", "-q", "--detach", self.head)
        self.git("merge", "--no-ff", "--no-edit", "main")
        self.head = self.git("rev-parse", "HEAD")
        self.config()

    def test_chief_starts_review(self):
        self.begin()
        self.expect(self.start(chief="leader"), "MERGE_CHIEF_ONLY")
        self.ok(self.start())
        brief = self.entries()[-1]["brief"]
        self.assertTrue(Path(brief).is_relative_to(self.reviews))
        self.assertIn(self.head, Path(brief).read_text())

    def test_merge_bonus_is_frozen_per_pr(self):
        self.begin()
        self.update_main(1)
        self.ok(self.start())
        first = self.entries()[-1]
        self.assertEqual(first["cap"], 8)
        self.ok(self.typed("review", chief="chief", target=TARGET, reports=self.reports()))
        self.update_main(2)
        self.ok(self.start())
        self.assertEqual(self.entries()[-1]["cap"], 11)
        self.expect(self.start(head="1" * 40), "MERGE_HEAD_CHANGED")
        self.assertEqual(self.entries()[1]["merge_main_bonus"], 3)

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
        self.assertIn("small item", (self.chief / "report.md").read_text())

    def test_new_head_needs_full_round(self):
        self.begin()
        paths = self.complete()
        self.update_main(1)
        self.expect(self.grant(paths), "MERGE_HEAD_CHANGED")
        self.ok(self.start())
        review = self.entries()[-1]
        self.assertEqual(review["merge_base"], self.main)
        self.assertEqual(review["files"], ["owned.txt"])
        self.assertEqual(review["main_merges"], [self.head])

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
        paths = self.reports(bad_count=True)
        self.expect(self.typed("review", chief="chief", target=TARGET, reports=paths), "REVIEW_REPORT")
        paths = self.reports()
        outside = self.root / "copied-report.md"
        outside.write_text(Path(paths[0]).read_text())
        self.expect(self.typed("review", chief="chief", target=TARGET, reports=[str(outside), paths[1]]),
                    "REVIEW_REPORT")
        self.ok(self.typed("review", chief="chief", target=TARGET, reports=paths))

    def test_only_chief_rules_on_findings(self):
        self.begin()
        self.complete(p3=["small item"])
        fields = dict(target=TARGET, finding="small item", severity="drop", reason="duplicate of an existing point")
        self.expect(self.typed("ruling", chief="leader", **fields), "MERGE_CHIEF_ONLY")
        self.ok(self.typed("ruling", chief="chief", **fields))
        self.assertEqual(self.entries()[-1]["finding"], "small item")

    def test_grant_reads_live_head_ci_and_scope(self):
        self.begin()
        paths = self.complete()
        self.config(files_override=[{"filename": "another.txt", "status": "modified"}])
        self.expect(self.grant(paths), "REVIEW_SCOPE")
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
        self.config(pulls={"12": {"merged": True, "head": {"sha": "2" * 40}, "merge_commit_sha": self.main}})
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
        self.ok(self.start())
        self.assertEqual(self.entries()[-1]["leader"], "replacement")

    def test_merge_bar_links_night_rule(self):
        root = next(parent for parent in Path(__file__).resolve().parents if (parent / "docs/workflows").is_dir())
        text = (root / "docs/workflows/merge-bar.md").read_text()
        self.assertIn("overnight/SKILL.md#night-review-and-merge", text)


if __name__ == "__main__":
    unittest.main()
