"""Named breaks for the approved merged-PR cleanup."""
TEST = "test_cleanup.CleanupTests."
CLEAN = "night_cleanup.py"

BREAKS = [
    ("cleanup-ignore-dirty", CLEAN, 'raise Refused("CLEAN_WORKTREE_DIRTY", os.fsdecode(row[3:]))',
     "continue", TEST + "test_uncommitted_file_stops_first_removal", "False is not true"),
    ("cleanup-skip-remote-sha", CLEAN, 'if not isinstance(commit, dict) or commit.get("sha") != sha:',
     "if not isinstance(commit, dict):", TEST + "test_moved_remote_head_stops_remote_delete", "pushed after GitHub"),
    ("cleanup-allow-open", CLEAN, 'or pr.get("state") != "closed" or pr.get("merged") is not True:',
     'or pr.get("state") not in ("closed", "open"):', TEST + "test_open_pr_keeps_every_item", "0 != 3"),
    ("cleanup-glob-temp", CLEAN, "                os.unlink(name, dir_fd=fd)",
     "                for candidate in os.listdir(fd):\n"
     "                    if candidate.endswith('.log'):\n"
     "                        os.unlink(candidate, dir_fd=fd)",
     TEST + "test_unrecorded_temp_file_stays", "unrecorded temp file deleted"),
    ("cleanup-allow-default", CLEAN, 'if branch == default or branch in ("main", "master"):',
     'if branch in ("main", "master"):', TEST + "test_default_branch_keeps_every_item", "0 != 3"),
    ("cleanup-omit-deletions", "night_report.py",
     'table(deleted, ["Item", "Path or ref", "Bytes", "SHA", "Source"])',
     'table([], ["Item", "Path or ref", "Bytes", "SHA", "Source"])',
     TEST + "test_morning_report_lists_deletions_and_refusals", "not found"),
]
