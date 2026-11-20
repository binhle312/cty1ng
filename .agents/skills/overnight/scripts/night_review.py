"""Pure rules for the chief's review records and grant order."""

from night_format import FULL_SHA, Refused


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
    findings = accepted_findings(night, review)
    start = night.review_starts[review["target"]]
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
        merges = credited_merges(night, target, entry["main_merges"])
        if (entry["cap"] != review_cap(night.go, merges) or entry["bonus_merges"] != merges
                or any(not FULL_SHA.fullmatch(sha) for sha in [entry["head"], entry["base_sha"],
                                                             entry["merge_base"], *merges])):
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
        if any(report["head"] != start["head"] for report in entry["reports"]):
            return "MERGE_HEAD_CHANGED"
        sources = {r["source"] for r in entry["reports"]}
        if any(e["kind"] in ("review", "cap") and (e["start"] == start["id"] or
                any(r["source"] in sources for r in e["reports"])) for e in night.entries):
            return "REVIEW_START_REQUIRED"
        return None
    review = night.reviews.get(target)
    if not review or review["start"] != start["id"] or entry["review"] != review["id"]:
        return "REVIEW_START_REQUIRED"
    if kind in ("ruling", "advice") and night.pending_grant in night.grants and (
            night.grants[night.pending_grant]["target"] == target):
        return "MERGE_PENDING"
    if kind == "ruling":
        if not any(r["source"] == entry["source"] and entry["finding"] in r["p1"] + r["p2"] + r["p3"]
                   for r in review["reports"]):
            return "REVIEW_REPORT"
    if kind == "advice":
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


def check_statuses(required, checks, statuses, head):
    for name, source in required:
        exact = [c for c in checks if c.get("name") == name and c.get("head_sha") == head
                 and (source in (None, -1) or isinstance(c.get("app"), dict) and c["app"].get("id") == source)]
        actual = [c.get("status") == "completed" and c.get("conclusion") == "success" for c in exact]
        if source in (None, -1):
            actual += [record.get("state") == "success" for record in statuses
                       if record.get("context") == name and record.get("sha", head) == head]
        if not actual or not all(actual):
            raise Refused("MERGE_CI_NOT_GREEN", str(name))


def check_requirement(check, key):
    name, source = check["context"], check.get(key)
    if not isinstance(name, str) or not name.strip() or (source is not None and type(source) is not int):
        raise ValueError("invalid check requirement")
    return name, source


def check_main_statuses(checks, statuses, head):
    for row in checks:
        if row.get("head_sha") != head or row.get("status") != "completed" or row.get("conclusion") not in (
                "success", "neutral", "skipped"):
            raise Refused("MERGE_CI_NOT_GREEN", row.get("name", head))
    latest = {}
    for row in statuses:
        latest.setdefault(row.get("context"), row)
    for context, row in latest.items():
        if row.get("sha") != head or row.get("state") != "success":
            raise Refused("MERGE_CI_NOT_GREEN", context or head)
