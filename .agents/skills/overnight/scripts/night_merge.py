"""Use a chief grant for one bounded GitHub merge attempt."""

import subprocess
import time

from night_files import LeaderLock, bound_night, clock
from night_format import FULL_SHA, Refused, canonical_target, entry_time, event_id, iso, parsed_target
from night_leader import leader_append, leader_events
from night_review import current_review_allows
from night_merge_policy import merge_policy, same_repository
from night_review_io import changed_paths, main_head, pr_facts
from night_rules import check_grant, pending_attempt


def before_merge(night, grant, github, page_rows, check_policy):
    target = grant["target"]
    host, repo, _ = parsed_target(target)
    pr = pr_facts(github, target, grant["base"], final=True)
    if pr["head"]["sha"] != grant["head"] or pr["base"]["sha"] != grant["review_base"]:
        raise Refused("MERGE_HEAD_CHANGED")
    if (pr.get("state") != "open" or type(pr.get("draft")) is not bool or pr.get("merged") is not False
            or pr.get("mergeable") is not True or pr.get("mergeable_state") != "clean" or pr.get("auto_merge") is not None):
        raise Refused("MERGE_PR_INELIGIBLE", target)
    if changed_paths(page_rows, pr, target) != grant["files"]:
        raise Refused("REVIEW_SCOPE", "GitHub files differ from the reviewed diff")
    effects = merge_policy(night, target, pr, grant["method"], github, page_rows)
    if effects["repo_id"] != grant["repo_id"] or pr["head"]["ref"] != grant["head_ref"]:
        raise Refused("MERGE_HEAD_CHANGED")
    empty = night.go["allow_empty_checks"]
    checks = {"head": check_policy(host, repo, grant["base"], grant["head"], empty),
              "main": check_policy(host, repo, grant["base"], grant["review_base"], empty, check_main=True)}
    if main_head(github, host, repo, grant["base"]) != grant["review_base"]:
        raise Refused("MERGE_HEAD_CHANGED")
    return pr, effects, checks


def get_grant(folder, args, target, entry_id):
    night = bound_night(folder)
    now, fake = clock()
    records = leader_events(folder, night, target) if target in night.assignments else []
    grant = check_grant(night, args, target, entry_id, now, fake)
    if any(e["kind"] == "merge-attempt" and e["grant"] == entry_id for e in records):
        raise Refused("MERGE_PERMISSION_USED")
    if not current_review_allows(night, grant) or night.active_grants.get(target) != entry_id or any(
            e["kind"] == "merge-invalidate" and e["grant"] == entry_id for e in records):
        raise Refused("MERGE_PERMISSION_INACTIVE")
    if pending_attempt(records):
        raise Refused("MERGE_PENDING")
    return night, grant, records


def send_merge(github, host, endpoint, grant, timeout):
    try:
        status, data = github(host, endpoint, "MERGE_OUTCOME_UNKNOWN",
                              payload={"sha": grant["head"], "merge_method": grant["method"]}, timeout=timeout)
    except Refused:
        return "unknown", None, "MERGE_OUTCOME_UNKNOWN"
    if isinstance(data, dict) and status == 200 and data.get("merged") is True:
        sha = data.get("sha")
        if isinstance(sha, str) and FULL_SHA.fullmatch(sha):
            return "merged", sha, None
    if status == 409:
        return "failed", None, "MERGE_HEAD_CHANGED"
    if status in (401, 403, 404, 405, 422) or status == 200 and isinstance(data, dict) and data.get("merged") is False:
        return "failed", None, "MERGE_REJECTED"
    return "unknown", None, "MERGE_OUTCOME_UNKNOWN"


def remaining(night, deadline):
    if clock()[0] >= entry_time(night.go["stop"]):
        raise Refused("AFTER_STOP")
    left = deadline - time.monotonic()
    if left <= 0:
        raise Refused("MERGE_REQUEST_BUDGET")
    return left


def mark_ready(host, repo, number, timeout):
    try:
        done = subprocess.run(["gh", "pr", "ready", str(number), "--repo", f"{host}/{repo}"],
                              capture_output=True, check=False, timeout=timeout, shell=False)
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"
    return "failed" if done.returncode else "ready"


