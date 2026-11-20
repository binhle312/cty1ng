"""Pure rules for the chief's review records and grant order."""

import re

from night_format import FULL_SHA, Refused, entry_time, parsed_target


GRANT_CHANGES = ("assign", "plan", "review-start", "review", "cap", "ruling")
CHIEF_EVENTS = ("plan", "review-start", "review", "cap", "ruling", "advice", "confirm", "withdraw")


def review_cap(go, merges):
    return go["review_cap"] + go.get("merge_main_bonus", 0) * len(merges)


def credited_merges(night, target, merges):
    previous = night.review_starts.get(target, {}).get("bonus_merges", ())
    return sorted(set(previous) | set(merges))


def task_for(night, target):
    return night.task_specs.get(target)


def checked_plan(night, target, assignment):
    plan = night.plans.get(target)
    return plan if plan and plan["assignment"] == assignment else None


def reviewed_head_matches(pr, start):
    return (pr["head"]["sha"] == start["head"] and pr["base"]["sha"] == start["base_sha"]
            and start["merge_base"] == start["base_sha"])


def chief_only(night, chief):
    return chief == night.go["chief"]


def owned_scope(night, target, files):
    return set(files) <= set(task_for(night, target)["owned"])


def accepted_findings(night, review):
    findings = {}
    for report in review["reports"]:
        for label in ("p3", "p2", "p1"):
            for text in report[label]:
                finding = (report["source"], text)
                findings[finding] = night.rulings.get((review["id"], *finding), label)
    return {label: list(dict.fromkeys(text for (_, text), kind in findings.items() if kind == label))
            for label in ("p1", "p2", "p3")}


def grant_findings(night, review):
    target = review["target"]
    findings = accepted_findings(night, review)
    start = night.review_starts[target]
    for earlier in night.entries:
        if earlier["kind"] not in ("review", "cap") or earlier["target"] != target or earlier["id"] == review["id"]:
            continue
        previous = accepted_findings(night, earlier)
        for severity in ("p1", "p2", "p3"):
            if severity == "p3" or earlier["reports"][0]["head"] == start["head"]:
                findings[severity] = list(dict.fromkeys(findings[severity] + previous[severity]))
    if findings["p1"] or findings["p2"]:
        raise Refused("REVIEW_FINDINGS_OPEN", review["target"])
    if findings["p3"]:
        if len(night.review_pairs.get(review["target"], ())) < start["cap"]:
            raise Refused("REVIEW_FINDINGS_OPEN", review["target"])
        advice = night.advice.get(review["id"])
        if (not advice or advice["advisor"] != "allow"
                or any(answer != "allow" for answer in advice["consultants"])):
            raise Refused("REVIEW_ADVICE_REQUIRED", review["target"])
    return findings["p3"]


def current_review_allows(night, grant):
    target = grant["target"]
    assignment = night.assignments.get(target, {})
    plan = night.plans.get(target, {})
    review = night.reviews.get(target, {})
    start = night.review_starts.get(target, {})
    if (grant["assignment"] != assignment.get("id") or grant["review"] != review.get("id")
            or review.get("start") != start.get("id") or start.get("plan_check") != plan.get("id")):
        return False
    try:
        return grant_findings(night, review) == grant["evidence"]["p3"]
    except Refused:
        return False


def round_number(night, target, head):
    for entry in night.entries:
        if entry["kind"] in ("review", "cap") and entry["target"] == target:
            report = entry["reports"][0]
            if report["head"] == head:
                return report["binding"]["round"]
    return len(night.review_pairs.get(target, ())) + 1


def report_binding(night, start):
    return dict(run=night.run, target=start["target"], assignment=start["assignment"],
                start=start["id"], plan_check=start["plan_check"], round=start["round"])


