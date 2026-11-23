"""Chief commands. Keep external reads and the journal append under one lock."""

import os
from pathlib import Path

from night_files import Lock, add_entry, bound_night, clock, read_words, write_file
from night_leader import init_leader, leader_events
from night_cleanup import dispatch as cleanup_dispatch
from night_format import FIELDS, FULL_SHA, Refused, entry_time, iso, schema_problem, text_list, canonical_target, input_record, parsed_target
from night_review import GRANT_CHANGES, accepted_findings, checked_plan, chief_only, grant_findings, owned_scope, reviewed_head_matches, round_number, task_for
from night_merge_policy import merge_policy, require_night_paths
from night_review_io import changed_paths, main_head, pr_facts, reports_at, review_checkout, reviewer_brief
from night_rules import judge, merge_item, pending_attempt, review_kind


INPUTS = {
    "plan": {"plan", "strategy"},
    "review-start": {"checkout", "head"},
    "review": {"reports", "ledger"},
    "ruling": {"finding", "severity", "reason"},
    "advice": {"advisor", "consultants"},
    "confirm": {"grant"},
    "withdraw": {"grant", "reason"},
}


def checked_fields(kind, fields):
    expected = INPUTS[kind] | {"chief"}
    if kind not in ("confirm", "withdraw"):
        expected.add("target")
    if kind == "ruling":
        expected.add("source")
    optional = {"source", "review_id"} if kind == "ruling" else {"handoff"} if kind == "review" else set()
    expected |= optional
    if not expected - optional <= fields.keys() <= expected:
        raise Refused("MERGE_EVIDENCE_INVALID", kind)
    if any(not isinstance(fields[key], str) or not fields[key].strip()
           for key in fields.keys() - {"reports", "consultants", "grant", "ledger", "handoff", "review_id"}):
        raise Refused("MERGE_EVIDENCE_INVALID", kind)


def current_assignment(night, target):
    task = task_for(night, target)
    if not task or task["class"] == "owner":
        raise Refused("REVIEW_OWNER_TASK", target)
    assignment = night.assignments.get(target)
    if not assignment:
        raise Refused("REVIEWER_NOT_ASSIGNED", target)
    return assignment


def validate_candidate(night, kind, fields, now, fake):
    entry = dict(id=night.last["id"] + 1, kind=kind, t=iso(now), **fields)
    if fake:
        entry["fake_clock"] = True
    if problem := schema_problem(entry):
        raise Refused("MERGE_EVIDENCE_INVALID", problem)
    if problems := judge(night, entry):
        raise Refused(*problems[0])


