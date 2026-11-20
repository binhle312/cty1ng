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
    ("ignore-assignment-id", RULES, 'not assignment or entry["assignment"] != assignment["id"]',
     "not assignment", OPTION + "test_grant_reviewer_assignment", "0 != 3"),
    ("ignore-grant-night", RULES, 'if entry["run"] != night.run:\n            return [("MERGE_PERMISSION_NIGHT", target)]',
     'if False:\n            return [("MERGE_PERMISSION_NIGHT", target)]',
     OPTION + "test_grant_scope_and_duplicate", "0 != 3"),
    ("ignore-grant-duplicate", RULES, 'if (target, entry["head"]) in night.granted:', "if False:",
     OPTION + "test_grant_scope_and_duplicate", "0 != 3"),
    ("fixed-review-cap-five", RULES, '+ 1 >= night.go["review_cap"] else "review"', '+ 1 >= 5 else "review"',
     OPTION + "test_review_cap_stops_only_a_blocking_round", "' cap' not found"),
    ("p3-triggers-cap", RULES, 'blocked = any(r["p1"] or r["p2"] for r in entry["reports"])', "blocked = True",
     OPTION + "test_p3_round_goes_to_permission_at_cap", "' review' not found"),
    ("allow-round-six", RULES, "    if problem:\n        return [(problem, target)]",
     '    if problem and not (problem == "REVIEW_CAP_REACHED" and kind in ("review", "cap")):\n        return [(problem, target)]',
     OPTION + "test_review_cap_default_refuses_round_six", "0 != 3"),
    ("drop-capped-pr", REPORT, "read_rounds(night, records)", "pass",
     OPTION + "test_review_cap_stops_only_a_blocking_round", "github.com/example/app#12"),
    ("ignore-cap-on-merge", RULES, "if problem := merge_item(night, target, args.leader):",
     'if (problem := merge_item(night, target, args.leader)) and problem != "REVIEW_CAP_REACHED":',
     MERGE + "test_cap_refuses_prior_grant", "0 != 3"),
    ("ignore-branch-delete-effect", CLI, 'or settings.get("delete_branch_on_merge") is not False', '',
     MERGE + "test_unknown_policy_and_write_effects_hold", "0 != 3"),
    ("accept-wrong-check-source", RULES, 'and (source in (None, -1) or isinstance(c.get("app"), dict) and c["app"].get("id") == source)',
     'and True', MERGE + "test_required_check_matches_head_and_source", "0 != 3"),
    ("omit-grant-sha", CLI, '{"sha": grant["head"], "merge_method": grant["method"]}', '{"merge_method": grant["method"]}',
     MERGE + "test_merge_argv_and_one_attempt", "[0, 3]"),
    ("drop-cut-prefix-identity", FILES, 'or hashlib.sha256(prefix).hexdigest() != side["prefix_sha256"]',
     "", RECOVERY + "test_repair_preserves_a_side_record_with_wrong_identity", "0 != 3"),
    ("snapshot-check-without-report-lock", CLI,
     "        found = list(night.faults) + state_problems(night, args.dir, now, args.now)",
     "    found = list(night.faults) + state_problems(night, args.dir, now, args.now)\n    with Lock(args.dir):",
     RECOVERY + "test_check_snapshot_orders_with_report_and_render", "TimeoutError not raised"),
    ("cutoff-inclusive", REPORT, 'if start <= merged_at < end:', "if start <= merged_at <= end:",
     MERGE + "test_audit_includes_unlisted_owner_and_uses_half_open_window", "2 != 1"),
    ("call-owner-merge-breach", REPORT, '"verified" if matched else "unmatched"', '"verified" if matched else "breach"',
     MERGE + "test_audit_includes_unlisted_owner_and_uses_half_open_window", "breach"),
    ("check-report-reads-without-lock", CLI,
     "        found = list(night.faults) + state_problems(night, args.dir, now, args.now)",
     "    found = list(night.faults) + state_problems(night, args.dir, now, args.now)\n    with Lock(args.dir):",
     META + "test_each_journal_read_is_under_the_lock", "cmd_check"),
]