def review_problem(night, entry):
    kind = entry["kind"]
    if kind not in CHIEF_EVENTS or not night.go:
        return None
    if "chief" not in entry:
        return "MERGE_CHIEF_ONLY"
    if kind in ("review", "cap") and not {"start", "assignment", "digests", "ledger"} <= entry.keys():
        return "REVIEW_START_REQUIRED"
    if not chief_only(night, entry["chief"]):
        return "MERGE_CHIEF_ONLY"
    if kind in ("confirm", "withdraw"):
        grant = night.grants.get(entry["grant"])
        if night.pending_grant != entry["grant"] or not grant or grant["target"] != entry["target"]:
            return "MERGE_PENDING"
        if kind == "confirm" and (entry["head"] != grant["head"] or
                any(not FULL_SHA.fullmatch(entry[key]) for key in ("main", "sha"))):
            return "MERGE_NOT_CONFIRMED"
        return None
    target = entry["target"]
    task = task_for(night, target)
    assignment = night.assignments.get(target)
    if not task or task["class"] == "owner":
        return "REVIEW_OWNER_TASK"
    if not assignment or entry["assignment"] != assignment["id"]:
        return "REVIEWER_NOT_ASSIGNED"
    if kind == "plan":
        return None
    if not (plan := checked_plan(night, target, assignment["id"])):
        return "REVIEW_PLAN_REQUIRED"
    if kind == "review-start":
        prior_tips = set(night.review_starts.get(target, {}).get("bonus_merges", ()))
        merges = entry["bonus_merges"]
        if (entry["cap"] != review_cap(night.go, merges) or sorted(set(merges)) != merges
                or not prior_tips <= set(merges) <= prior_tips | {entry["base_sha"]}
                or any(not FULL_SHA.fullmatch(sha) for sha in [entry["head"], entry["base_sha"],
                                                             entry["merge_base"], *merges])):
            return "REVIEW_CAP_FORM"
        if entry["round"] != round_number(night, target, entry["head"]):
            return "REVIEW_CAP_FORM"
        if entry["plan_check"] != plan["id"]:
            return "REVIEW_PLAN_REQUIRED"
        if len(night.review_pairs.get(target, ())) >= entry["cap"]:
            return "REVIEW_CAP_REACHED"
        return None
    start = night.review_starts.get(target)
    if (not start or start["assignment"] != assignment["id"] or entry["start"] != start["id"]
            or start["plan_check"] != plan["id"]):
        return "REVIEW_START_REQUIRED"
    if kind in ("review", "cap"):
        binding = report_binding(night, start)
        if any(report["head"] != start["head"] or report["binding"] != binding for report in entry["reports"]):
            return "REVIEW_REPORT"
        digests = entry["digests"]
        if len(digests) != 2 or len(set(digests)) != 2 or any(not re.fullmatch(r"[a-f0-9]{64}", d) for d in digests):
            return "REVIEW_REPORT"
        sources = {r["source"] for r in entry["reports"]}
        if any(e["kind"] in ("review", "cap") and (e["start"] == start["id"] or
                set(e["digests"]).intersection(digests) or any(r["source"] in sources for r in e["reports"]))
                for e in night.entries):
            return "REVIEW_START_REQUIRED"
        return None
    review = night.reviews.get(target)
    if not review or review["start"] != start["id"]:
        return "REVIEW_START_REQUIRED"
    if kind == "ruling":
        review = next((prior for prior in night.entries if prior["id"] == entry["review"]
                       and prior["kind"] in ("review", "cap") and prior["target"] == target), None)
        if not review or not any(r["source"] == entry["source"] and entry["finding"] in r["p1"] + r["p2"] + r["p3"]
                   for r in review["reports"]):
            return "REVIEW_REPORT"
    if kind == "advice":
        if entry["review"] != review["id"]:
            return "REVIEW_START_REQUIRED"
        findings = accepted_findings(night, review)
        if (len(night.review_pairs.get(target, ())) < start["cap"]
                or findings["p1"] or findings["p2"] or not findings["p3"]
                or bool(entry["consultants"]) != night.go["consultants"]):
            return "REVIEW_ADVICE_REQUIRED"
    return None