def review_command(chief, night, kind, fields, now, fake, github):
    target = fields["target"] = canonical_target(fields["target"])
    assignment = current_assignment(night, target)
    fields["assignment"] = assignment["id"]
    leader_events(chief, night, target)
    if kind == "plan":
        return kind, fields
    if not (plan := checked_plan(night, target, assignment["id"])):
        raise Refused("REVIEW_PLAN_REQUIRED", target)
    start = night.review_starts.get(target)
    if kind == "review" and start and (prior := night.reviews.get(target)) and (
            prior["start"] == start["id"] and start["assignment"] == assignment["id"]
            and fields["reports"] == [r["source"] for r in prior["reports"]]):
        return None, prior
    problem = merge_item(night, target)
    if problem and not (kind == "ruling" and problem == "REVIEW_CAP_REACHED"):
        raise Refused(problem, target)
    if kind == "review-start":
        fields.update(review_checkout(chief, night, fields, github))
        fields["plan_check"] = plan["id"]
        fields["round"] = round_number(night, target, fields["head"])
        prior = night.review_starts.get(target)
        if (prior and prior["assignment"] == assignment["id"] and prior["head"] == fields["head"]
                and all(prior[key] == fields[key] for key in fields) and
                (not (finished := night.reviews.get(target)) or finished["start"] != prior["id"])):
            return None, prior
        fields["leader"] = assignment["leader"]
        fields["brief"] = str(Path(chief) / "reviews" / f"brief-E{night.last['id'] + 1}.md")
        validate_candidate(night, kind, fields, now, fake)
        brief = Path(fields["brief"])
        write_file(str(brief.parent), brief.name, reviewer_brief(night, dict(fields, id=night.last["id"] + 1)))
        return kind, fields
    start = night.review_starts.get(target)
    if not start or start["assignment"] != assignment["id"]:
        raise Refused("REVIEW_START_REQUIRED", target)
    fields["start"] = start["id"]
    if kind == "review":
        if not text_list(fields["ledger"]) or not fields["ledger"] or not all(k.strip() for k in fields["ledger"]):
            raise Refused("MERGE_EVIDENCE_INVALID", "record the sources checked in the ledger")
        fields["reports"], fields["digests"] = reports_at(chief, fields["reports"], assignment, night, start)
        fields["leader"] = assignment["leader"]
        kind = review_kind(night, fields)
        handoff = fields.pop("handoff", None)
        if handoff is not None and (not isinstance(handoff, dict) or set(handoff) != {"done", "next"}
                                    or any(not isinstance(value, str) or not value.strip() for value in handoff.values())):
            raise Refused("MERGE_EVIDENCE_INVALID", "provide the work done and proposed next step")
        if kind == "cap":
            findings = accepted_findings(night, dict(fields, id=night.last["id"] + 1))
            spec = handoff or dict(done=f"Reviewed {start['head']}", next="The chief records the work done and next step")
            fields["spec"] = dict(spec, findings=[dict(severity=level.upper(), text=text)
                                            for level, texts in findings.items() for text in texts])
        return kind, fields
    review = night.reviews.get(target)
    if not review or review["start"] != start["id"]:
        raise Refused("REVIEW_START_REQUIRED", target)
    if kind == "ruling" and "review_id" in fields:
        value = fields.pop("review_id")
        historical = next((entry for entry in night.entries if entry["id"] == value and type(value) is int
                           and entry["kind"] in ("review", "cap") and entry["target"] == target), None)
        if historical is None:
            raise Refused("REVIEW_REPORT", "unknown review for this PR")
        review = historical
    fields["review"] = review["id"]
    if kind == "ruling" and "source" not in fields:
        matches = [r["source"] for r in review["reports"] if fields["finding"] in r["p1"] + r["p2"] + r["p3"]]
        if len(matches) != 1:
            raise Refused("REVIEW_REPORT", "give the report path for this finding")
        fields["source"] = matches[0]
    if kind == "advice" and (not isinstance(fields["consultants"], list)
                             or any(answer not in ("allow", "hold") for answer in fields["consultants"])):
        raise Refused("REVIEW_ADVICE_REQUIRED", target)
    return kind, fields


def check_main(night, github, check_policy):
    bases = {(host, repo, row[3]) for target, row in night.merge_rows.items()
             for host, repo, _ in [parsed_target(target)]}
    return {(host, repo, base): check_main_branch(github, check_policy, host, repo, base, night.go["allow_empty_checks"])
            for host, repo, base in sorted(bases)}


def check_main_branch(github, check_policy, host, repo, base, empty):
    head = main_head(github, host, repo, base)
    checks = check_policy(host, repo, base, head, empty, check_main=True)
    if main_head(github, host, repo, base) != head:
        raise Refused("MERGE_CI_UNKNOWN", f"{repo}/{base} advanced")
    return head, checks