def final_read(night, grant, github, deadline):
    host, repo, number = parsed_target(grant["target"])

    def bounded_get(host, endpoint, code):
        return github(host, endpoint, code, timeout=remaining(night, deadline))

    for index in range(night.go["ready_reads"]):
        pr = pr_facts(bounded_get, grant["target"], grant["base"], final=True)
        if (pr["head"]["sha"] != grant["head"] or pr["base"]["sha"] != grant["review_base"]
                or pr["head"].get("ref") != grant["head_ref"]):
            raise Refused("MERGE_HEAD_CHANGED", grant["target"])
        same_repository(pr, repo, grant["repo_id"])
        if (pr.get("state") != "open" or pr.get("draft") is not False or pr.get("merged") is not False
                or pr.get("auto_merge") is not None):
            raise Refused("MERGE_PR_INELIGIBLE", grant["target"])
        mergeable, state = pr.get("mergeable"), pr.get("mergeable_state")
        if mergeable is True and state == "clean":
            return host, f"repos/{repo}/pulls/{number}/merge"
        if not (mergeable is None and "mergeable" in pr and state in ("unknown", "clean")
                or mergeable is True and state == "unknown"):
            raise Refused("MERGE_PR_INELIGIBLE", grant["target"])
        if index + 1 < night.go["ready_reads"]:
            delay = night.go["ready_delay"]
            if remaining(night, deadline) <= delay:
                raise Refused("MERGE_REQUEST_BUDGET")
            time.sleep(delay)
    raise Refused("MERGE_PR_INELIGIBLE", "mergeability remains unknown")


def claimed_merge(chief, night, grant, records, attempt, pr, github, budget):
    target = grant["target"]
    host, repo, number = parsed_target(target)
    deadline = time.monotonic() + budget
    send_time = None
    try:
        if pr["draft"]:
            outcome = mark_ready(host, repo, number, remaining(night, deadline))
            leader_append(chief, night, target, records, "merge-ready", clock()[0],
                          {"of": attempt["id"], "outcome": outcome})
            if outcome != "ready":
                raise Refused("MERGE_READY_FAILED", outcome)
        endpoint_host, endpoint = final_read(night, grant, github, deadline)
        send_time = clock()[0]
        outcome, sha, code = send_merge(github, endpoint_host, endpoint, grant, remaining(night, deadline))
    except Refused as refusal:
        if refusal.code == "WRITE_FAILED":
            raise
        outcome, sha, code = "unsent", None, refusal.code
    leader_append(chief, night, target, records, "merge-result", clock()[0],
                  {"of": attempt["id"], "outcome": outcome, "sha": sha, "code": code,
                   "sent_at": iso(send_time) if outcome != "unsent" else None})
    if code:
        raise Refused(code)
    return sha


def command(args, github, page_rows, check_policy, budget):
    target = canonical_target(args.target)
    if not FULL_SHA.fullmatch(args.head):
        raise Refused("HEAD_FORM")
    grant_id = event_id(args.grant)
    with LeaderLock(args.dir):
        night, grant, _ = get_grant(args.dir, args, target, grant_id)
    try:
        pr, effects, checks = before_merge(night, grant, github, page_rows, check_policy)
    except Refused as refusal:
        if refusal.code == "MERGE_HEAD_CHANGED":
            with LeaderLock(args.dir):
                current, _, records = get_grant(args.dir, args, target, grant_id)
                leader_append(args.dir, current, target, records, "merge-invalidate", clock()[0], {"grant": grant_id})
        raise
    with LeaderLock(args.dir):
        night, grant, records = get_grant(args.dir, args, target, grant_id)
        now, _ = clock()
        if now >= entry_time(night.go["stop"]):
            raise Refused("AFTER_STOP")
        attempt = leader_append(args.dir, night, target, records, "merge-attempt", now,
                                {**{key: grant[key] for key in ("head", "leader", "base", "method")}, "grant": grant_id, "effects": effects, "checks": checks})
        sha = claimed_merge(args.dir, night, grant, records, attempt, pr, github, budget)
    print(f"Merged {target} at {sha} (attempt {attempt['id']})")
