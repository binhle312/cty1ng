"""Tests of night.py: a card row holds the exact command, with typed slots (owner, 2026-11-19, designs-139-140 Q3 A).

Run all test files with `python3 -I run_tests.py`.
"""

import os
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `-I` drops this folder
from night_testlib import (  # noqa: E402
    ITEMS, SHA, SHA2, Base, at, card, go_args, intent, intent_args, merge, new, run, started, words_file)

ROW_1 = "gh pr merge 1 -R org/app --squash --match-head-commit {head}"
RERUN = ("CI 12", "no-commit", "gh run rerun {run} --failed -R org/app")


class CommandRowTests(Base):
    def go_refused(self, row, code):
        """A card with one bad row, in a folder of its own: `go` refuses it with `code` and names the row."""
        folder = os.path.join(self.tmp.name, f"row-{len(os.listdir(self.tmp.name))}")
        self.ok(new(folder))
        card(folder, raw=row)
        out = self.refused(*go_args(), at=at("22:01"), code=code, folder=folder)
        self.assertIn(row.split(" | ")[0], out)
        return out

    # P1-1 of the Codex review of b315b63 (DQ-932): the gate bound only the label.
    def test_a_merge_of_another_pr_under_a_permitted_name_is_refused(self):
        started(self.dir)
        other = f"gh pr merge 999 -R org/app --squash --match-head-commit {SHA}"
        out = self.refused(*intent_args("PR 1", SHA, other), at=at("22:10"), code="COMMAND_NOT_ROW")
        self.assertIn("999", out)

    def test_a_push_to_main_under_a_no_commit_name_is_refused(self):
        started(self.dir)
        self.refused("log", "intent", "--item", "notice", "--command", "git push origin HEAD:main", "--no-head", "x",
                     at=at("22:10"), code="COMMAND_NOT_ROW")

    def test_the_same_command_in_another_repository_is_refused(self):
        started(self.dir)
        self.refused(*intent_args("PR 1", SHA, merge("PR 1").replace("org/app", "org/other")), at=at("22:10"),
                     code="COMMAND_NOT_ROW")

    # P1-2 of the Codex review (DQ-933): a shell comment hid the head option.
    def test_a_shell_comment_in_the_command_is_refused(self):
        started(self.dir)
        hidden = f"gh pr merge 1 -R org/app --squash # --match-head-commit {SHA}"
        self.refused(*intent_args("PR 1", SHA, hidden), at=at("22:10"), code="COMMAND_SHELL")

    # F7 of advisor point 3 (DQ-970): a second head option.
    def test_a_second_head_option_is_refused(self):
        started(self.dir)
        twice = merge("PR 1") + f" --match-head-commit {SHA2}"
        self.refused(*intent_args("PR 1", SHA, twice), at=at("22:10"), code="COMMAND_NOT_ROW")

    def test_the_head_slot_takes_the_head_of_the_intent(self):
        started(self.dir)
        self.refused(*intent_args("PR 1", SHA, merge("PR 1", SHA2)), at=at("22:10"), code="COMMAND_NOT_ROW")
        self.ok(intent(self.dir, "PR 1", at("22:11")))
        self.assertEqual(self.events()[-1]["command"], ROW_1.replace("{head}", SHA))

    def test_a_slot_word_in_the_command_itself_is_refused(self):
        started(self.dir)
        self.refused(*intent_args("PR 1", SHA, merge("PR 1", "{head}")), at=at("22:10"), code="COMMAND_SHELL")

    def test_quotes_that_give_the_same_words_are_the_same_command(self):
        started(self.dir)
        quoted = f"gh pr merge '1' -R \"org/app\" --squash --match-head-commit {SHA}"
        self.ok(intent(self.dir, "PR 1", at("22:10"), command=quoted))

    def test_each_shell_character_in_a_command_is_refused(self):
        started(self.dir)
        base = merge("PR 1")
        cases = [";", "&", "|", "`", "$", "(", ")", "<", ">", "\\", "{", "}", "~", "*", "?", "[", "]", "!", "#"]
        for index, char in enumerate(cases):
            with self.subTest(char=char):
                bad = base.replace("--squash", f"--squash{char}x")
                self.refused(*intent_args("PR 1", SHA, bad), at=at(f"22:{10 + index}"), code="COMMAND_SHELL")
        for bad in (base + "\nrm -rf x", f"GH_REPO=org/other {base}", base.replace("--squash", "=gh")):
            with self.subTest(command=bad):
                self.refused(*intent_args("PR 1", SHA, bad), at=at("22:40"), code="COMMAND_SHELL")

    def test_a_brace_list_that_the_shell_would_expand_is_refused(self):
        started(self.dir)
        self.refused(*intent_args("PR 1", SHA, merge("PR 1").replace("merge 1", "merge {1,999}")), at=at("22:10"),
                     code="COMMAND_SHELL")

    def test_an_unclosed_quote_is_refused(self):
        started(self.dir)
        self.refused(*intent_args("PR 1", SHA, merge("PR 1") + " 'x"), at=at("22:10"), code="COMMAND_SHELL")

    # The rows of the card.
    def test_a_gh_row_needs_its_repository(self):
        self.go_refused("PR 1 | commit | gh pr merge 1 --squash --match-head-commit {head}", "ITEM_COMMAND")

    def test_a_gh_row_needs_a_repository_after_its_flag(self):
        self.go_refused("PR 1 | commit | gh pr merge 1 -R --squash --match-head-commit {head}", "ITEM_COMMAND")
        self.go_refused("PR 1 | commit | gh pr merge 1 --squash --match-head-commit {head} --repo", "ITEM_COMMAND")

    def test_a_commit_row_needs_one_head_slot(self):
        self.go_refused("PR 1 | commit | gh pr merge 1 -R org/app --squash", "ITEM_COMMAND")

    def test_a_commit_row_with_two_head_slots_is_refused(self):
        self.go_refused("PR 1 | commit | gh pr merge 1 -R org/app --match-head-commit {head} --x {head}", "ITEM_COMMAND")

    def test_a_commit_row_with_a_double_dash_is_refused(self):
        self.go_refused("PR 1 | commit | gh pr merge 1 -R org/app --match-head-commit {head} --", "ITEM_COMMAND")

    def test_a_no_commit_row_has_no_head_slot_and_no_sha(self):
        self.go_refused("notice | no-commit | gh pr merge 1 -R org/app --match-head-commit {head}", "ITEM_COMMAND")
        self.go_refused(f"notice | no-commit | git push origin {SHA}:main", "ITEM_COMMAND")
        self.go_refused(f"notice | no-commit | git push origin {SHA.upper()}:main", "ITEM_COMMAND")

    def test_a_no_commit_row_needs_a_command_and_an_owner_row_has_none(self):
        self.go_refused("notice | no-commit", "ITEM_COMMAND")
        self.go_refused("PR 4 | owner | gh pr merge 4 -R org/app", "ITEM_COMMAND")

    def test_an_unknown_slot_is_refused(self):
        self.go_refused("CI 12 | no-commit | gh run rerun {id} --failed -R org/app", "ITEM_COMMAND")

    def test_shell_syntax_and_an_environment_word_in_a_row_are_refused(self):
        for row in ("PR 1 | commit | gh pr merge 1 -R org/app --match-head-commit {head} # x",
                    "PR 1 | commit | GH_REPO=org/app gh pr merge 1 -R org/app --match-head-commit {head}",
                    "PR 1 | commit | gh pr merge {1,2} -R org/app --match-head-commit {head}",
                    "notice | no-commit | gh issue comment 7 -R org/app --body $HOME"):
            with self.subTest(row=row):
                        self.go_refused(row, "COMMAND_SHELL")

    def test_add_item_checks_the_command_of_its_row(self):
        started(self.dir)
        out = run(self.dir, "log", "amend", "--words-file", words_file(self.dir, "add PR 5"), "--add-item",
                  "PR 5 | commit | gh pr merge 5 --match-head-commit {head}", at=at("22:10"))
        self.is_refused(out, "ITEM_COMMAND", command="log")

    # The typed slot {run}: a CI rerun at night needs its row on the card.
    def test_a_run_slot_takes_one_run_id(self):
        started(self.dir, rows=list(ITEMS) + [RERUN])
        args = ["log", "intent", "--item", "CI 12", "--no-head", "a CI rerun"]
        self.ok(run(self.dir, *args, "--command", "gh run rerun 12345678 --failed -R org/app", at=at("22:10")))
        self.ok(run(self.dir, "log", "result", "--of", str(self.events()[-1]["id"]), "--outcome", "done", "rerun",
                    at=at("22:11")))
        for index, bad in enumerate(("gh run rerun abc --failed -R org/app", "gh run rerun 1 2 --failed -R org/app",
                                     "gh run rerun --failed -R org/app", "gh run rerun 123 --failed -R org/other",
                                     "gh run rerun " + "1" * 21 + " --failed -R org/app")):
            with self.subTest(command=bad):
                self.refused(*args, "--command", bad, at=at(f"22:{12 + index}"), code="COMMAND_NOT_ROW")

    def test_status_and_the_report_show_the_command_of_each_row(self):
        started(self.dir)
        items = __import__("json").loads(self.ok(run(self.dir, "status", "--json", at=at("22:10"))))["items"]
        self.assertIn({"name": "PR 1", "kind": "commit", "command": ROW_1, "from": "E2"}, items)
        self.assertIn({"name": "PR 4", "kind": "owner", "command": None, "from": "E2"}, items)


if __name__ == "__main__":
    unittest.main()