def grant_fields(chief, night, raw, github, page_rows, check_policy):
    if set(raw) != {"reports"}:
        raise Refused("MERGE_EVIDENCE_INVALID", "grant takes only two report paths")
    choices = [r for r in night.reviews.values() if [row["source"] for row in r["reports"]] == raw["reports"]]
    if len(choices) != 1:
        raise Refused("REVIEW_START_REQUIRED", "use the original reports from one completed round")
    review = choices[0]
    target = review["target"]
    assignment = current_assignment(night, target)
    start = night.review_starts[target]
    if (start["assignment"] != assignment["id"] or start["id"] != review["start"]
            or start["plan_check"] != night.plans[target]["id"]):
        raise Refused("REVIEW_START_REQUIRED", target)
    if problem := merge_item(night, target):
        raise Refused(problem, target)
    original, digests = reports_at(chief, raw["reports"], assignment, night, start)
    if original != review["reports"] or digests != review["digests"]:
        raise Refused("REVIEW_REPORT", target)
    head, base, method = start["head"], *night.merge_rows[target][3:5]
    records = leader_events(chief, night, target)
    if night.pending_grant is not None:
        existing = night.grants[night.pending_grant]
        if (existing["target"], existing["head"]) == (target, head) and not any(
                record["kind"] == "merge-attempt" and record["grant"] == existing["id"] for record in records):
            raise Refused("MERGE_PERMISSION_DUPLICATE", target)
        raise Refused("MERGE_PENDING", existing["target"])
    if (target, head) in night.granted:
        raise Refused("MERGE_PERMISSION_DUPLICATE", target)
    if pending_attempt(records):
        raise Refused("MERGE_PENDING", target)
    host, repo, _ = parsed_target(target)
    pr = pr_facts(github, target, base)
    if not reviewed_head_matches(pr, start):
        raise Refused("MERGE_HEAD_CHANGED", target)
    if (pr.get("state") != "open" or type(pr.get("draft")) is not bool or pr.get("merged") is not False
            or pr.get("mergeable") is not True or pr.get("mergeable_state") != "clean" or pr.get("auto_merge") is not None):
        raise Refused("MERGE_PR_INELIGIBLE", target)
    p3 = grant_findings(night, review)
    if p3 and (not isinstance(pr.get("body"), str) or any(text not in pr["body"] for text in p3)):
        raise Refused("REVIEW_REPORT", "list each open P3 in the PR body")
    files = changed_paths(page_rows, pr, target)
    require_night_paths(files)
    effects = merge_policy(night, target, pr, method, github, page_rows)
    if not owned_scope(night, target, files):
        raise Refused("REVIEW_SCOPE", target)
    if files != start["files"]:
        raise Refused("REVIEW_SCOPE", "GitHub files differ from the checkout's PR diff")
    head_checks = check_policy(host, repo, base, head, night.go["allow_empty_checks"])
    main, main_checks = check_main(night, github, check_policy)[host, repo, base]
    current = pr_facts(github, target, base)
    if not reviewed_head_matches(current, start) or main != start["base_sha"]:
        raise Refused("MERGE_HEAD_CHANGED", target)
    return dict(chief=night.go["chief"], run=night.run, target=target, head=head, leader=assignment["leader"],
                base=base, method=method, head_ref=pr["head"]["ref"], repo_id=effects["repo_id"],
                assignment=assignment["id"], reviewers=assignment["reviewers"],
                review=review["id"], review_base=main, files=files,
                evidence=dict(reports=raw["reports"], ci=[head, main], checks={"head": head_checks, "main": main_checks},
                              ledger=review["ledger"], p3=p3, effects=effects))


