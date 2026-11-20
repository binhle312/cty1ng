"""Read Git and report evidence for the chief journal."""

import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import quote

from night_format import FULL_SHA, Refused, input_record, parsed_target
from night_review import credited_merges, review_cap


def git(checkout, *args):
    try:
        done = subprocess.run(["git", "-C", str(checkout), *args], check=True,
                              capture_output=True, timeout=20)
        return done.stdout.decode()
    except (OSError, ValueError, subprocess.SubprocessError):
        raise Refused("REVIEW_CHECKOUT", str(checkout)) from None


def inside_reviews(chief, value):
    if not isinstance(value, str):
        raise Refused("REVIEW_REPORT", "expected an absolute path")
    root = Path(chief) / "reviews"
    path = Path(value)
    if not path.is_absolute() or path.resolve() != path or not path.is_relative_to(root) or path == root:
        raise Refused("REVIEW_REPORT", str(path))
    return path


def diff_files(checkout, start, end):
    return sorted(set(git(checkout, "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--name-only", "-z", start, end, "--").split("\0")) - {""})


def main_merges(checkout, base, head):
    history = git(checkout, "rev-list", "--first-parent", "--merges", "--parents", f"{base}..{head}")
    merges = {}
    for row in history.splitlines():
        commit, first, *parents = row.split()
        previous = git(checkout, "merge-base", first, base).strip()
        # A real merge of main adds a main ancestor absent from the first parent.
        introduced = [parent for parent in parents if git(checkout, "merge-base", parent, base).strip() == parent
                      and git(checkout, "merge-base", parent, previous).strip() != parent]
        if introduced:
            merges[commit] = {path for parent in introduced for path in diff_files(checkout, previous, parent)}
    return dict(reversed(merges.items()))


def pr_facts(github, target, base):
    host, repo, number = parsed_target(target)
    endpoint = f"repos/{repo}/pulls/{number}"
    pr = github(host, endpoint, "MERGE_READ_FAILED")
    if not isinstance(pr, dict) or pr.get("number") != number:
        raise Refused("MERGE_READ_FAILED", endpoint)
    for field in ("head", "base"):
        ref = pr.get(field)
        if not isinstance(ref, dict) or not isinstance(ref.get("sha"), str) or not FULL_SHA.fullmatch(ref["sha"]):
            raise Refused("MERGE_READ_FAILED", field)
    base_repo = pr["base"].get("repo")
    if (pr["base"].get("ref") != base or not isinstance(base_repo, dict)
            or not isinstance(base_repo.get("full_name"), str) or base_repo["full_name"].lower() != repo):
        raise Refused("MERGE_PR_INELIGIBLE", endpoint)
    return pr


def review_checkout(chief, night, fields, github):
    checkout = inside_reviews(chief, fields["checkout"])
    target, head = fields["target"], fields["head"]
    pr = pr_facts(github, target, night.merge_rows[target][3])
    if pr.get("state") != "open" or pr["head"]["sha"] != head:
        raise Refused("MERGE_HEAD_CHANGED", target)
    if (git(checkout, "rev-parse", "--show-toplevel").strip() != str(checkout)
            or git(checkout, "rev-parse", "HEAD").strip() != head
            or git(checkout, "rev-parse", "--abbrev-ref", "HEAD").strip() != "HEAD"
            or git(checkout, "status", "--porcelain", "--untracked-files=all")):
        raise Refused("REVIEW_CHECKOUT", str(checkout))
    base = pr["base"]["sha"]
    merge_base = git(checkout, "merge-base", base, head).strip()
    merges = main_merges(checkout, base, head)
    files = diff_files(checkout, merge_base, head)
    previous = night.reviews.get(target)
    previous_start = next((e for e in reversed(night.entries) if previous and e["id"] == previous["start"]), None)
    previous_base = previous_start["merge_base"] if previous_start else merge_base
    main_files = set(diff_files(checkout, previous_base, base)).union(*merges.values())
    bonus_merges = credited_merges(night, target, merges)
    return dict(base_sha=base, merge_base=merge_base, main_merges=list(merges), bonus_merges=bonus_merges, files=files,
                intersections=sorted(main_files.intersection(files)), cap=review_cap(night.go, bonus_merges))


