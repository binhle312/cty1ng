"""Compare the approved repository baseline and the current direct merge effects."""

from urllib.parse import quote, urlencode

from night_format import Refused, parsed_target, valid_base
from night_review_io import main_head

METHODS = {"squash": "allow_squash_merge", "merge": "allow_merge_commit", "rebase": "allow_rebase_merge"}


def repository_matches(repository, name, repo_id):
    if not isinstance(repository, dict):
        return False
    full_name = repository.get("full_name")
    return (isinstance(full_name, str) and full_name.lower() == name and type(repository.get("id")) is int
            and repository["id"] == repo_id)


def same_repository(pr, repo, repo_id):
    if not all(repository_matches(pr[side].get("repo"), repo, repo_id) for side in ("base", "head")):
        raise Refused("MERGE_PR_INELIGIBLE", "expected the same head and base repository")


def exact_dependencies(page_rows, host, repo, repo_id, branch, excluded, code):
    prefix = f"repos/{repo}/pulls"
    for side, value in (("head", repo.split("/")[0] + ":" + branch), ("base", branch)):
        rows = page_rows(host, prefix + "?" + urlencode({"state": "open", side: value, "per_page": 100}), code)
        for row in rows:
            number, ref = row.get("number"), row.get(side)
            if type(number) is not int or not isinstance(ref, dict) or not isinstance(ref.get("ref"), str):
                raise Refused(code, "invalid open PR row")
            repository = ref.get("repo")
            if not isinstance(repository, dict) or type(repository.get("id")) is not int or not isinstance(repository.get("full_name"), str):
                raise Refused(code, "missing open PR repository identity")
            same_id = repository["id"] == repo_id
            if same_id != (repository["full_name"].lower() == repo):
                raise Refused(code, "inconsistent open PR repository identity")
            if number != excluded and same_id and ref["ref"] == branch:
                raise Refused(code, f"open PR #{number} uses {branch} as {side}")


def branch_deletable(github, page_rows, host, repo, branch, sha, settings, code):
    default = settings.get("default_branch")
    if not isinstance(default, str) or not default:
        raise Refused(code, "missing default branch")
    if branch in ("main", "master", default):
        raise Refused(code, f"protected branch name {branch}")
    escaped = quote(branch, safe='')
    branch_info = github(host, f"repos/{repo}/branches/{escaped}", code)
    commit = branch_info.get("commit") if isinstance(branch_info, dict) else None
    if (not isinstance(commit, dict) or branch_info.get("name") != branch
            or branch_info.get("protected") is not False or commit.get("sha") != sha):
        raise Refused(code, f"cannot delete exact ref {branch}")
    rules = page_rows(host, f"repos/{repo}/rules/branches/{escaped}?per_page=100", code)
    if any(not isinstance(row.get("type"), str) or row["type"] == "deletion" for row in rules):
        raise Refused(code, f"deletion rules for {branch}")


def merge_policy(night, target, pr, method, github, page_rows):
    host, repo, number = parsed_target(target)
    code = "MERGE_EFFECT_UNCLEAR"
    baseline = night.entries[0].get("automation", {}).get(f"{host}/{repo}")
    if baseline is None:
        raise Refused(code, "approved automation baseline is missing")
    repo_id = baseline["repo_id"]
    same_repository(pr, repo, repo_id)
    branch = pr["head"].get("ref")
    if not isinstance(branch, str) or not valid_base(branch):
        raise Refused("MERGE_PR_INELIGIBLE", "head ref")
    settings = github(host, f"repos/{repo}", code)
    if not repository_matches(settings, repo, repo_id) or type(settings.get("delete_branch_on_merge")) is not bool:
        raise Refused(code, "repository settings")
    if settings.get(METHODS[method]) is not True:
        raise Refused("MERGE_PR_INELIGIBLE", "merge method")
    base = pr["base"]["ref"]
    rules = page_rows(host, f"repos/{repo}/rules/branches/{quote(base, safe='')}?per_page=100", code)
    for row in rules:
        rule = row.get("type")
        if not isinstance(rule, str):
            raise Refused(code, "base rules")
        if rule == "merge_queue":
            raise Refused("MERGE_PR_INELIGIBLE", "merge queue")
        if rule == "pull_request":
            data = row.get("parameters")
            allowed = data.get("allowed_merge_methods") if isinstance(data, dict) else None
            if not isinstance(allowed, list) or method not in allowed:
                raise Refused("MERGE_PR_INELIGIBLE", "effective rules exclude the merge method")
    if settings["delete_branch_on_merge"]:
        branch_deletable(github, page_rows, host, repo, branch, pr["head"]["sha"], settings, code)
        exact_dependencies(page_rows, host, repo, repo_id, branch, number, code)
    candidates = page_rows(host, f"repos/{repo}/actions/workflows?per_page=100", code, "workflows")
    workflows = [{key: row.get(key) for key in ("id", "path", "state")} for row in candidates]
    if len(workflows) != len(baseline["workflows"]) or any(row not in baseline["workflows"] for row in workflows) or any(
            row not in workflows for row in baseline["workflows"]):
        raise Refused(code, "workflow inventory differs from the approved baseline")
    hooks = [row.get("id") for row in page_rows(host, f"repos/{repo}/hooks?per_page=100", code)]
    if any(type(hook) is not int for hook in hooks) or sorted(hooks) != sorted(baseline["hooks"]):
        raise Refused(code, "hook inventory differs from the approved baseline")
    sha = pr["base"]["sha"]
    for pin in baseline["blobs"]:
        filename = quote(pin["path"], safe="/")
        data = github(host, f"repos/{repo}/contents/{filename}?ref={sha}", code)
        if (not isinstance(data, dict) or data.get("path") != pin["path"] or data.get("type") != "file"
                or data.get("sha") != pin["blob_sha"]):
            raise Refused(code, pin["path"])
    if main_head(github, host, repo, base) != sha:
        raise Refused("MERGE_HEAD_CHANGED", "base moved")
    return dict(baseline, base_sha=sha, auto_delete=settings["delete_branch_on_merge"],
                settings={key: settings.get(key) for key in ("default_branch", *METHODS.values())})