def merge_resolution(chief, night, kind, fields, github, check_policy):
    grant_id = fields["grant"]
    if type(grant_id) is not int or night.pending_grant != grant_id:
        raise Refused("MERGE_PENDING")
    grant = night.grants[grant_id]
    target = fields["target"] = grant["target"]
    host, repo, _ = parsed_target(target)
    base = grant["base"]
    pr = pr_facts(github, target, base)
    records = leader_events(chief, night, target)
    attempt = next((e for e in records if e["kind"] == "merge-attempt" and e["grant"] == grant_id), None)
    result = next((e for e in records if attempt and e["kind"] == "merge-result" and e["of"] == attempt["id"]), None)
    if kind == "withdraw":
        if pr.get("merged") is not False or attempt and (not result or result["outcome"] not in ("failed", "unsent")):
            raise Refused("MERGE_PENDING", target)
        return fields
    sha = pr.get("merge_commit_sha")
    if (pr.get("merged") is not True or pr.get("state") != "closed" or pr["head"]["sha"] != grant["head"]
            or not isinstance(sha, str) or not FULL_SHA.fullmatch(sha)
            or result and result["outcome"] == "merged" and result["sha"] != sha):
        raise Refused("MERGE_NOT_CONFIRMED", target)
    main, checks = check_main_branch(github, check_policy, host, repo, base, night.go["allow_empty_checks"])
    if sha != main:
        compare = github(host, f"repos/{repo}/compare/{sha}...{main}", "MERGE_NOT_CONFIRMED")
        if (not isinstance(compare, dict) or compare.get("status") != "ahead"
                or (compare.get("merge_base_commit") or {}).get("sha") != sha):
            raise Refused("MERGE_NOT_CONFIRMED", target)
    return dict(fields, head=grant["head"], sha=sha, main=main, checks=checks)


def release_unused(chief, night, kind, fields):
    target = fields.get("target")
    grant_id = night.pending_grant
    if kind not in GRANT_CHANGES or grant_id is None or night.grants[grant_id]["target"] != target:
        return
    records = leader_events(chief, night, target)
    if not any(entry["kind"] == "merge-attempt" and entry["grant"] == grant_id for entry in records):
        fields["release_grant"] = grant_id


def command(args, github, page_rows, check_policy):
    fields = input_record(read_words(args.data))
    kind = args.command_name
    folder = os.path.abspath(args.dir)
    with Lock(folder):
        night = bound_night(folder)
        if night.faults:
            raise Refused("JOURNAL_FAULTS")
        now, fake = clock()
        if not night.go:
            raise Refused("NOT_STARTED")
        if kind == "grant":
            if now >= entry_time(night.go["stop"]):
                raise Refused("AFTER_STOP")
            fields = grant_fields(folder, night, fields, github, page_rows, check_policy)
            kind = "merge-permission"
        else:
            checked_fields(kind, fields)
            if not chief_only(night, fields["chief"]):
                raise Refused("MERGE_CHIEF_ONLY")
            if kind in ("confirm", "withdraw"):
                fields = merge_resolution(folder, night, kind, fields, github, check_policy)
            else:
                kind, fields = review_command(folder, night, kind, fields, now, fake, github)
        if kind:
            now, fake = clock()
            release_unused(folder, night, kind, fields)
            entry = add_entry(folder, night, kind, fields, now, fake)
        else:
            entry = fields
    print(f"E{entry['id']} {entry['kind']}")


def cmd_typed(args):
    fields = input_record(read_words(args.data))
    kind = args.command_name
    if fields.keys() - (set(FIELDS[kind]) - {"run"}):
        raise Refused("MERGE_EVIDENCE_INVALID", "unknown fields")
    if kind == "assign":
        fields["target"] = canonical_target(fields.get("target"))
    with Lock(args.dir):
        night = bound_night(args.dir)
        now, fake = clock()
        fields["run"] = night.run
        if kind == "assign" and isinstance(worktree := fields.get("worktree"), str):
            if (not os.path.isabs(worktree) or os.path.realpath(worktree) != worktree
                    or os.path.commonpath((worktree, os.path.abspath(args.dir))) in (worktree, os.path.abspath(args.dir))):
                raise Refused("MERGE_JOURNAL_PATH", worktree)
        if kind == "assign":
            if "cleanup" in fields:
                cleanup_dispatch(args.dir, fields)
                if fields.setdefault("folder", fields["cleanup"]["folder"]) != fields["cleanup"]["folder"]:
                    raise Refused("CLEAN_ASSIGNMENT", "leader folder differs from cleanup folder")
            validate_candidate(night, kind, fields, now, fake)
            init_leader(args.dir, night, fields, now)
            release_unused(args.dir, night, kind, fields)
        entry = add_entry(args.dir, night, kind, fields, now, fake)
    print(f"E{entry['id']} {entry['kind']}")
