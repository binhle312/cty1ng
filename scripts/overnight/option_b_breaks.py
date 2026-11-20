"""Expected checks for the named breaks in the Option B test strategy."""

CLI = "night.py"
FILES = "night_files.py"
FORMAT = "night_format.py"
RULES = "night_rules.py"
REPORT = "night_report.py"
OPTION = "test_option_b.OptionBTests."
MERGE = "test_option_b_merge.MergeTests."
META = "test_meta.MetaTests."
RECOVERY = "test_option_b_recovery.RecoveryTests."

BREAKS = [
    ("allow-invalid-offset", FORMAT,
     "if zone_parts and (int(zone_parts[2]) > 23 or int(zone_parts[3]) > 59):", "if False:",
     OPTION + "test_stop_offset", "[STOP_NO_OFFSET]"),
    ("reuse-minute-run", CLI, "run = str(uuid.uuid4())", 'run = "5834abd5-a023-4ae8-9d4b-cd8e15e535e5"',
     OPTION + "test_grant_same_minute", "=="),
    ("ignore-format-version", FILES,
     'if type(entry.get("format")) is not int or entry["format"] != FORMAT:', "if False:",
     OPTION + "test_format_boundary", "[FORMAT_UNSUPPORTED]"),
    ("sweep-unrelated-temp", FILES, "    temp = None\n    try:",
     '    for other in os.listdir(folder):\n        if other.startswith(f".{name}.") and other.endswith(".tmp"):\n'
     '            os.unlink(os.path.join(folder, other))\n    temp = None\n    try:',
     OPTION + "test_cleanup_owns_temp", "unrelated temp file"),
    ("ignore-staged-cut", FILES, "if staged := staged_repair(folder, data, entries):",
     "if staged := None:", OPTION + "test_repair_resumes_at_the_same_cut", "2 != 1"),
    ("allow-write-during-repair", FILES, "if staged_repair(folder, data, entries):",
     "if False:", OPTION + "test_repair_resumes_at_the_same_cut", "[REPAIR_PENDING]"),
    ("append-report-again-after-sync-error", CLI, 'if night.close or not entry or night.made_old_by or entry.get("merges", []) != merges:',
     "if True:", OPTION + "test_report_recovers_complete_append_without_second_entry", "2 != 1"),
    ("ignore-grant-night", RULES, 'if args.run != night.run:', 'if False:',
     MERGE + "test_merge_scope_and_phase", "0 != 3"),
    ("ignore-grant-duplicate", RULES, 'if (target, entry["head"]) in night.granted:', "if False:",
     "test_brief8.Brief8Tests.test_refuses_duplicate_grant_after_withdrawal", "0 != 3"),
    ("fixed-review-cap-five", "night_review.py", 'go["review_cap"] +', '5 +',
     "test_brief8.Brief8Tests.test_p3_needs_fix_then_advisor_at_cap", "[REVIEW_ADVICE_REQUIRED]"),
    ("p3-triggers-cap", RULES, 'blocked = any(r["p1"] or r["p2"] for r in entry["reports"])', "blocked = True",
     "test_brief8.Brief8Tests.test_p3_needs_fix_then_advisor_at_cap", "[REVIEW_ADVICE_REQUIRED]"),
    ("drop-capped-pr", REPORT, "for target, entry in night.capped.items():", "for target, entry in ():",
     "test_brief8.Brief8Tests.test_review_cap_stops_at_eight_for_one_main_merge", "P1 blocking issue"),
    ("ignore-branch-delete-effect", CLI, 'or settings.get("delete_branch_on_merge") is not False', '',
     MERGE + "test_unknown_policy_and_write_effects_hold", "0 != 3"),
    ("accept-wrong-check-source", "night_review.py", 'and (source in (None, -1) or isinstance(c.get("app"), dict) and c["app"].get("id") == source)',
     'and True', MERGE + "test_required_check_matches_head_and_source", "0 != 3"),
    ("omit-grant-sha", CLI, '{"sha": grant["head"], "merge_method": grant["method"]}', '{"merge_method": grant["method"]}',
     MERGE + "test_merge_argv_and_one_attempt", "[0, 3]"),
    ("drop-cut-prefix-identity", FILES, 'or hashlib.sha256(prefix).hexdigest() != side["prefix_sha256"]',
     "", RECOVERY + "test_repair_preserves_a_side_record_with_wrong_identity", "0 != 3"),
    ("snapshot-check-without-report-lock", CLI,
     "        found = list(night.faults) + state_problems(night, args.dir, now, args.now)",
     "    found = list(night.faults) + state_problems(night, args.dir, now, args.now)\n    with Lock(args.dir):",
     RECOVERY + "test_check_snapshot_orders_with_report_and_render", "TimeoutError not raised"),
    ("repair-without-snapshot-lock", FILES, "def repair(folder):\n    with Lock(folder):",
     "def repair(folder):\n    if True:", RECOVERY + "test_check_snapshot_orders_with_repair", "TimeoutError not raised"),
    ("static-repair-read-without-lock", FILES, "def repair(folder):\n    with Lock(folder):",
     "def repair(folder):\n    if True:", META + "test_each_journal_read_is_under_the_lock", "night_files.py: repair"),
    ("cutoff-inclusive", REPORT, 'if start <= merged_at < end:', "if start <= merged_at <= end:",
     MERGE + "test_audit_includes_unlisted_owner_and_uses_half_open_window", "2 != 1"),
    ("call-owner-merge-breach", REPORT, '"verified" if matched else "unmatched"', '"verified" if matched else "breach"',
     MERGE + "test_audit_includes_unlisted_owner_and_uses_half_open_window", "breach"),
    ("check-report-reads-without-lock", CLI,
     "        found = list(night.faults) + state_problems(night, args.dir, now, args.now)",
     "    found = list(night.faults) + state_problems(night, args.dir, now, args.now)\n    with Lock(args.dir):",
     META + "test_each_journal_read_is_under_the_lock", "cmd_check"),
]
