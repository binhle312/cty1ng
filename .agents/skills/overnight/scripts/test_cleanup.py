"""Run the public cleanup CLI against disposable Git repos and fake GitHub."""
import hashlib
import json
import shutil
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True
from night_review_testlib import MERGE_SHA, ReviewFixture, TARGET


FAKE_CLEAN_GITHUB = r"""
phase = folder / "cleanup"
if method == "GET" and phase.exists():
    state = json.loads(phase.read_text())
    repo = {"full_name": "example/app"}
    if endpoint == "repos/example/app/pulls/12":
        if state.get("no_read"):
            sys.exit(1)
        is_open = state.get("open", False)
        output = {"number": 12, "state": "open" if is_open else "closed", "merged": not is_open,
                  "merge_commit_sha": "$MERGE", "base": {"repo": repo},
                  "head": {"repo": state.get("head_repo", repo), "ref": "pr", "sha": state.get("pr_head", config["head"])}}
    elif endpoint == "repos/example/app":
        output = dict(repo, default_branch=state.get("default", "main"))
    elif endpoint.startswith("repos/example/app/pulls?"):
        output = [state.get("open_pulls", [])]
    elif endpoint == "repos/example/app/branches/pr":
        output = {"name": "pr", "protected": state.get("protected", False),
                  "commit": {"sha": state.get("remote", config["head"])}}
    elif endpoint.startswith("repos/example/app/rules/branches/pr"):
        output = [[]]
    else:
        sys.exit(1)
    print(json.dumps(output))
    sys.exit()
""".replace("$MERGE", MERGE_SHA)