def reviewer_brief(night, fields):
    task = night.go["tasks"][fields["target"]]
    assignment = night.assignments[fields["target"]]
    return (f"# Review {fields['target']} at {fields['head']}\n\n"
            f"Use the clean checkout at `{fields['checkout']}`.\n"
            f"Read the full PR diff with `git diff {fields['merge_base']}...{fields['head']}`.\n"
            f"Check merge resolutions with git show --remerge-diff for {', '.join(fields['main_merges']) or 'no main merges'}.\n"
            f"Check the interface with main in these files: {', '.join(fields['intersections']) or 'none'}.\n"
            "Apply the project merge bar to the PR's own changes.\n"
            f"Acceptance criteria: {json.dumps(task['criteria'])}\n"
            f"Owned files: {json.dumps(task['owned'])}\n"
            f"Assigned reviewers: {json.dumps(assignment['reviewers'])}\n\n"
            "Put `Reviewer: ` and a JSON object with provider and role before the final two lines.\n"
            "End with `Findings: ` and JSON lists keyed p1, p2 and p3.\n"
            "Then give `Verdict: ` and a JSON object with head, p1, p2, p3, model and effort.\n")


def load_report(chief, value, who, head):
    path = inside_reviews(chief, value)
    try:
        raw = path.read_bytes()
        reviewer_line, findings_line, verdict_line = raw.decode("utf-8").rstrip("\n").splitlines()[-3:]
        if (not reviewer_line.startswith("Reviewer: ") or not findings_line.startswith("Findings: ")
                or not verdict_line.startswith("Verdict: ")):
            raise ValueError
        actor = input_record(reviewer_line.removeprefix("Reviewer: "))
        if actor != {key: who[key] for key in ("provider", "role")}:
            raise ValueError
        findings = input_record(findings_line.removeprefix("Findings: "))
        verdict = input_record(verdict_line.removeprefix("Verdict: "))
        keys = ("p1", "p2", "p3")
        if set(findings) != set(keys) or not all(isinstance(findings[k], list) and all(
                isinstance(item, str) and item.strip() for item in findings[k]) for k in keys):
            raise ValueError
        counts = {key: len(findings[key]) for key in keys}
        if (verdict != dict(head=head, model=who["model"], effort=who["effort"], **counts)
                or any(type(verdict[key]) is not int for key in keys)):
            raise ValueError
    except (OSError, ValueError, Refused):
        raise Refused("REVIEW_REPORT", str(path)) from None
    return dict(who=who, head=head, source=str(path), **findings), hashlib.sha256(raw).hexdigest()


def reports_at(chief, paths, assignment, head):
    if not isinstance(paths, list) or len(paths) != 2 or paths[0] == paths[1]:
        raise Refused("REVIEW_REPORT", "two distinct paths are required")
    reports, digests = zip(*(load_report(chief, path, who, head)
                             for path, who in zip(paths, assignment["reviewers"])))
    return list(reports), list(digests)


def changed_paths(page_rows, pr, target):
    host, repo, number = parsed_target(target)
    files = page_rows(host, f"repos/{repo}/pulls/{number}/files?per_page=100", "REVIEW_SCOPE")
    if type(pr.get("changed_files")) is not int or pr["changed_files"] != len(files):
        raise Refused("REVIEW_SCOPE", "GitHub file list is incomplete")
    changed, returned = set(), set()
    for row in files:
        names = [row.get("filename")]
        if row.get("status") == "renamed":
            names.append(row.get("previous_filename"))
        if any(not isinstance(name, str) or not name for name in names) or names[0] in returned:
            raise Refused("REVIEW_SCOPE", repr(names))
        returned.add(names[0])
        changed.update(names)
    return sorted(changed)


def main_head(github, host, repo, base):
    branch = github(host, f"repos/{repo}/branches/{quote(base, safe='')}", "MERGE_CI_UNKNOWN")
    commit = branch.get("commit") if isinstance(branch, dict) and branch.get("name") == base else None
    head = commit.get("sha") if isinstance(commit, dict) else None
    if not isinstance(head, str) or not FULL_SHA.fullmatch(head):
        raise Refused("MERGE_CI_UNKNOWN", base)
    return head
