"""Tests of night_hook.py: while a night is open, a guarded command runs only if it is an open intent
(owner, 2026-11-19, designs-139-140 Q4 A).

Run all test files with `python3 -I run_tests.py`.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `-I` drops this folder
from night_testlib import (  # noqa: E402
    NIGHT, Base, at, card, go_args, intent, merge, new, run, started)

HOOK = os.path.join(os.path.dirname(NIGHT), "night_hook.py")


def hook(nights, command, tool="Bash", raw=None, script=HOOK):
    data = raw if raw is not None else json.dumps({"tool_name": tool, "tool_input": {"command": command}})
    done = subprocess.run([sys.executable, "-I", script, "--nights", nights], input=data, capture_output=True,
                          text=True, check=False, timeout=60)
    return done.returncode, done.stderr


class HookTests(Base):
    def allowed(self, command, nights=None):
        code, err = hook(nights or self.tmp.name, command)
        self.assertEqual((code, err), (0, ""), command)

    def blocked(self, command, says="", nights=None):
        code, err = hook(nights or self.tmp.name, command)
        self.assertEqual(code, 2, f"{command}\n{err}")
        self.assertIn("night hook: ", err)
        self.assertIn(says, err)
        return err

    def test_with_no_open_night_each_command_runs(self):
        self.allowed(merge("PR 1"))
        self.ok(new(self.dir))  # a night before its go is not open
        self.allowed(merge("PR 1"))
        card(self.dir)
        self.ok(run(self.dir, *go_args(), at=at("22:01")))
        self.ok(run(self.dir, "report", at=at("22:10")))
        self.ok(run(self.dir, "close", "--reason", "nothing-left", "--without-page", "x", at=at("22:11")))
        self.allowed("gh pr merge 999 -R example/none --squash")

    def test_an_open_night_blocks_a_merge_that_is_not_an_open_intent(self):
        started(self.dir)
        self.blocked("gh pr merge 999 -R example/none --squash", "has no open intent")
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        err = self.blocked("gh pr merge 999 -R example/none --squash", "must equal an open intent")
        self.assertIn(merge("PR 1"), err)
        self.allowed(merge("PR 1"))
        self.allowed(merge("PR 1").replace("merge 1", "merge '1'"))  # the same words

    def test_a_guarded_command_with_shell_syntax_or_inside_another_command_is_blocked(self):
        started(self.dir)
        self.ok(intent(self.dir, "PR 1", at("22:10")))
        for command in (merge("PR 1") + "; echo x", merge("PR 1") + " && git push", merge("PR 1") + " # x",
                        f"GH_REPO=org/app {merge('PR 1')}", merge("PR 1").replace("--squash", "--squa\\sh")):
            with self.subTest(command=command):
                self.blocked(command, "has shell syntax")
        for command in (f'bash -c "{merge("PR 1")}"',
                        merge("PR 1").replace("-R org/app --squash", "--squash -R org/app")):
            with self.subTest(command=command):
                self.blocked(command, "must equal an open intent")

    def test_each_guarded_word_set_is_guarded_and_other_commands_run(self):
        started(self.dir)
        for command in ("git push origin HEAD:main", "git -C repo push", "git tag v1", "gh release create v1",
                        "gh api repos/org/app/pulls/1/merge -X PUT", "gh api repos/org/app/issues -f title=x",
                        "gh api --method=POST repos/org/app/merges", "gh issue comment 8 -R org/app --body-file x"):
            with self.subTest(command=command):
                self.blocked(command)
        for command in ("git status", "gh pr view 1 -R org/app", "gh api repos/org/app/pulls/1", "ls -la"):
            with self.subTest(command=command):
                self.allowed(command)

    def test_a_journal_that_cannot_be_read_blocks_only_guarded_commands(self):
        started(self.dir)
        with open(os.path.join(self.dir, "journal.jsonl"), "a", encoding="utf-8") as handle:
            handle.write('{"id": 3')
        self.hand_edit = True
        self.blocked(merge("PR 1"), "cannot be read (TORN_LINE)")
        self.allowed("git status")

    def test_a_missing_nights_folder_blocks_guarded_commands(self):
        missing = os.path.join(self.tmp.name, "no-such-folder")
        self.blocked(merge("PR 1"), "does not exist", nights=missing)
        self.allowed("git status", nights=missing)

    def test_the_folder_of_one_night_works_as_the_nights_folder(self):
        started(self.dir)
        self.blocked("git push", nights=self.dir)

    def test_another_tool_runs_and_a_bad_hook_input_is_blocked(self):
        started(self.dir)
        self.assertEqual(hook(self.tmp.name, "git push", tool="Edit"), (0, ""))
        code, err = hook(self.tmp.name, "", raw="not json")
        self.assertEqual(code, 2)
        self.assertIn("not the input of a Bash tool call", err)

    def test_a_copy_of_the_hook_without_its_modules_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copy(HOOK, tmp)
            code, err = hook(self.tmp.name, "git status", script=os.path.join(tmp, "night_hook.py"))
            self.assertEqual(code, 2, err)
            self.assertIn("copy the whole scripts folder", err)
            self.assertEqual(sorted(os.listdir(tmp)), ["night_hook.py"])


if __name__ == "__main__":
    unittest.main()
