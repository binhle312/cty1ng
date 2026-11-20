"""Exercise the normal CLI with a synthetic GitHub subprocess."""
import json
import os
import sys
import threading
from unittest.mock import patch
import unittest

sys.dont_write_bytecode = True
from night_review_testlib import ReviewFixture, TARGET, OTHER, MERGE_SHA
from night_testlib import SHA2, at, night_module


class MergeTests(ReviewFixture, unittest.TestCase):
    def setup_grant(self, **config):
        self.begin()
        self.paths = self.complete()
        self.ok(self.grant(self.paths))
        self.grant_id = str(self.entries()[-1]["id"])
        self.config(**config)
        self.prior_reads = len(self.calls("GET"))

    def merge(self, time="22:10", **updates):
        options = dict(run=self.run_id, target=TARGET, leader="leader", grant=self.grant_id, head=self.head)
        options.update(updates)
        return self.command("merge", *(word for key, value in options.items() for word in ("--" + key, value)),
                            time=time, env=self.env)

    def calls(self, method):
        path = self.root / "calls"
        if not path.exists():
            return []
        return [call for line in path.read_text().splitlines() if (call := json.loads(line))[0][4] == method]

    def events_for_pr(self):
        path, = self.worktree.glob(".overnight/*/*/leader-events.jsonl")
        return [json.loads(line) for line in path.read_text().splitlines()]

    def test_merge_argv_and_one_attempt(self):
        self.setup_grant()
        before = self.journal().read_bytes()
        results = []
        threads = [threading.Thread(target=lambda: results.append(self.merge())) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(25)
            self.assertFalse(thread.is_alive())
        self.assertEqual(sorted(result[0] for result in results), [0, 3])
        self.expect(next(result for result in results if result[0] == 3), "MERGE_PERMISSION_USED")
        self.assertEqual(self.calls("PUT"), [[["api", "--hostname", "github.com", "--method", "PUT",
                          "repos/example/app/pulls/12/merge", "--input", "-", "--include"],
                          {"sha": self.head, "merge_method": "squash"}]])
        self.assertEqual(self.journal().read_bytes(), before)
        attempt, result = self.events_for_pr()
        self.assertEqual((attempt["kind"], attempt["head"], result["of"], result["outcome"], result["sha"]),
                         ("merge-attempt", self.head, attempt["id"], "merged", MERGE_SHA))

    def test_head_moves_after_check(self):
        self.setup_grant(write_head=SHA2)
        self.expect(self.merge(), "MERGE_HEAD_CHANGED")
        self.assertEqual(self.calls("PUT")[0][1]["sha"], self.head)
        self.assertEqual(self.events_for_pr()[-1]["outcome"], "failed")
        self.expect(self.merge(), "MERGE_PERMISSION_USED")

    def test_head_moves_before_check_and_does_not_reactivate(self):
        self.setup_grant(head=SHA2)
        before = self.journal().read_bytes()
        self.expect(self.merge(), "MERGE_HEAD_CHANGED")
        self.assertFalse(self.calls("PUT"))
        self.config()
        self.expect(self.merge(), "MERGE_PERMISSION_INACTIVE")
        self.assertEqual(self.journal().read_bytes(), before)

    def test_merge_scope_and_phase(self):
        self.setup_grant()
        for fields, code in ((dict(run=self.head), "MERGE_PERMISSION_NIGHT"), (dict(target=OTHER, leader="second"), "MERGE_PERMISSION_PR"),
                             (dict(grant="99"), "MERGE_PERMISSION_MISSING"), (dict(head=SHA2), "MERGE_PERMISSION_HEAD"),
                             (dict(leader="peer"), "MERGE_LEADER_ONLY"), (dict(head="1"), "HEAD_FORM"),
                             (dict(target="github.com/example/app#97"), "MERGE_PR_NOT_ON_CARD"),
                             (dict(target="github.com/example/app#12?"), "MERGE_TARGET_FORM")):
            with self.subTest(fields=fields):
                self.expect(self.merge(**fields), code)
        self.expect(self.merge(time="23:00"), "AFTER_STOP")
        self.assertFalse(self.calls("PUT"))

    def test_unknown_outcome_never_reissues(self):
        self.setup_grant(bad_reply=True)
        self.expect(self.merge(), "MERGE_OUTCOME_UNKNOWN")
        self.expect(self.merge(), "MERGE_PERMISSION_USED")
        self.expect(self.grant(self.paths), "MERGE_PENDING")
        self.assertEqual(len(self.calls("PUT")), 1)
        self.assertEqual(self.events_for_pr()[-1]["outcome"], "unknown")

    def test_required_check_matches_head_and_source(self):
        self.setup_grant()
        rules = [{"type": "required_status_checks", "parameters": {"required_status_checks":
                  [{"context": "CI", "integration_id": 42}]}}]
        exact = dict(name="CI", head_sha=self.head, app={"id": 42}, status="completed", conclusion="success")
        for checks in ([], [dict(exact, head_sha=SHA2)], [dict(exact, app={"id": 99})],
                       [dict(exact, status="in_progress")], [exact, dict(exact, conclusion="failure")]):
            with self.subTest(checks=checks):
                self.config(rules=rules, checks=checks)
                self.expect(self.merge(), "MERGE_CI_NOT_GREEN")
        self.config(rules=rules, checks=[exact])
        self.ok(self.merge())

    def test_unknown_policy_and_write_effects_hold(self):
        self.setup_grant()
        for config, code in ((dict(unknown_policy=True), "MERGE_CI_UNKNOWN"),
                             (dict(draft=True), "MERGE_PR_INELIGIBLE"),
                             (dict(auto_delete=True), "MERGE_EFFECT_UNCLEAR"),
                             (dict(workflows=[{"state": "active"}]), "MERGE_EFFECT_UNCLEAR")):
            with self.subTest(config=config):
                self.config(**config)
                self.expect(self.merge(), code)
        self.assertFalse(self.calls("PUT"))

    def test_audit_includes_unlisted_owner_and_uses_half_open_window(self):
        self.setup_grant()
        pages = [dict(total_count=3, incomplete_results=False, items=[
                 dict(number=i, repository_url="https://api.github.com/repos/example/app") for i in batch])
                 for batch in ([101], [102, 103])]
        pulls = {str(i): dict(merged=True, merged_at=at(time), merge_commit_sha=MERGE_SHA,
                              merged_by={"login": "owner"}) for i, time in ((101, "22:01"), (102, "23:00"), (103, "22:00"))}
        self.input("config", dict(audit=pages, pulls=pulls))
        result = json.loads(self.ok(self.command("audit", time="23:12", env=self.env)))
        self.assertEqual(len(result), 1, result)
        self.assertEqual(result[0][:3], ["github.com/example/app#101", "unmatched", at("22:01")])
        self.assertIn("actor owner", result[0][3])
        self.assertIn("merged%3A", str(self.calls("GET")))

    def test_audit_reports_a_missing_page(self):
        self.setup_grant()
        self.input("config", dict(audit=[dict(total_count=1, incomplete_results=False, items=[])]))
        rows = json.loads(self.ok(self.command("audit", time="23:15", env=self.env)))
        self.assertEqual(rows[0][:3], ["github.com/example/app", "coverage gap", f"{at('22:01')} to {at('23:00')}"])

    def test_merge_refuses_unreadable_pr_and_definite_rejection(self):
        self.setup_grant(bad_read=True)
        self.expect(self.merge(), "MERGE_READ_FAILED")
        self.assertFalse(self.calls("PUT"))
        self.config(reject=True)
        self.expect(self.merge(), "MERGE_REJECTED")
        self.assertEqual(self.events_for_pr()[-1]["outcome"], "failed")

    def test_grant_path_refuses_a_symlink(self):
        self.setup_grant()
        canonical = self.chief
        self.chief = self.root / "substitute"
        self.chief.symlink_to(canonical, target_is_directory=True)
        self.expect(self.merge(), "MERGE_JOURNAL_PATH")
        self.assertEqual(len(self.calls("GET")), self.prior_reads)

    def test_failed_claim_sync_makes_no_request(self):
        self.setup_grant()
        module = night_module()
        with patch.dict(os.environ, {**self.env, "NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:10")}), patch(
                "os.fsync", side_effect=OSError(5, "sync failed after write")):
            status = module.main(["merge", "--dir", str(self.chief), "--run", self.run_id, "--target", TARGET,
                                  "--leader", "leader", "--grant", self.grant_id, "--head", self.head])
        self.assertEqual(status, 3)
        self.assertEqual([e["kind"] for e in self.events_for_pr()], ["merge-attempt"])
        self.assertFalse(self.calls("PUT"), "a failed claim sync allowed a merge request")
        self.expect(self.merge(), "MERGE_PERMISSION_USED")

    def test_failed_result_append_leaves_one_consumed_attempt(self):
        self.setup_grant()
        module = night_module()
        files = sys.modules["night_files"]
        real_append = files.append

        def after_result(path, entry, **fields):
            if entry["kind"] == "merge-result":
                with patch("os.fsync", side_effect=OSError(5, "result sync")):
                    return real_append(path, entry, **fields)
            return real_append(path, entry, **fields)

        with patch.dict(os.environ, {**self.env, "NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:10")}), patch.object(
                files, "append", after_result):
            status = module.main(["merge", "--dir", str(self.chief), "--run", self.run_id, "--target", TARGET,
                                  "--leader", "leader", "--grant", self.grant_id, "--head", self.head])
        self.assertEqual(status, 3)
        self.expect(self.merge(), "MERGE_PERMISSION_USED")
        self.assertEqual(len(self.calls("PUT")), 1)
        self.assertEqual([e["kind"] for e in self.events_for_pr()], ["merge-attempt", "merge-result"])

    def test_new_head_invalidates_prior_grant(self):
        self.setup_grant()
        next_head = self.commit("owned.txt", "changed after grant")
        self.config(head=next_head)
        self.expect(self.merge(), "MERGE_HEAD_CHANGED")
        self.assertFalse(self.calls("PUT"))


if __name__ == "__main__":
    unittest.main()
