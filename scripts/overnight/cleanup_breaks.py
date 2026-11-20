"""Named breaks for the approved merged-PR cleanup."""

from plan_r3_breaks import at

TEST = "test_cleanup.CleanupTests."
CLEAN = "night_cleanup.py"


def proof(name, module, before, after, method, anchor, subtest=""):
    test_id = TEST + method
    return name, module, before, after, test_id, at(test_id, anchor, subtest)


BREAKS = [
    proof("cleanup-ignore-dirty", CLEAN, 'if root is None:\n            raise Refused("CLEAN_WORKTREE_DIRTY", name)',
          "if root is None:\n            continue", "test_uncommitted_file_stops_first_removal", "self.assert_kept()"),
    ("cleanup-skip-remote-sha", CLEAN, 'if not isinstance(commit, dict) or commit.get("sha") != sha:',
     "if not isinstance(commit, dict):", TEST + "test_moved_remote_head_stops_remote_delete",
     "same moved SHA is caught by the separate exact ref read"),
    proof("cleanup-allow-open", CLEAN, 'or pr.get("state") != "closed" or pr.get("merged") is not True:',
          ':', "test_open_pr_keeps_every_item", 'self.expect(self.clean(), "CLEAN_PR_NOT_MERGED")'),
    proof("cleanup-glob-temp", CLEAN, '        os.unlink(slot, dir_fd=stage)\n        os.fsync(stage)\n        self.complete(entry)',
          '        os.unlink(slot, dir_fd=stage)\n'
          '        for candidate in os.listdir(fd):\n'
          '            if candidate.endswith(".log"):\n'
          '                os.unlink(candidate, dir_fd=fd)\n'
          '        os.fsync(stage)\n        self.complete(entry)',
          "test_unrecorded_temp_file_stays", 'self.assertTrue(unrecorded.is_file(), "unrecorded temp file deleted")'),
    proof("cleanup-allow-default", CLEAN, 'if branch == default or branch in ("main", "master"):',
          'if branch in ("main", "master"):', "test_default_branch_keeps_every_item",
          'self.expect(self.clean(), "CLEAN_DEFAULT_BRANCH")'),
    proof("cleanup-omit-deletions", "night_report.py",
          'table(deleted, ["Item", "Path or ref", "Bytes", "SHA", "Source", "Outcome"])',
          'table([], ["Item", "Path or ref", "Bytes", "SHA", "Source", "Outcome"])',
          "test_morning_report_lists_deletions_and_refusals", "self.assertIn(self.head, deletions)"),
]