def required_checks(rules, classic, protected):
    unknown = "MERGE_CI_UNKNOWN"
    required = set()
    for rule in rules:
        if not isinstance(rule.get("type"), str):
            raise Refused(unknown, "branch rules")
        if rule["type"] == "merge_queue":
            raise Refused("MERGE_PR_INELIGIBLE", "merge queue")
        if rule["type"] == "required_status_checks":
            try:
                checks = rule["parameters"]["required_status_checks"]
                required.update(check_requirement(check, "integration_id") for check in checks)
            except (TypeError, KeyError, AttributeError, ValueError):
                raise Refused(unknown, "branch rules") from None
    if protected:
        if not isinstance(classic, dict):
            raise Refused(unknown, "classic branch protection")
        checks = classic.get("required_status_checks")
        if checks is not None:
            try:
                required.update(check_requirement(check, "app_id") for check in checks["checks"])
                represented = {name for name, _ in required}
                required.update(check_requirement({"context": name}, "app_id")
                                for name in checks["contexts"] if name not in represented)
            except (TypeError, KeyError, AttributeError, ValueError):
                raise Refused(unknown, "classic checks") from None
    return required


def automation_valid(baselines):
    for repository, baseline in baselines.items():
        if (not isinstance(repository, str) or parsed_target(repository + "#1") is None
                or repository != repository.lower() or not isinstance(baseline, dict)
                or set(baseline) != {"repo_id", "order", "workflows", "blobs", "hooks"}
                or any(type(baseline[k]) is not int or baseline[k] <= 0 for k in ("repo_id", "order"))
                or not all(isinstance(baseline[k], list) for k in ("workflows", "blobs", "hooks"))):
            return False
        workflows, blobs, hooks = (baseline[k] for k in ("workflows", "blobs", "hooks"))
        if any(not isinstance(row, dict) or set(row) != {"id", "path", "state"}
               or type(row["id"]) is not int or row["id"] <= 0 or not isinstance(row["path"], str)
               or not row["path"] or row["state"] not in ("active", "disabled_manually", "disabled_inactivity", "disabled_fork")
               for row in workflows):
            return False
        if any(not isinstance(row, dict) or set(row) != {"path", "blob_sha"}
               or not isinstance(row["path"], str) or not row["path"].startswith(".github/workflows/")
               or not isinstance(row["blob_sha"], str) or not FULL_SHA.fullmatch(row["blob_sha"]) for row in blobs):
            return False
        if (len({row["id"] for row in workflows}) != len(workflows)
                or len({row["path"] for row in blobs}) != len(blobs)
                or any(type(hook) is not int or hook <= 0 for hook in hooks) or len(set(hooks)) != len(hooks)):
            return False
        file_paths = {row["path"] for row in workflows if row["state"] == "active"}
        if {row["path"] for row in blobs} != {name for name in file_paths if name.startswith(".github/workflows/")}:
            return False
    return True


def check_statuses(required, checks, statuses, head):
    decisions = []
    for name, source in sorted(required, key=lambda pair: (pair[0], pair[1] or 0)):
        exact = [row for row in checks if row.get("name") == name and row.get("head_sha") == head
                 and (source in (None, -1) or isinstance(row.get("app"), dict) and row["app"].get("id") == source)]
        native = next((row for row in statuses if row.get("context") == name
                       and row.get("sha", head) == head), None) if source in (None, -1) else None
        if any(type(row.get("id")) is not int for row in exact) or (native is not None and type(native.get("id")) is not int):
            raise Refused("MERGE_CI_UNKNOWN", name)
        check = max(exact, key=lambda row: row["id"], default=None)
        if (not check and not native or check and
                (check.get("status") != "completed" or check.get("conclusion") != "success")
                or native and native.get("state") != "success"):
            raise Refused("MERGE_CI_NOT_GREEN", name)
        if check:
            decisions.append(dict(kind="check", context=name, sha=head, id=check["id"],
                                  app=(check.get("app") or {}).get("id"), state=check["conclusion"]))
        if native:
            decisions.append(dict(kind="status", context=name, sha=head, id=native["id"], state=native["state"]))
    return decisions


def check_requirement(check, key):
    name, source = check["context"], check.get(key)
    if not isinstance(name, str) or not name.strip() or (source is not None and type(source) is not int):
        raise ValueError("invalid check requirement")
    return name, source



def action_problem(night, now, fake):
    if fake and not night.test:
        return "FAKE_CLOCK"
    if night.last and now < entry_time(night.last["t"]):
        return "TIME_BACK"
    if night.faults:
        return "JOURNAL_FAULTS"
    if night.close:
        return "CLOSED"
    if not night.go:
        return "NOT_STARTED"
    if now >= entry_time(night.go["stop"]):
        return "AFTER_STOP"
    return None