class CleanupTests(ReviewFixture, unittest.TestCase):
    def setup_cleanup(self, merge=True, **state):
        self.leader_folder = self.root / "leader-record"
        self.temp_folder = self.leader_folder / "temp"
        self.temp_folder.mkdir(parents=True)
        self.begin(second=False)
        self.remote = self.root / "remote.git"
        self.clean_git("init", "-q", "--bare", str(self.remote))
        self.clean_git("push", "-q", str(self.remote), "main", "pr")
        self.clean_git("switch", "-q", "main")
        self.clean_git("merge", "--squash", "pr")
        self.clean_git("commit", "-qm", "squash PR")
        self.clean_git("worktree", "add", "-q", str(self.worktree), "pr")
        ancestry = subprocess.run(["git", "-C", str(self.repo), "merge-base", "--is-ancestor",
                                   self.head, "main"], check=False)
        self.assertEqual(ancestry.returncode, 1)
        self.ok(self.grant(self.complete()))
        if merge:
            self.ok(self.command("merge", "--run", self.run_id, "--target", TARGET, "--leader", "leader",
                                 "--grant", str(self.entries()[-1]["id"]), "--head", self.head))

        fake_gh = self.root / "gh"
        fake_gh.write_text(fake_gh.read_text().replace('if method == "PUT":\n    remote_head', FAKE_CLEAN_GITHUB +
                                                             '\nif method == "PUT":\n    remote_head'))
        git = self.root / "git"
        git.write_text(
            f"#!{sys.executable}\nimport json, os, pathlib, subprocess, sys\n"
            f"args = sys.argv[1:]\nurl = 'https://github.com/example/app.git'\n"
            f"state = json.loads(pathlib.Path({str(self.root / 'cleanup')!r}).read_text())\n"
            f"git = {shutil.which('git')!r}\n"
            f"if state.get('git_fail') and 'worktree' in args: sys.exit(1)\n"
            f"if 'push' in args:\n"
            f"    assert url in args, args\n"
            f"    pathlib.Path({str(self.root / 'push.args')!r}).write_text(json.dumps(args))\n"
            f"    if state.get('lease_race'):\n"
            f"        subprocess.run([git, '-C', {str(self.remote)!r}, 'update-ref',\n"
            f"                        'refs/heads/pr', {self.main!r}], check=True)\n"
            f"    args[args.index(url)] = {str(self.remote)!r}\n"
            f"if state.get('remove_disconnect') and 'worktree' in args and 'remove' in args:\n"
            f"    subprocess.run([git, *args], check=True)\n"
            f"    sys.exit(1)\n"
            f"os.execv(git, ['git', *args])\n"
        )
        git.chmod(0o755)
        self.input("cleanup", state)
        self.artifact = self.temp_folder / "proof.log"
        self.artifact.write_text("proof")
        self.ok(self.record(self.artifact))

    def assign(self, target=TARGET, **changes):
        self.repo = self.root / "repository"
        self.git("clone", "-q", "-b", "main", str(self.checkout), str(self.repo))
        self.clean_git("config", "user.name", "Fixture")
        self.clean_git("config", "user.email", "fixture@example.invalid")
        self.clean_git("branch", "pr", self.head)
        return super().assign(target, cleanup={"folder": str(self.leader_folder),
                                               "repo": str(self.repo), "branch": "pr"}, **changes)

    def clean(self):
        return self.command("clean", "--run", self.run_id, "--target", TARGET, "--leader", "leader")

    def record(self, path, actor="leader"):
        return self.command("record-temp", "--run", self.run_id, "--target", TARGET, "--leader", "leader",
                            "--actor", actor, "--path", str(path))

    def clean_git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args], text=True).strip()

    def local_branch(self):
        return self.clean_git("branch", "--list", "pr")

    def remote_head(self):
        result = self.clean_git("ls-remote", "--refs", str(self.remote), "refs/heads/pr")
        return result.split()[0] if result else ""

    def report(self):
        self.ok(self.command("report"))
        return (self.chief / "report.md").read_text()

    def assert_kept(self):
        self.assertTrue(self.artifact.is_file())
        self.assertTrue(self.worktree.is_dir())
        self.assertTrue(self.local_branch())
        self.assertEqual(self.remote_head(), self.head)

    def test_squash_merge_cleans_in_order(self):
        self.setup_cleanup()
        log = self.worktree / "fixture.log"
        log.write_text("in checkout")
        self.ok(self.record(log))
        self.ok(self.clean())
        self.assertFalse(self.artifact.exists())
        self.assertFalse(self.worktree.exists())
        self.assertFalse(self.local_branch())
        self.assertFalse(self.remote_head())
        journal = self.leader_folder / "leader-events.jsonl"
        records = [json.loads(line) for line in journal.read_text().splitlines()]
        steps = [(entry["kind"], entry["item"]) for entry in records if entry["kind"] in
                 ("clean-intent", "clean-result")]
        self.assertEqual(steps, [(kind, item) for item in ("temp", "temp", "worktree", "local", "remote")
                                 for kind in ("clean-intent", "clean-result")])
        proof = next(row for row in records if row["kind"] == "clean-intent" and row["subject"] == str(self.artifact))
        self.assertEqual((proof["size"], proof["sha"]), (5, hashlib.sha256(b"proof").hexdigest()))
        before = journal.read_bytes()
        self.ok(self.clean())
        self.assertEqual(journal.read_bytes(), before)

    def test_uncommitted_file_stops_first_removal(self):
        self.setup_cleanup()
        (self.worktree / "owned.txt").write_text("uncommitted")
        outcome = self.clean()
        self.assert_kept()
        self.expect(outcome, "CLEAN_WORKTREE_DIRTY")
        self.assertIn("CLEAN_WORKTREE_DIRTY", self.report())

    def test_moved_remote_head_stops_remote_delete(self):
        self.setup_cleanup()
        self.clean_git("push", "-q", "--force", str(self.remote), "main:pr")
        moved = self.remote_head()
        self.assertNotEqual(moved, self.head)
        self.input("cleanup", {"remote": moved})
        outcome = self.clean()
        self.assertFalse((self.root / "push.args").exists(), "pushed after GitHub reported a moved head")
        self.expect(outcome, "CLEAN_REMOTE_HEAD")
        self.assertFalse(self.worktree.exists())
        self.assertFalse(self.local_branch())
        self.assertEqual(self.remote_head(), moved)
        self.assertIn("CLEAN_REMOTE_HEAD", self.report())

    def test_open_pr_keeps_every_item(self):
        self.setup_cleanup(open=True)
        self.expect(self.clean(), "CLEAN_PR_NOT_MERGED")
        self.assert_kept()

    def test_unrecorded_temp_file_stays(self):
        self.setup_cleanup()
        unrecorded = self.temp_folder / "other.log"
        unrecorded.write_text("not recorded")
        outside = self.chief / "other.log"
        outside.write_text("chief")
        self.expect(self.record(outside), "CLEAN_TEMP_SCOPE")
        self.ok(self.clean())
        self.assertTrue(unrecorded.is_file(), "unrecorded temp file deleted")
        self.assertEqual(unrecorded.read_text(), "not recorded")
        self.assertEqual(outside.read_text(), "chief")

    def test_default_branch_keeps_every_item(self):
        self.setup_cleanup(default="pr")
        self.expect(self.clean(), "CLEAN_DEFAULT_BRANCH")
        self.assert_kept()

    def test_morning_report_lists_deletions_and_refusals(self):
        self.setup_cleanup()
        (self.worktree / "scratch").touch()
        self.expect(self.clean(), "CLEAN_WORKTREE_DIRTY")
        (self.worktree / "scratch").unlink()
        self.ok(self.clean())
        report = self.report()
        self.assertIn("## Cleanup deletions", report)
        deletions = report.split("## Cleanup deletions\n", 1)[1].split("\n## ", 1)[0]
        for item, path in (("temp", str(self.artifact)), ("worktree", str(self.worktree)),
                           ("local", "refs/heads/pr"), ("remote", "https://github.com/example/app.git refs/heads/pr")):
            with self.subTest(item=item):
                self.assertIn(f"| {item} | {path} | ", deletions)
        needs = report.split("## Needs you\n", 1)[1].split("\n## ", 1)[0]
        self.assertIn("CLEAN_WORKTREE_DIRTY", needs)
        self.assertIn(self.head, deletions)
        self.ok(self.command("render"))
        self.assertEqual((self.chief / "report.md").read_text(), report)


    def test_dispatch_and_merge_evidence_refusals(self):
        self.setup_cleanup(merge=False)
        self.expect(self.clean(), "CLEAN_NO_MERGE")
        scope = {"folder": str(self.chief), "repo": str(self.repo), "branch": "pr"}
        self.expect(self.typed("assign", chief="chief", target=TARGET, leader="leader",
                               reviewers=[], helpers=[], worktree=str(self.worktree), cleanup=scope),
                    "CLEAN_ASSIGNMENT")
        self.assert_kept()

    def test_git_and_github_refuse_uncertain_inputs(self):
        self.setup_cleanup()
        for state, code in (({"no_read": True}, "CLEAN_GITHUB"),
                            ({"head_repo": {"full_name": "fork/app"}}, "CLEAN_PR_SCOPE"),
                            ({"pr_head": "a" * 40}, "CLEAN_PR_HEAD"),
                            ({"open_pulls": [{"number": 13}]}, "CLEAN_OPEN_HEAD"),
                            ({"git_fail": True}, "CLEAN_GIT")):
            with self.subTest(code=code):
                self.input("cleanup", state)
                self.expect(self.clean(), code)
                self.assert_kept()

    def test_temp_evidence_detects_wrong_creator_and_changed_file(self):
        self.setup_cleanup()
        extra = self.temp_folder / "extra"
        self.expect(self.record(extra, actor="unassigned"), "CLEAN_TEMP_ACTOR")
        self.expect(self.record(self.artifact), "CLEAN_TEMP_RECORD")
        self.expect(self.record(extra), "CLEAN_FILE")
        extra.symlink_to(self.artifact)
        self.expect(self.record(extra), "CLEAN_TEMP_SCOPE")
        self.artifact.write_text("changed")
        self.expect(self.clean(), "CLEAN_TEMP_IDENTITY")
        self.assert_kept()

    def test_repository_identity_and_worktree_are_checked(self):
        self.setup_cleanup()
        displaced = self.root / "original-repository"
        self.repo.rename(displaced)
        self.repo.mkdir()
        self.expect(self.clean(), "CLEAN_REPO")
        displaced.rename(self.repo / "nested")
        self.expect(self.clean(), "CLEAN_REPO")

    def test_cleanup_cannot_run_inside_its_worktree(self):
        from night_testlib import argv, at, env_for
        self.setup_cleanup()
        args = argv(str(self.chief), "clean", "--run", self.run_id, "--target", TARGET, "--leader", "leader")
        done = subprocess.run(args, cwd=self.worktree, env=env_for(at("22:10"), extra=self.env),
                              text=True, capture_output=True, check=False)
        self.expect((done.returncode, done.stderr), "CLEAN_CWD")
        self.assert_kept()

    def test_remote_protection_and_url_rewrite_keep_the_ref(self):
        self.setup_cleanup(protected=True)
        self.expect(self.clean(), "CLEAN_REMOTE_PROTECTED")
        self.input("cleanup", {})
        self.clean_git("config", "url.https://example.invalid/.pushInsteadOf", "https://github.com/")
        self.expect(self.clean(), "CLEAN_REMOTE_URL")
        self.assertEqual(self.remote_head(), self.head)
        self.assertFalse((self.root / "push.args").exists())

    def test_remote_lease_stops_head_move_after_the_read(self):
        self.setup_cleanup(lease_race=True)
        self.expect(self.clean(), "CLEAN_REMOTE_PUSH")
        self.assertEqual(self.remote_head(), self.main)
        self.assertIn(f"--force-with-lease=refs/heads/pr:{self.head}",
                      json.loads((self.root / "push.args").read_text()))
        self.assertIn("cleanup intent has no result", self.report())

    def test_interrupted_worktree_result_stays_open(self):
        self.setup_cleanup(remove_disconnect=True)
        self.expect(self.clean(), "CLEAN_WORKTREE")
        self.input("cleanup", {})
        self.assertFalse(self.worktree.exists())
        self.expect(self.clean(), "CLEAN_WORKTREE")
        self.assertTrue(self.local_branch())
        self.assertEqual(self.remote_head(), self.head)
        self.assertIn("cleanup intent has no result", self.report())
        self.assertNotIn(f"| worktree | {self.worktree} |", self.report())

    def test_local_ref_rechecks_after_a_partial_cleanup(self):
        self.setup_cleanup(protected=True)
        self.expect(self.clean(), "CLEAN_REMOTE_PROTECTED")
        self.clean_git("branch", "pr", self.main)
        other = self.root / "another-worktree"
        self.clean_git("worktree", "add", "-q", str(other), "pr")
        self.expect(self.clean(), "CLEAN_LOCAL_IN_USE")
        self.clean_git("worktree", "remove", str(other))
        self.expect(self.clean(), "CLEAN_LOCAL_HEAD")
        self.assertEqual(self.remote_head(), self.head)

    def test_pending_intent_must_match_before_retry(self):
        self.setup_cleanup()
        file = self.leader_folder / "leader-events.jsonl"
        rows = [json.loads(line) for line in file.read_text().splitlines()]
        # Simulate loss of the process after a different item intent reached durable storage.
        pending = dict(kind="clean-intent", id=len(rows) + 1, target=TARGET, t=rows[-1]["t"], run=self.run_id,
                       item="worktree", subject=str(self.worktree), size=12, sha=self.head)
        with file.open("a") as handle:
            print(json.dumps(pending), file=handle)
        self.expect(self.clean(), "CLEAN_INTERRUPTED")
        self.assert_kept()
